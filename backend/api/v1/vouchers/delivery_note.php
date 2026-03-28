<?php
/**
 * Delivery Note API - Tracks physical delivery against Sales Orders (NO stock/accounting effect)
 *
 * Flow:
 *   Sales Order → Delivery Note (tracks delivered_qty) → Sales Invoice
 *
 * When a Delivery Note is created/updated/cancelled:
 *   - order_items.delivered_qty is updated
 *   - order_items.pending_qty = ordered_qty - billed_qty - delivered_qty
 *   - orders.status is recalculated
 *
 * If an order item's pending_qty reaches 0 it will not appear in Sales/Delivery Note dropdowns.
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
require_once __DIR__ . '/../../../helpers/moduleAccess.php';
require_once __DIR__ . '/../../../helpers/voucher.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();
ModuleAccessHelper::requireModule($pdo, $user, 'delivery_note', 'Delivery Note');

try {
    $pdo = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method = $_SERVER['REQUEST_METHOD'];

    // ─────────────────────────────────────────────────────────
    // GET
    // ─────────────────────────────────────────────────────────
    if ($method === 'GET') {

        // Single delivery note
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name  as party_name,
                       l.phone as party_phone,
                       l.email as party_email,
                       o.order_no,
                       u.name  as created_by_name
                FROM vouchers v
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                LEFT JOIN orders  o ON v.order_id        = o.id
                LEFT JOIN users   u ON v.created_by      = u.id
                WHERE v.id = ? AND v.voucher_type = 'Delivery Note'
            ");
            $stmt->execute([$id]);
            $dn = $stmt->fetch();

            if (!$dn) {
                ApiResponse::error('Delivery Note not found', 404);
            }

            $stmt = $pdo->prepare("
                SELECT vi.*,
                       i.item_code, i.hsn_code,
                       un.name   as unit_name, un.symbol as unit_symbol,
                       oi.ordered_qty, oi.billed_qty, oi.delivered_qty, oi.pending_qty
                FROM voucher_items vi
                LEFT JOIN items    i  ON vi.product_id    = i.id
                LEFT JOIN units    un ON vi.unit_id        = un.id
                LEFT JOIN order_items oi ON vi.order_item_id = oi.id
                WHERE vi.voucher_id = ?
                ORDER BY vi.id ASC
            ");
            $stmt->execute([$id]);
            $dn['items'] = $stmt->fetchAll();

            ApiResponse::success($dn, 'Delivery Note retrieved successfully');
        }

        // List delivery notes
        $search    = $_GET['search']    ?? '';
        $status    = $_GET['status']    ?? '';
        $party_id  = $_GET['party_id']  ?? '';
        $order_id  = $_GET['order_id']  ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date   = $_GET['to_date']   ?? '';
        $page      = max(1, (int)($_GET['page']  ?? 1));
        $limit     = min(200, max(1, (int)($_GET['limit'] ?? 50)));
        $offset    = ($page - 1) * $limit;

        $where  = ["v.voucher_type = 'Delivery Note'"];
        $params = [];
        TenantHelper::appendCompanyFilter($where, $params, $companyId, 'v.company_id');

        if ($search) {
            $where[]  = "(v.voucher_no LIKE ? OR l.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        if ($status && in_array($status, ['draft', 'posted', 'cancelled'])) {
            $where[]  = "v.status = ?";
            $params[] = $status;
        }
        if ($party_id) {
            $where[]  = "v.party_ledger_id = ?";
            $params[] = (int)$party_id;
        }
        if ($order_id) {
            $where[]  = "v.order_id = ?";
            $params[] = (int)$order_id;
        }
        if ($from_date) {
            $where[]  = "v.voucher_date >= ?";
            $params[] = $from_date;
        }
        if ($to_date) {
            $where[]  = "v.voucher_date <= ?";
            $params[] = $to_date;
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $listParams   = array_merge($params, [$limit, $offset]);
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name     as party_name,
                   o.order_no,
                   (SELECT COUNT(*) FROM voucher_items vi WHERE vi.voucher_id = v.id) as item_count
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            LEFT JOIN orders  o ON v.order_id        = o.id
            WHERE $whereClause
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($listParams);
        $notes = $stmt->fetchAll();

        ApiResponse::success([
            'delivery_notes' => $notes,
            'pagination'     => [
                'total' => (int)$total,
                'page'  => $page,
                'limit' => $limit,
                'pages' => (int)ceil($total / $limit)
            ]
        ], 'Delivery Notes retrieved successfully');
    }

    // ─────────────────────────────────────────────────────────
    // POST – Create Delivery Note
    // ─────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $errors = Validator::validate($input, [
            'party_ledger_id' => 'required',
            'voucher_date'    => 'required',
            'items'           => 'required',
        ]);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        // Validate party
        $stmt = $pdo->prepare("SELECT id, name FROM ledgers WHERE id = ? AND status = 'active'");
        $stmt->execute([$input['party_ledger_id']]);
        if (!$stmt->fetch()) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        // Validate order (optional)
        $orderId = !empty($input['order_id']) ? (int)$input['order_id'] : null;
        if ($orderId) {
            $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ? AND order_type = 'Sales' AND status NOT IN ('Cancelled','Completed')");
            $stmt->execute([$orderId]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError(['order_id' => ['Sales Order not found or already completed/cancelled']]);
            }
        }

        $pdo->beginTransaction();

        try {
            // Generate voucher number
            $voucherNo = $input['voucher_no'] ?? VoucherHelper::generateVoucherNo(
                $pdo,
                'Delivery Note',
                $companyId,
                1,
                $input['voucher_date'] ?? null
            );

            // Calculate totals (no tax — DN is just a physical document)
            $totalQty    = 0;
            $grandTotal  = 0;

            $processedItems = [];
            foreach ($input['items'] as $item) {
                $qty         = floatval($item['quantity'] ?? $item['ordered_qty'] ?? 0);
                $rate        = floatval($item['rate']     ?? 0);
                $amount      = $qty * $rate;
                $totalQty   += $qty;
                $grandTotal += $amount;

                $processedItems[] = [
                    'product_id'    => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name'     => $item['item_name'],
                    'colour'        => $item['colour']  ?? null,
                    'gsm'           => $item['gsm']     ?? null,
                    'dia'           => $item['dia']     ?? null,
                    'count'         => $item['count']   ?? null,
                    'roll'          => $item['roll']    ?? null,
                    'quantity'      => $qty,
                    'unit_id'       => $item['unit_id'] ?? null,
                    'rate'          => $rate,
                    'amount'        => $amount,
                    'description'   => $item['description'] ?? null,
                    'order_item_id' => $item['order_item_id'] ?? null,
                ];
            }

            // Insert voucher
            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    party_ledger_id, order_id,
                    billing_name, billing_address, billing_city, billing_state,
                    vehicle_no, transporter_name, transporter_id,
                    total_amount, narration, status, created_by
                ) VALUES (?, 'Delivery Note', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $companyId,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no']    ?? null,
                $input['party_ledger_id'],
                $orderId,
                $input['billing_name']    ?? null,
                $input['billing_address'] ?? null,
                $input['billing_city']    ?? null,
                $input['billing_state']   ?? null,
                $input['vehicle_no']      ?? null,
                $input['transporter_name'] ?? null,
                $input['transporter_id']  ?? null,
                $grandTotal,
                $input['narration']       ?? null,
                $input['status']          ?? 'posted',
                $user['id'],
            ]);
            $voucherId = $pdo->lastInsertId();

            // Insert items & update order_items.delivered_qty
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, amount, description, order_item_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $voucherId,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['gsm'],
                    $item['dia'],
                    $item['count'],
                    $item['roll'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['amount'],
                    $item['description'],
                    $item['order_item_id'],
                ]);

                // Always reduce stock on Delivery Note (with or without Sales Order)
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'delivery_note', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Delivery Note to ' . ($input['billing_name'] ?? 'Customer'),
                    ]);
                }

                // Update order_items: delivered_qty increases, pending_qty decreases
                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET delivered_qty = delivered_qty + ?,
                            pending_qty   = GREATEST(0, ordered_qty - billed_qty - (delivered_qty + ?)),
                            status        = CASE
                                WHEN ordered_qty <= billed_qty + delivered_qty + ? THEN 'Completed'
                                WHEN delivered_qty + ? > 0                         THEN 'Partial'
                                ELSE status
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'], $item['quantity'],
                        $item['quantity'], $item['quantity'],
                        $item['order_item_id'],
                    ]);
                }
            }

            // Recalculate parent order status
            if ($orderId) {
                updateDNOrderStatus($pdo, $orderId);
            }

            $pdo->commit();

            ApiResponse::success([
                'id'          => $voucherId,
                'voucher_no'  => $voucherNo,
                'total_qty'   => $totalQty,
                'grand_total' => round($grandTotal, 2),
                'status'      => $input['status'] ?? 'posted',
            ], 'Delivery Note created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ─────────────────────────────────────────────────────────
    // PUT – Update Delivery Note
    // ─────────────────────────────────────────────────────────
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (empty($input['id'])) {
            ApiResponse::error('Delivery Note ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Delivery Note'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Delivery Note not found', 404);
        }
        if ($existing['status'] === 'cancelled') {
            ApiResponse::error('Cancelled Delivery Notes cannot be edited', 400);
        }

        $pdo->beginTransaction();

        try {
            // 1. Reverse old stock and delivered_qty
            $stmt = $pdo->prepare("SELECT product_id, quantity, order_item_id FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $oldItems = $stmt->fetchAll();

            foreach ($oldItems as $old) {
                // Reverse stock
                if ($old['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$old['quantity'], $old['product_id']]);
                }

                // Reverse old stock_movement
                $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ? AND type = 'delivery_note'");
                $stmt->execute([$existing['voucher_no']]);

                if (!empty($old['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET delivered_qty = GREATEST(0, delivered_qty - ?),
                            pending_qty   = GREATEST(0, ordered_qty - billed_qty - GREATEST(0, delivered_qty - ?)),
                            status        = CASE
                                WHEN GREATEST(0, delivered_qty - ?) = 0 AND billed_qty = 0 THEN 'Pending'
                                ELSE 'Partial'
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $old['quantity'], $old['quantity'],
                        $old['quantity'],
                        $old['order_item_id'],
                    ]);
                }
            }

            // 2. Delete old items
            $stmt = $pdo->prepare("DELETE FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);

            // 3. Process new items
            $orderId    = !empty($input['order_id']) ? (int)$input['order_id'] : ($existing['order_id'] ?? null);
            $totalQty   = 0;
            $grandTotal = 0;

            $processedItems = [];
            foreach ($input['items'] as $item) {
                $qty         = floatval($item['quantity'] ?? $item['ordered_qty'] ?? 0);
                $rate        = floatval($item['rate'] ?? 0);
                $amount      = $qty * $rate;
                $totalQty   += $qty;
                $grandTotal += $amount;

                $processedItems[] = [
                    'product_id'    => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name'     => $item['item_name'],
                    'colour'        => $item['colour']  ?? null,
                    'gsm'           => $item['gsm']     ?? null,
                    'dia'           => $item['dia']     ?? null,
                    'count'         => $item['count']   ?? null,
                    'roll'          => $item['roll']    ?? null,
                    'quantity'      => $qty,
                    'unit_id'       => $item['unit_id'] ?? null,
                    'rate'          => $rate,
                    'amount'        => $amount,
                    'description'   => $item['description'] ?? null,
                    'order_item_id' => $item['order_item_id'] ?? null,
                ];
            }

            // 4. Update voucher header
            $stmt = $pdo->prepare("
                UPDATE vouchers SET
                    voucher_no       = ?,
                    voucher_date     = ?,
                    reference_no     = ?,
                    party_ledger_id  = ?,
                    order_id         = ?,
                    billing_name     = ?,
                    billing_address  = ?,
                    billing_city     = ?,
                    billing_state    = ?,
                    vehicle_no       = ?,
                    transporter_name = ?,
                    transporter_id   = ?,
                    total_amount     = ?,
                    narration        = ?,
                    status           = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $input['voucher_no']      ?? $existing['voucher_no'],
                $input['voucher_date']    ?? $existing['voucher_date'],
                $input['reference_no']    ?? $existing['reference_no'],
                $input['party_ledger_id'] ?? $existing['party_ledger_id'],
                $orderId,
                $input['billing_name']    ?? $existing['billing_name'],
                $input['billing_address'] ?? $existing['billing_address'],
                $input['billing_city']    ?? $existing['billing_city'],
                $input['billing_state']   ?? $existing['billing_state'],
                $input['vehicle_no']      ?? $existing['vehicle_no'],
                $input['transporter_name'] ?? $existing['transporter_name'],
                $input['transporter_id']  ?? $existing['transporter_id'],
                $grandTotal,
                $input['narration']       ?? $existing['narration'],
                $input['status']          ?? $existing['status'],
                $id,
            ]);

            // 5. Re-insert items & update delivered_qty
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, amount, description, order_item_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $newVoucherNo = $input['voucher_no'] ?? $existing['voucher_no'];

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $id,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['gsm'],
                    $item['dia'],
                    $item['count'],
                    $item['roll'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['amount'],
                    $item['description'],
                    $item['order_item_id'],
                ]);

                // Re-apply stock reduction with new quantities
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'delivery_note', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $newVoucherNo,
                        $user['id'],
                        'Delivery Note to ' . ($input['billing_name'] ?? $existing['billing_name'] ?? 'Customer'),
                    ]);
                }

                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET delivered_qty = delivered_qty + ?,
                            pending_qty   = GREATEST(0, ordered_qty - billed_qty - (delivered_qty + ?)),
                            status        = CASE
                                WHEN ordered_qty <= billed_qty + delivered_qty + ? THEN 'Completed'
                                WHEN delivered_qty + ? > 0                         THEN 'Partial'
                                ELSE status
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'], $item['quantity'],
                        $item['quantity'], $item['quantity'],
                        $item['order_item_id'],
                    ]);
                }
            }

            if ($orderId) {
                updateDNOrderStatus($pdo, $orderId);
            }

            $pdo->commit();

            ApiResponse::success([
                'id'          => $id,
                'voucher_no'  => $input['voucher_no'] ?? $existing['voucher_no'],
                'grand_total' => round($grandTotal, 2),
            ], 'Delivery Note updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ─────────────────────────────────────────────────────────
    // DELETE – Cancel Delivery Note
    // ─────────────────────────────────────────────────────────
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Delivery Note ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Delivery Note'");
        $stmt->execute([$id]);
        $dn = $stmt->fetch();

        if (!$dn) {
            ApiResponse::error('Delivery Note not found', 404);
        }
        if ($dn['status'] === 'cancelled') {
            ApiResponse::error('Delivery Note is already cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Block cancel if a Sales Invoice has already been raised from this DN
            $stmt = $pdo->prepare("
                SELECT COUNT(*) FROM vouchers
                WHERE delivery_note_id = ? AND voucher_type = 'Sales' AND status != 'cancelled'
            ");
            $stmt->execute([$id]);
            if ($stmt->fetchColumn() > 0) {
                ApiResponse::error('Cannot cancel — a Sales Invoice has already been raised from this Delivery Note. Cancel the Sales Invoice first.', 400);
            }

            // Reverse stock and delivered_qty
            $stmt = $pdo->prepare("SELECT product_id, quantity, order_item_id FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll();

            // Remove stock_movement entries for this DN
            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ? AND type = 'delivery_note'");
            $stmt->execute([$dn['voucher_no']]);

            foreach ($items as $item) {
                // Reverse stock
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }

                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET delivered_qty = GREATEST(0, delivered_qty - ?),
                            pending_qty   = GREATEST(0, ordered_qty - billed_qty - GREATEST(0, delivered_qty - ?)),
                            status        = CASE
                                WHEN GREATEST(0, delivered_qty - ?) = 0 AND billed_qty = 0 THEN 'Pending'
                                ELSE 'Partial'
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'], $item['quantity'],
                        $item['quantity'],
                        $item['order_item_id'],
                    ]);
                }
            }

            // Update order status
            if (!empty($dn['order_id'])) {
                updateDNOrderStatus($pdo, $dn['order_id']);
            }

            // Cancel the voucher
            $stmt = $pdo->prepare("UPDATE vouchers SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Delivery Note cancelled and quantities reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Delivery Note API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Delivery Note API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Recalculate and update order status based on item-level delivered+billed quantities.
 * Mirrors updateOrderStatus() in order.php / sales.php.
 */
function updateDNOrderStatus($pdo, $orderId) {
    $stmt = $pdo->prepare("
        SELECT
            SUM(ordered_qty)   as total_ordered,
            SUM(billed_qty)    as total_billed,
            SUM(delivered_qty) as total_delivered,
            SUM(pending_qty)   as total_pending
        FROM order_items
        WHERE order_id = ?
    ");
    $stmt->execute([$orderId]);
    $t = $stmt->fetch();

    $status = 'Open';
    if ($t['total_pending'] <= 0 && ($t['total_billed'] + $t['total_delivered']) > 0) {
        $status = 'Completed';
    } elseif (($t['total_billed'] + $t['total_delivered']) > 0) {
        $status = 'Partial';
    }

    $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$status, $orderId]);
}
