<?php
/**
 * Sales Order API
 *
 * Dedicated endpoint for Sales Orders (order_type = 'Sales').
 * Tracks fulfilment through:
 *   - Sales Invoices  → order_items.billed_qty
 *   - Delivery Notes  → order_items.delivered_qty
 *   - pending_qty     = ordered_qty - billed_qty - delivered_qty
 *
 * Special GET params:
 *   ?pending_for_party=<ledger_id>   → returns open/partial orders with pending items
 *                                       (used in Sales / Delivery Note party-select dropdowns)
 *   ?id=<order_id>                   → single order with full item detail
 *   (no special param)               → paginated list with filters
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo    = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // ─────────────────────────────────────────────────────────
    // GET
    // ─────────────────────────────────────────────────────────
    if ($method === 'GET') {

        // ── Pending orders for a party (dropdown helper) ──────
        // GET ?pending_for_party=<ledger_id>
        // Returns all open/partial Sales Orders for that party,
        // with each order's items that still have pending_qty > 0.
        if (isset($_GET['pending_for_party'])) {
            $partyId = (int)$_GET['pending_for_party'];

            $stmt = $pdo->prepare("
                SELECT
                    o.id, o.order_no, o.order_date, o.expected_date,
                    o.status, o.grand_total, o.narration,
                    l.name as party_name
                FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                WHERE o.order_type       = 'Sales'
                  AND o.party_ledger_id  = ?
                  AND o.status          IN ('Open', 'Partial')
                ORDER BY o.order_date DESC, o.id DESC
            ");
            $stmt->execute([$partyId]);
            $orders = $stmt->fetchAll();

            // Attach only items with remaining pending_qty
            $stmtItems = $pdo->prepare("
                SELECT
                    oi.id, oi.item_id, oi.item_name, oi.unit_id,
                    oi.ordered_qty, oi.billed_qty, oi.delivered_qty, oi.pending_qty,
                    oi.rate, oi.discount_percent, oi.discount_amount,
                    oi.tax_id, oi.tax_percent, oi.tax_amount, oi.amount,
                    oi.godown_id, oi.description, oi.status,
                    un.name   as unit_name,   un.symbol as unit_symbol,
                    i.item_code, i.hsn_code
                FROM order_items oi
                LEFT JOIN items i  ON oi.item_id = i.id
                LEFT JOIN units un ON oi.unit_id  = un.id
                WHERE oi.order_id   = ?
                  AND oi.pending_qty > 0
                  AND oi.status NOT IN ('Completed', 'Cancelled')
                ORDER BY oi.id ASC
            ");

            foreach ($orders as &$order) {
                $stmtItems->execute([$order['id']]);
                $order['items'] = $stmtItems->fetchAll();
            }
            unset($order);

            // Drop orders that have no pending items after filtering
            $orders = array_values(array_filter($orders, fn($o) => !empty($o['items'])));

            ApiResponse::success($orders, 'Pending Sales Orders retrieved successfully');
        }

        // ── Single order ──────────────────────────────────────
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT o.*,
                       l.name    as party_name,
                       l.phone   as party_phone,
                       l.email   as party_email,
                       l.address as party_address,
                       u.name    as created_by_name
                FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                LEFT JOIN users   u ON o.created_by       = u.id
                WHERE o.id = ? AND o.order_type = 'Sales'
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            if (!$order) {
                ApiResponse::error('Sales Order not found', 404);
            }

            $stmt = $pdo->prepare("
                SELECT
                    oi.*,
                    i.item_code, i.hsn_code,
                    un.name   as unit_name,   un.symbol as unit_symbol,
                    t.name    as tax_name,    t.rate    as tax_rate,
                    g.name    as godown_name
                FROM order_items oi
                LEFT JOIN items    i  ON oi.item_id  = i.id
                LEFT JOIN units    un ON oi.unit_id   = un.id
                LEFT JOIN taxes    t  ON oi.tax_id    = t.id
                LEFT JOIN godowns  g  ON oi.godown_id = g.id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC
            ");
            $stmt->execute([$id]);
            $order['items'] = $stmt->fetchAll();

            $order['summary'] = [
                'total_ordered_qty'   => array_sum(array_column($order['items'], 'ordered_qty')),
                'total_billed_qty'    => array_sum(array_column($order['items'], 'billed_qty')),
                'total_delivered_qty' => array_sum(array_column($order['items'], 'delivered_qty')),
                'total_pending_qty'   => array_sum(array_column($order['items'], 'pending_qty')),
                'is_fully_fulfilled'  => array_sum(array_column($order['items'], 'pending_qty')) <= 0,
            ];

            // Linked Sales Invoices
            $stmt = $pdo->prepare("
                SELECT v.id, v.voucher_no, v.voucher_date, v.total_amount, v.status
                FROM vouchers v
                WHERE v.order_id = ? AND v.voucher_type = 'Sales' AND v.status != 'cancelled'
                ORDER BY v.voucher_date DESC
            ");
            $stmt->execute([$id]);
            $order['sales_invoices'] = $stmt->fetchAll();

            // Linked Delivery Notes
            $stmt = $pdo->prepare("
                SELECT v.id, v.voucher_no, v.voucher_date, v.total_amount, v.status
                FROM vouchers v
                WHERE v.order_id = ? AND v.voucher_type = 'Delivery Note' AND v.status != 'cancelled'
                ORDER BY v.voucher_date DESC
            ");
            $stmt->execute([$id]);
            $order['delivery_notes'] = $stmt->fetchAll();

            ApiResponse::success($order, 'Sales Order retrieved successfully');
        }

        // ── List with filters ─────────────────────────────────
        $search       = $_GET['search']       ?? '';
        $status       = $_GET['status']       ?? '';
        $party_id     = $_GET['party_id']     ?? '';
        $from_date    = $_GET['from_date']    ?? '';
        $to_date      = $_GET['to_date']      ?? '';
        $pending_only = isset($_GET['pending_only']) && $_GET['pending_only'] === 'true';
        $page         = max(1, (int)($_GET['page']  ?? 1));
        $limit        = min(200, max(1, (int)($_GET['limit'] ?? 50)));
        $offset       = ($page - 1) * $limit;

        $where  = ["o.order_type = 'Sales'", "o.status != 'Cancelled'"];
        $params = [];

        if ($search) {
            $where[]  = "(o.order_no LIKE ? OR l.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        if ($status && in_array($status, ['Open', 'Partial', 'Completed', 'Cancelled'])) {
            $where[]  = "o.status = ?";
            $params[] = $status;
        }
        if ($party_id) {
            $where[]  = "o.party_ledger_id = ?";
            $params[] = (int)$party_id;
        }
        if ($from_date) {
            $where[]  = "o.order_date >= ?";
            $params[] = $from_date;
        }
        if ($to_date) {
            $where[]  = "o.order_date <= ?";
            $params[] = $to_date;
        }
        if ($pending_only) {
            $where[] = "o.status IN ('Open', 'Partial')";
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM orders o
            LEFT JOIN ledgers l ON o.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $listParams = array_merge($params, [$limit, $offset]);
        $stmt = $pdo->prepare("
            SELECT
                o.*,
                l.name as party_name,
                (SELECT COUNT(*)           FROM order_items oi WHERE oi.order_id = o.id)              as total_items,
                (SELECT COUNT(*)           FROM order_items oi WHERE oi.order_id = o.id AND oi.pending_qty > 0) as pending_items,
                (SELECT SUM(oi.ordered_qty)   FROM order_items oi WHERE oi.order_id = o.id)           as total_ordered_qty,
                (SELECT SUM(oi.billed_qty)    FROM order_items oi WHERE oi.order_id = o.id)           as total_billed_qty,
                (SELECT SUM(oi.delivered_qty) FROM order_items oi WHERE oi.order_id = o.id)           as total_delivered_qty,
                (SELECT SUM(oi.pending_qty)   FROM order_items oi WHERE oi.order_id = o.id)           as total_pending_qty
            FROM orders o
            LEFT JOIN ledgers l ON o.party_ledger_id = l.id
            WHERE $whereClause
            ORDER BY o.order_date DESC, o.id DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($listParams);
        $orders = $stmt->fetchAll();

        ApiResponse::success([
            'orders'     => $orders,
            'pagination' => [
                'total' => (int)$total,
                'page'  => $page,
                'limit' => $limit,
                'pages' => (int)ceil($total / $limit),
            ],
        ], 'Sales Orders retrieved successfully');
    }

    // ─────────────────────────────────────────────────────────
    // POST – Create Sales Order
    // ─────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $errors = Validator::validate($input, [
            'party_ledger_id' => 'required',
            'order_date'      => 'required',
            'items'           => 'required',
        ]);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['order_date'])) {
            ApiResponse::validationError(['order_date' => ['Invalid date format (use Y-m-d)']]);
        }

        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE id = ? AND status = 'active'");
        $stmt->execute([$input['party_ledger_id']]);
        if (!$stmt->fetch()) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        $pdo->beginTransaction();

        try {
            // Generate SO number
            $stmt  = $pdo->query("SELECT MAX(id) FROM orders WHERE order_type = 'Sales'");
            $maxId = $stmt->fetchColumn() ?? 0;
            $orderNo = $input['order_no'] ?? ('SO-' . str_pad($maxId + 1, 6, '0', STR_PAD_LEFT));

            $totalQty      = 0;
            $totalAmount   = 0;
            $totalDiscount = 0;
            $totalTax      = 0;

            foreach ($input['items'] as $item) {
                $qty          = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                $rate         = floatval($item['rate'] ?? 0);
                $discountAmt  = floatval($item['discount_amount'] ?? 0);
                $taxAmt       = floatval($item['tax_amount'] ?? 0);
                $totalQty    += $qty;
                $totalAmount += ($qty * $rate);
                $totalDiscount += $discountAmt;
                $totalTax    += $taxAmt;
            }

            $grandTotal = $totalAmount - $totalDiscount + $totalTax;

            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    company_id, order_type, order_no, order_date, expected_date,
                    party_ledger_id, billing_address, shipping_address,
                    total_qty, total_amount, discount_amount, tax_amount, grand_total,
                    narration, status, created_by
                ) VALUES (?, 'Sales', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)
            ");
            $stmt->execute([
                $input['company_id']      ?? null,
                $orderNo,
                $input['order_date'],
                $input['expected_date']   ?? null,
                $input['party_ledger_id'],
                $input['billing_address'] ?? null,
                $input['shipping_address'] ?? null,
                $totalQty,
                $totalAmount,
                $totalDiscount,
                $totalTax,
                $grandTotal,
                $input['narration']       ?? null,
                $user['id'],
            ]);
            $orderId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("
                INSERT INTO order_items (
                    order_id, item_id, item_name, unit_id,
                    ordered_qty, billed_qty, delivered_qty, pending_qty, rate,
                    discount_percent, discount_amount, tax_id, tax_percent, tax_amount,
                    amount, godown_id, description, status
                ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            ");

            foreach ($input['items'] as $item) {
                $stmt = $pdo->prepare("SELECT id, name FROM items WHERE id = ?");
                $stmt->execute([$item['item_id']]);
                $itemData = $stmt->fetch();
                if (!$itemData) {
                    throw new Exception("Item with ID {$item['item_id']} not found");
                }

                $orderedQty      = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                $rate            = floatval($item['rate'] ?? 0);
                $discountPercent = floatval($item['discount_percent'] ?? 0);
                $discountAmount  = floatval($item['discount_amount'] ?? 0);
                $taxPercent      = floatval($item['tax_percent'] ?? 0);
                $taxAmount       = floatval($item['tax_amount'] ?? 0);
                $amount          = floatval($item['amount'] ?? ($orderedQty * $rate - $discountAmount + $taxAmount));

                $stmtItem->execute([
                    $orderId,
                    $item['item_id'],
                    $item['item_name'] ?? $itemData['name'],
                    $item['unit_id']   ?? null,
                    $orderedQty,
                    $orderedQty,   // pending_qty = ordered_qty initially
                    $rate,
                    $discountPercent,
                    $discountAmount,
                    $item['tax_id'] ?? null,
                    $taxPercent,
                    $taxAmount,
                    $amount,
                    $item['godown_id'] ?? null,
                    $item['description'] ?? null,
                ]);
            }

            $pdo->commit();

            $stmt = $pdo->prepare("
                SELECT o.*, l.name as party_name FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                WHERE o.id = ?
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();

            $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $stmt->execute([$orderId]);
            $order['items'] = $stmt->fetchAll();

            ApiResponse::success($order, 'Sales Order created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ─────────────────────────────────────────────────────────
    // PUT – Update Sales Order
    // ─────────────────────────────────────────────────────────
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (empty($input['id'])) {
            ApiResponse::error('Sales Order ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? AND order_type = 'Sales'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Sales Order not found', 404);
        }
        if (in_array($existing['status'], ['Completed', 'Cancelled'])) {
            ApiResponse::error('Cannot modify completed or cancelled orders', 400);
        }

        $pdo->beginTransaction();

        try {
            if (isset($input['items']) && is_array($input['items']) && !empty($input['items'])) {
                // Preserve existing billed/delivered quantities per item
                $stmt = $pdo->prepare("
                    SELECT item_id, billed_qty, delivered_qty FROM order_items WHERE order_id = ?
                ");
                $stmt->execute([$id]);
                $existingQtys = [];
                foreach ($stmt->fetchAll() as $row) {
                    $existingQtys[$row['item_id']] = [
                        'billed_qty'    => floatval($row['billed_qty']),
                        'delivered_qty' => floatval($row['delivered_qty']),
                    ];
                }

                $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                $stmt->execute([$id]);

                $totalQty      = 0;
                $totalAmount   = 0;
                $totalDiscount = 0;
                $totalTax      = 0;

                $stmtItem = $pdo->prepare("
                    INSERT INTO order_items (
                        order_id, item_id, item_name, unit_id,
                        ordered_qty, billed_qty, delivered_qty, pending_qty, rate,
                        discount_percent, discount_amount, tax_id, tax_percent, tax_amount,
                        amount, godown_id, description, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");

                foreach ($input['items'] as $item) {
                    $stmt = $pdo->prepare("SELECT id, name FROM items WHERE id = ?");
                    $stmt->execute([$item['item_id']]);
                    $itemData = $stmt->fetch();
                    if (!$itemData) {
                        throw new Exception("Item with ID {$item['item_id']} not found");
                    }

                    $orderedQty      = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                    $billedQty       = $existingQtys[$item['item_id']]['billed_qty']    ?? 0;
                    $deliveredQty    = $existingQtys[$item['item_id']]['delivered_qty'] ?? 0;
                    $pendingQty      = max(0, $orderedQty - $billedQty - $deliveredQty);
                    $rate            = floatval($item['rate'] ?? 0);
                    $discountPercent = floatval($item['discount_percent'] ?? 0);
                    $discountAmount  = floatval($item['discount_amount'] ?? 0);
                    $taxPercent      = floatval($item['tax_percent'] ?? 0);
                    $taxAmount       = floatval($item['tax_amount'] ?? 0);
                    $amount          = floatval($item['amount'] ?? ($orderedQty * $rate - $discountAmount + $taxAmount));

                    $itemStatus = 'Pending';
                    if ($billedQty + $deliveredQty >= $orderedQty) {
                        $itemStatus = 'Completed';
                    } elseif ($billedQty + $deliveredQty > 0) {
                        $itemStatus = 'Partial';
                    }

                    $stmtItem->execute([
                        $id,
                        $item['item_id'],
                        $item['item_name'] ?? $itemData['name'],
                        $item['unit_id']   ?? null,
                        $orderedQty,
                        $billedQty,
                        $deliveredQty,
                        $pendingQty,
                        $rate,
                        $discountPercent,
                        $discountAmount,
                        $item['tax_id'] ?? null,
                        $taxPercent,
                        $taxAmount,
                        $amount,
                        $item['godown_id']   ?? null,
                        $item['description'] ?? null,
                        $itemStatus,
                    ]);

                    $totalQty      += $orderedQty;
                    $totalAmount   += ($orderedQty * $rate);
                    $totalDiscount += $discountAmount;
                    $totalTax      += $taxAmount;
                }

                $grandTotal = $totalAmount - $totalDiscount + $totalTax;

                $stmt = $pdo->prepare("
                    UPDATE orders SET
                        order_date       = ?,
                        expected_date    = ?,
                        party_ledger_id  = ?,
                        billing_address  = ?,
                        shipping_address = ?,
                        total_qty        = ?,
                        total_amount     = ?,
                        discount_amount  = ?,
                        tax_amount       = ?,
                        grand_total      = ?,
                        narration        = ?
                    WHERE id = ?
                ");
                $stmt->execute([
                    $input['order_date']       ?? $existing['order_date'],
                    $input['expected_date']    ?? $existing['expected_date'],
                    $input['party_ledger_id']  ?? $existing['party_ledger_id'],
                    $input['billing_address']  ?? $existing['billing_address'],
                    $input['shipping_address'] ?? $existing['shipping_address'],
                    $totalQty,
                    $totalAmount,
                    $totalDiscount,
                    $totalTax,
                    $grandTotal,
                    $input['narration'] ?? $existing['narration'],
                    $id,
                ]);
            } else {
                // Header-only update
                $stmt = $pdo->prepare("
                    UPDATE orders SET
                        order_date       = ?,
                        expected_date    = ?,
                        party_ledger_id  = ?,
                        billing_address  = ?,
                        shipping_address = ?,
                        narration        = ?
                    WHERE id = ?
                ");
                $stmt->execute([
                    $input['order_date']       ?? $existing['order_date'],
                    $input['expected_date']    ?? $existing['expected_date'],
                    $input['party_ledger_id']  ?? $existing['party_ledger_id'],
                    $input['billing_address']  ?? $existing['billing_address'],
                    $input['shipping_address'] ?? $existing['shipping_address'],
                    $input['narration']        ?? $existing['narration'],
                    $id,
                ]);
            }

            soUpdateStatus($pdo, $id);

            $pdo->commit();

            $stmt = $pdo->prepare("
                SELECT o.*, l.name as party_name FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $stmt->execute([$id]);
            $order['items'] = $stmt->fetchAll();

            ApiResponse::success($order, 'Sales Order updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ─────────────────────────────────────────────────────────
    // DELETE – Cancel Sales Order
    // ─────────────────────────────────────────────────────────
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Sales Order ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? AND order_type = 'Sales'");
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) {
            ApiResponse::error('Sales Order not found', 404);
        }
        if ($order['status'] === 'Cancelled') {
            ApiResponse::error('Sales Order is already cancelled', 400);
        }

        // Block cancel if any qty has been billed or delivered
        $stmt = $pdo->prepare("
            SELECT SUM(billed_qty) + SUM(delivered_qty) as fulfilled
            FROM order_items WHERE order_id = ?
        ");
        $stmt->execute([$id]);
        $fulfilled = floatval($stmt->fetchColumn());

        if ($fulfilled > 0) {
            ApiResponse::error(
                'Cannot cancel Sales Order — it has been partially or fully fulfilled (billed/delivered qty: ' . $fulfilled . ')',
                400
            );
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?");
            $stmt->execute([$id]);

            $stmt = $pdo->prepare("UPDATE order_items SET status = 'Cancelled', pending_qty = 0 WHERE order_id = ?");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Sales Order cancelled successfully');
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Sales Order API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Sales Order API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Recalculate and update Sales Order status.
 * pending_qty = ordered_qty - billed_qty - delivered_qty (stored in DB, managed per-item).
 */
function soUpdateStatus($pdo, $orderId) {
    $stmt = $pdo->prepare("
        SELECT
            SUM(billed_qty)    as total_billed,
            SUM(delivered_qty) as total_delivered,
            SUM(pending_qty)   as total_pending
        FROM order_items WHERE order_id = ?
    ");
    $stmt->execute([$orderId]);
    $t = $stmt->fetch();

    $fulfilled = floatval($t['total_billed']) + floatval($t['total_delivered']);
    $pending   = floatval($t['total_pending']);

    $status = 'Open';
    if ($pending <= 0 && $fulfilled > 0) {
        $status = 'Completed';
    } elseif ($fulfilled > 0) {
        $status = 'Partial';
    }

    $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$status, $orderId]);
}
