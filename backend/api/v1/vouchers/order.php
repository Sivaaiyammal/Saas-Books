<?php
/**
 * Orders API - Sales Order / Purchase Order (NO STOCK EFFECT)
 *
 * Orders only track future stock movement, they do NOT touch actual inventory.
 * Logic: pending_qty = ordered_qty - billed_qty
 *
 * Use Cases:
 * - Sales Orders: Customer places order, track delivery pending
 * - Purchase Orders: Order placed with supplier, track receipt pending
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
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List all orders or get single order
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            // Get order with party details
            $stmt = $pdo->prepare("
                SELECT o.*,
                       l.name as party_name,
                       l.gst_number as party_gst,
                       l.phone as party_phone,
                       l.email as party_email,
                       l.address as party_address,
                       u.name as created_by_name
                FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                LEFT JOIN users u ON o.created_by = u.id
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            if (!$order) {
                ApiResponse::error('Order not found', 404);
            }

            // Get order items with related info
            $stmt = $pdo->prepare("
                SELECT oi.*,
                       i.item_code,
                       i.hsn_code,
                       un.name as unit_name,
                       un.symbol as unit_symbol,
                       t.name as tax_name,
                       t.rate as tax_rate,
                       g.name as godown_name
                FROM order_items oi
                LEFT JOIN items i ON oi.item_id = i.id
                LEFT JOIN units un ON oi.unit_id = un.id
                LEFT JOIN taxes t ON oi.tax_id = t.id
                LEFT JOIN godowns g ON oi.godown_id = g.id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC
            ");
            $stmt->execute([$id]);
            $order['items'] = $stmt->fetchAll();

            // Calculate order summary
            $order['summary'] = [
                'total_ordered_qty' => array_sum(array_column($order['items'], 'ordered_qty')),
                'total_billed_qty' => array_sum(array_column($order['items'], 'billed_qty')),
                'total_pending_qty' => array_sum(array_column($order['items'], 'pending_qty')),
                'is_fully_billed' => array_sum(array_column($order['items'], 'pending_qty')) == 0
            ];

            ApiResponse::success($order, 'Order retrieved successfully');
        }

        // List all orders with filters
        $search = $_GET['search'] ?? '';
        $order_type = $_GET['order_type'] ?? '';
        $status = $_GET['status'] ?? '';
        $party_id = $_GET['party_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $pending_only = isset($_GET['pending_only']) && $_GET['pending_only'] === 'true';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["o.status != 'Cancelled'"];
        $params = [];

        if ($search) {
            $where[] = "(o.order_no LIKE ? OR l.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($order_type && in_array($order_type, ['Sales', 'Purchase'])) {
            $where[] = "o.order_type = ?";
            $params[] = $order_type;
        }

        if ($status && in_array($status, ['Open', 'Partial', 'Completed', 'Cancelled'])) {
            $where[] = "o.status = ?";
            $params[] = $status;
        }

        if ($party_id) {
            $where[] = "o.party_ledger_id = ?";
            $params[] = (int)$party_id;
        }

        if ($from_date) {
            $where[] = "o.order_date >= ?";
            $params[] = $from_date;
        }

        if ($to_date) {
            $where[] = "o.order_date <= ?";
            $params[] = $to_date;
        }

        if ($pending_only) {
            $where[] = "o.status IN ('Open', 'Partial')";
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM orders o
            LEFT JOIN ledgers l ON o.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get orders with pending item counts
        $stmt = $pdo->prepare("
            SELECT o.*,
                   l.name as party_name,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.pending_qty > 0) as pending_items,
                   (SELECT SUM(pending_qty) FROM order_items oi WHERE oi.order_id = o.id) as total_pending_qty
            FROM orders o
            LEFT JOIN ledgers l ON o.party_ledger_id = l.id
            WHERE $whereClause
            ORDER BY o.order_date DESC, o.id DESC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        ApiResponse::success([
            'orders' => $orders,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Orders retrieved successfully');
    }

    // POST: Create new order
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Validation rules
        $rules = [
            'order_type' => 'required',
            'party_ledger_id' => 'required',
            'order_date' => 'required',
            'items' => 'required'
        ];

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Validate order_type
        if (!in_array($input['order_type'], ['Sales', 'Purchase'])) {
            ApiResponse::validationError(['order_type' => ['Order type must be Sales or Purchase']]);
        }

        // Validate date format
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['order_date'])) {
            ApiResponse::validationError(['order_date' => ['Invalid date format (use Y-m-d)']]);
        }

        // Validate items array
        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        // Validate party ledger exists
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE id = ? AND status = 'active'");
        $stmt->execute([$input['party_ledger_id']]);
        if (!$stmt->fetch()) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // Generate order number
            $prefix = $input['order_type'] === 'Sales' ? 'SO' : 'PO';
            $stmt = $pdo->query("SELECT MAX(id) FROM orders");
            $maxId = $stmt->fetchColumn() ?? 0;
            $orderNo = isset($input['order_no']) && $input['order_no']
                ? $input['order_no']
                : $prefix . '-' . str_pad($maxId + 1, 6, '0', STR_PAD_LEFT);

            // Calculate totals from items
            $totalQty = 0;
            $totalAmount = 0;
            $totalDiscount = 0;
            $totalTax = 0;

            foreach ($input['items'] as $item) {
                $qty = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                $rate = floatval($item['rate'] ?? 0);
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $taxAmt = floatval($item['tax_amount'] ?? 0);
                $amount = floatval($item['amount'] ?? ($qty * $rate - $discountAmt + $taxAmt));

                $totalQty += $qty;
                $totalAmount += ($qty * $rate);
                $totalDiscount += $discountAmt;
                $totalTax += $taxAmt;
            }

            $grandTotal = $totalAmount - $totalDiscount + $totalTax;

            // Create order
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    company_id, order_type, order_no, order_date, expected_date,
                    party_ledger_id, billing_address, shipping_address,
                    total_qty, total_amount, discount_amount, tax_amount, grand_total,
                    narration, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $input['company_id'] ?? null,
                $input['order_type'],
                $orderNo,
                $input['order_date'],
                $input['expected_date'] ?? null,
                $input['party_ledger_id'],
                $input['billing_address'] ?? null,
                $input['shipping_address'] ?? null,
                $totalQty,
                $totalAmount,
                $totalDiscount,
                $totalTax,
                $grandTotal,
                $input['narration'] ?? null,
                'Open',
                $user['id']
            ]);

            $orderId = $pdo->lastInsertId();

            // Insert order items
            $stmtItem = $pdo->prepare("
                INSERT INTO order_items (
                    order_id, item_id, item_name, unit_id,
                    ordered_qty, billed_qty, pending_qty, rate,
                    discount_percent, discount_amount, tax_id, tax_percent, tax_amount,
                    amount, godown_id, description, status
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            ");

            foreach ($input['items'] as $item) {
                // Validate item exists
                $stmt = $pdo->prepare("SELECT id, name FROM items WHERE id = ?");
                $stmt->execute([$item['item_id']]);
                $itemData = $stmt->fetch();
                if (!$itemData) {
                    throw new Exception("Item with ID {$item['item_id']} not found");
                }

                $orderedQty = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                $rate = floatval($item['rate'] ?? 0);
                $discountPercent = floatval($item['discount_percent'] ?? 0);
                $discountAmount = floatval($item['discount_amount'] ?? 0);
                $taxPercent = floatval($item['tax_percent'] ?? 0);
                $taxAmount = floatval($item['tax_amount'] ?? 0);
                $amount = floatval($item['amount'] ?? ($orderedQty * $rate - $discountAmount + $taxAmount));

                // pending_qty = ordered_qty (since billed_qty starts at 0)
                $pendingQty = $orderedQty;

                $stmtItem->execute([
                    $orderId,
                    $item['item_id'],
                    $item['item_name'] ?? $itemData['name'],
                    $item['unit_id'] ?? null,
                    $orderedQty,
                    $pendingQty,  // pending_qty = ordered_qty initially
                    $rate,
                    $discountPercent,
                    $discountAmount,
                    $item['tax_id'] ?? null,
                    $taxPercent,
                    $taxAmount,
                    $amount,
                    $item['godown_id'] ?? null,
                    $item['description'] ?? null
                ]);
            }

            $pdo->commit();

            // Get created order with items
            $stmt = $pdo->prepare("
                SELECT o.*, l.name as party_name
                FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                WHERE o.id = ?
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();

            $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $stmt->execute([$orderId]);
            $order['items'] = $stmt->fetchAll();

            ApiResponse::success($order, 'Order created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update order
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Order ID is required');
        }

        $id = (int)$input['id'];

        // Check if order exists
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Order not found', 404);
        }

        // Cannot edit completed or cancelled orders
        if (in_array($existing['status'], ['Completed', 'Cancelled'])) {
            ApiResponse::error('Cannot modify completed or cancelled orders', 400);
        }

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // If items are provided, recalculate and update
            if (isset($input['items']) && is_array($input['items']) && !empty($input['items'])) {
                $totalQty = 0;
                $totalAmount = 0;
                $totalDiscount = 0;
                $totalTax = 0;

                // Get existing billed quantities for each item
                $stmt = $pdo->prepare("SELECT item_id, billed_qty FROM order_items WHERE order_id = ?");
                $stmt->execute([$id]);
                $existingBilled = [];
                while ($row = $stmt->fetch()) {
                    $existingBilled[$row['item_id']] = floatval($row['billed_qty']);
                }

                // Delete old items
                $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                $stmt->execute([$id]);

                // Insert new items
                $stmtItem = $pdo->prepare("
                    INSERT INTO order_items (
                        order_id, item_id, item_name, unit_id,
                        ordered_qty, billed_qty, pending_qty, rate,
                        discount_percent, discount_amount, tax_id, tax_percent, tax_amount,
                        amount, godown_id, description, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");

                foreach ($input['items'] as $item) {
                    // Validate item
                    $stmt = $pdo->prepare("SELECT id, name FROM items WHERE id = ?");
                    $stmt->execute([$item['item_id']]);
                    $itemData = $stmt->fetch();
                    if (!$itemData) {
                        throw new Exception("Item with ID {$item['item_id']} not found");
                    }

                    $orderedQty = floatval($item['ordered_qty'] ?? $item['quantity'] ?? 0);
                    $billedQty = $existingBilled[$item['item_id']] ?? 0;
                    $pendingQty = max(0, $orderedQty - $billedQty);
                    $rate = floatval($item['rate'] ?? 0);
                    $discountPercent = floatval($item['discount_percent'] ?? 0);
                    $discountAmount = floatval($item['discount_amount'] ?? 0);
                    $taxPercent = floatval($item['tax_percent'] ?? 0);
                    $taxAmount = floatval($item['tax_amount'] ?? 0);
                    $amount = floatval($item['amount'] ?? ($orderedQty * $rate - $discountAmount + $taxAmount));

                    // Determine item status
                    $itemStatus = 'Pending';
                    if ($billedQty > 0 && $pendingQty > 0) {
                        $itemStatus = 'Partial';
                    } elseif ($pendingQty == 0 && $billedQty > 0) {
                        $itemStatus = 'Completed';
                    }

                    $stmtItem->execute([
                        $id,
                        $item['item_id'],
                        $item['item_name'] ?? $itemData['name'],
                        $item['unit_id'] ?? null,
                        $orderedQty,
                        $billedQty,
                        $pendingQty,
                        $rate,
                        $discountPercent,
                        $discountAmount,
                        $item['tax_id'] ?? null,
                        $taxPercent,
                        $taxAmount,
                        $amount,
                        $item['godown_id'] ?? null,
                        $item['description'] ?? null,
                        $itemStatus
                    ]);

                    $totalQty += $orderedQty;
                    $totalAmount += ($orderedQty * $rate);
                    $totalDiscount += $discountAmount;
                    $totalTax += $taxAmount;
                }

                $grandTotal = $totalAmount - $totalDiscount + $totalTax;

                // Update order with new totals
                $stmt = $pdo->prepare("
                    UPDATE orders SET
                        order_date = ?,
                        expected_date = ?,
                        party_ledger_id = ?,
                        billing_address = ?,
                        shipping_address = ?,
                        total_qty = ?,
                        total_amount = ?,
                        discount_amount = ?,
                        tax_amount = ?,
                        grand_total = ?,
                        narration = ?
                    WHERE id = ?
                ");

                $stmt->execute([
                    $input['order_date'] ?? $existing['order_date'],
                    $input['expected_date'] ?? $existing['expected_date'],
                    $input['party_ledger_id'] ?? $existing['party_ledger_id'],
                    $input['billing_address'] ?? $existing['billing_address'],
                    $input['shipping_address'] ?? $existing['shipping_address'],
                    $totalQty,
                    $totalAmount,
                    $totalDiscount,
                    $totalTax,
                    $grandTotal,
                    $input['narration'] ?? $existing['narration'],
                    $id
                ]);
            } else {
                // Update order details only (no items)
                $stmt = $pdo->prepare("
                    UPDATE orders SET
                        order_date = ?,
                        expected_date = ?,
                        party_ledger_id = ?,
                        billing_address = ?,
                        shipping_address = ?,
                        narration = ?
                    WHERE id = ?
                ");

                $stmt->execute([
                    $input['order_date'] ?? $existing['order_date'],
                    $input['expected_date'] ?? $existing['expected_date'],
                    $input['party_ledger_id'] ?? $existing['party_ledger_id'],
                    $input['billing_address'] ?? $existing['billing_address'],
                    $input['shipping_address'] ?? $existing['shipping_address'],
                    $input['narration'] ?? $existing['narration'],
                    $id
                ]);
            }

            // Update order status based on items
            updateOrderStatus($pdo, $id);

            $pdo->commit();

            // Get updated order
            $stmt = $pdo->prepare("
                SELECT o.*, l.name as party_name
                FROM orders o
                LEFT JOIN ledgers l ON o.party_ledger_id = l.id
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();

            $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $stmt->execute([$id]);
            $order['items'] = $stmt->fetchAll();

            ApiResponse::success($order, 'Order updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel order
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Order ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) {
            ApiResponse::error('Order not found', 404);
        }

        // Check if any items have been billed
        $stmt = $pdo->prepare("SELECT SUM(billed_qty) as total_billed FROM order_items WHERE order_id = ?");
        $stmt->execute([$id]);
        $totalBilled = $stmt->fetchColumn();

        if ($totalBilled > 0) {
            ApiResponse::error('Cannot cancel order with billed items. Total billed quantity: ' . $totalBilled, 400);
        }

        // Cancel the order
        $stmt = $pdo->prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?");
        $stmt->execute([$id]);

        // Cancel all order items
        $stmt = $pdo->prepare("UPDATE order_items SET status = 'Cancelled', pending_qty = 0 WHERE order_id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Order cancelled successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Orders API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request');
} catch (Exception $e) {
    error_log("Orders API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred: ' . $e->getMessage());
}

/**
 * Update order status based on item fulfillment
 */
function updateOrderStatus($pdo, $orderId) {
    $stmt = $pdo->prepare("
        SELECT
            SUM(ordered_qty)                      as total_ordered,
            SUM(billed_qty)                       as total_billed,
            SUM(delivered_qty)                    as total_delivered,
            SUM(pending_qty)                      as total_pending
        FROM order_items
        WHERE order_id = ?
    ");
    $stmt->execute([$orderId]);
    $totals = $stmt->fetch();

    $fulfilled = floatval($totals['total_billed']) + floatval($totals['total_delivered']);
    $pending   = floatval($totals['total_pending']);

    $status = 'Open';
    if ($pending <= 0 && $fulfilled > 0) {
        $status = 'Completed';
    } elseif ($fulfilled > 0) {
        $status = 'Partial';
    }

    $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$status, $orderId]);
}
