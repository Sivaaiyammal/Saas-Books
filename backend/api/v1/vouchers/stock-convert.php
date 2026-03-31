<?php
/**
 * Stock Conversion Voucher API
 *
 * Convert stock from multiple items to multiple items
 *
 * Examples:
 * - Product AB (20 KG) → Product CD (10 PCS)
 * - Product AB (10 KG) + Product XY (5 KG) → Product CD (100 PCS)
 * - Product AB (50 KG) → Product CD (20 PCS) + Product EF (30 PCS)
 *
 * Use cases:
 * - Raw material to finished goods
 * - Bulk to retail packing
 * - Manufacturing/Assembly
 * - Unit conversion between products
 *
 * Stock Movement:
 * - FROM items: Reduced (type: 'convert_out')
 * - TO items: Increased (type: 'convert_in')
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../helpers/voucher.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List conversions or get single
    if ($method === 'GET') {

        // Get single conversion with items
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT sc.*, u.name as created_by_name
                FROM stock_conversions sc
                LEFT JOIN users u ON sc.created_by = u.id
                WHERE sc.id = ?
            ");
            $stmt->execute([$id]);
            $conversion = $stmt->fetch();

            if (!$conversion) {
                ApiResponse::error('Stock conversion not found', 404);
            }

            // Get FROM items
            $stmt = $pdo->prepare("
                SELECT sci.*, i.name as item_name, i.item_code, u.name as unit_name, u.symbol as unit_symbol
                FROM stock_conversion_items sci
                INNER JOIN items i ON sci.item_id = i.id
                LEFT JOIN units u ON sci.unit_id = u.id
                WHERE sci.conversion_id = ? AND sci.direction = 'from'
            ");
            $stmt->execute([$id]);
            $conversion['from_items'] = $stmt->fetchAll();

            // Get TO items
            $stmt = $pdo->prepare("
                SELECT sci.*, i.name as item_name, i.item_code, u.name as unit_name, u.symbol as unit_symbol
                FROM stock_conversion_items sci
                INNER JOIN items i ON sci.item_id = i.id
                LEFT JOIN units u ON sci.unit_id = u.id
                WHERE sci.conversion_id = ? AND sci.direction = 'to'
            ");
            $stmt->execute([$id]);
            $conversion['to_items'] = $stmt->fetchAll();

            ApiResponse::success($conversion, 'Stock conversion retrieved successfully');
        }

        // List all conversions
        $search = $_GET['search'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $status = $_GET['status'] ?? '';
        $show_cancelled = isset($_GET['show_cancelled']) && $_GET['show_cancelled'] == '1';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["1=1"];
        $params = [];

        // Hide cancelled by default
        if ($status) {
            $where[] = "sc.status = ?";
            $params[] = $status;
        } elseif (!$show_cancelled) {
            $where[] = "sc.status != 'cancelled'";
        }

        if ($search) {
            $where[] = "(sc.voucher_no LIKE ? OR sc.narration LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($from_date) {
            $where[] = "sc.conversion_date >= ?";
            $params[] = $from_date;
        }

        if ($to_date) {
            $where[] = "sc.conversion_date <= ?";
            $params[] = $to_date;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM stock_conversions sc WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get conversions with item summaries
        $stmt = $pdo->prepare("
            SELECT sc.*,
                (SELECT GROUP_CONCAT(CONCAT(i.name, ' (', sci.qty, ')') SEPARATOR ', ')
                 FROM stock_conversion_items sci
                 INNER JOIN items i ON sci.item_id = i.id
                 WHERE sci.conversion_id = sc.id AND sci.direction = 'from') as from_items_summary,
                (SELECT GROUP_CONCAT(CONCAT(i.name, ' (', sci.qty, ')') SEPARATOR ', ')
                 FROM stock_conversion_items sci
                 INNER JOIN items i ON sci.item_id = i.id
                 WHERE sci.conversion_id = sc.id AND sci.direction = 'to') as to_items_summary
            FROM stock_conversions sc
            WHERE $whereClause
            ORDER BY sc.conversion_date DESC, sc.id DESC
            LIMIT ? OFFSET ?
        ");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $conversions = $stmt->fetchAll();

        ApiResponse::success([
            'conversions' => $conversions,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Stock conversions retrieved successfully');
    }

    // POST: Create new stock conversion
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Validation
        $errors = [];

        if (empty($input['from_items']) || !is_array($input['from_items']) || count($input['from_items']) < 1) {
            $errors['from_items'] = ['At least one FROM item is required'];
        }

        if (empty($input['to_items']) || !is_array($input['to_items']) || count($input['to_items']) < 1) {
            $errors['to_items'] = ['At least one TO item is required'];
        }

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $conversionDate = $input['conversion_date'] ?? date('Y-m-d');
        $narration = $input['narration'] ?? null;

        // Validate FROM items and check stock
        $validatedFromItems = [];
        foreach ($input['from_items'] as $idx => $item) {
            if (empty($item['item_id']) || empty($item['qty']) || $item['qty'] <= 0) {
                $errors["from_items.$idx"] = ['item_id and qty (> 0) are required'];
                continue;
            }

            $stmt = $pdo->prepare("
                SELECT i.*, u.name as unit_name, u.symbol as unit_symbol
                FROM items i
                LEFT JOIN units u ON i.unit_id = u.id
                WHERE i.id = ? AND i.status = 'active'
            ");
            $stmt->execute([$item['item_id']]);
            $itemData = $stmt->fetch();

            if (!$itemData) {
                $errors["from_items.$idx"] = ['Item not found'];
                continue;
            }

            // Check available stock
            $stmt = $pdo->prepare("
                SELECT
                    COALESCE(SUM(CASE WHEN type IN ('Opening', 'purchase', 'convert_in') THEN quantity ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN type IN ('sales', 'convert_out') THEN quantity ELSE 0 END), 0) as available_stock
                FROM stock_movement
                WHERE product_id = ?
            ");
            $stmt->execute([$item['item_id']]);
            $stockResult = $stmt->fetch();
            $availableStock = (float)$stockResult['available_stock'];

            if ($availableStock < $item['qty']) {
                $errors["from_items.$idx"] = ["Insufficient stock for {$itemData['name']}. Available: $availableStock {$itemData['unit_symbol']}"];
                continue;
            }

            $validatedFromItems[] = [
                'item_id' => (int)$item['item_id'],
                'qty' => (float)$item['qty'],
                'unit_id' => $itemData['unit_id'],
                'item_data' => $itemData
            ];
        }

        // Validate TO items
        $validatedToItems = [];
        foreach ($input['to_items'] as $idx => $item) {
            if (empty($item['item_id']) || empty($item['qty']) || $item['qty'] <= 0) {
                $errors["to_items.$idx"] = ['item_id and qty (> 0) are required'];
                continue;
            }

            $stmt = $pdo->prepare("
                SELECT i.*, u.name as unit_name, u.symbol as unit_symbol
                FROM items i
                LEFT JOIN units u ON i.unit_id = u.id
                WHERE i.id = ? AND i.status = 'active'
            ");
            $stmt->execute([$item['item_id']]);
            $itemData = $stmt->fetch();

            if (!$itemData) {
                $errors["to_items.$idx"] = ['Item not found'];
                continue;
            }

            $validatedToItems[] = [
                'item_id' => (int)$item['item_id'],
                'qty' => (float)$item['qty'],
                'unit_id' => $itemData['unit_id'],
                'item_data' => $itemData
            ];
        }

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $pdo->beginTransaction();

        try {
            // Generate voucher number
            [$fyStart, $fyEnd] = VoucherHelper::getFinancialYearRange($conversionDate);
            $stmt = $pdo->prepare("
                SELECT voucher_no
                FROM stock_conversions
                WHERE voucher_no LIKE 'SC-%'
                AND conversion_date BETWEEN ? AND ?
                ORDER BY id DESC
                LIMIT 1
            ");
            $stmt->execute([$fyStart, $fyEnd]);
            $lastVoucher = $stmt->fetch();

            if ($lastVoucher && preg_match('/(\\d+)$/', (string)$lastVoucher['voucher_no'], $matches)) {
                $nextNumber = (int)$matches[1] + 1;
            } else {
                $nextNumber = 1;
            }
            $voucherNo = 'SC-' . $nextNumber;

            // Create stock conversion header
            $stmt = $pdo->prepare("
                INSERT INTO stock_conversions (voucher_no, conversion_date, narration, status, created_by, created_at)
                VALUES (?, ?, ?, 'posted', ?, NOW())
            ");
            $stmt->execute([$voucherNo, $conversionDate, $narration, $user['id']]);
            $conversionId = $pdo->lastInsertId();

            // Process FROM items (reduce stock)
            foreach ($validatedFromItems as $item) {
                // Insert conversion item record
                $stmt = $pdo->prepare("
                    INSERT INTO stock_conversion_items (conversion_id, item_id, qty, unit_id, direction)
                    VALUES (?, ?, ?, ?, 'from')
                ");
                $stmt->execute([$conversionId, $item['item_id'], $item['qty'], $item['unit_id']]);

                // Update item stock (reduce)
                $stmt = $pdo->prepare("
                    UPDATE items SET opening_stock = opening_stock - ?
                    WHERE id = ? AND track_inventory = 1
                ");
                $stmt->execute([$item['qty'], $item['item_id']]);

                // Create stock movement
                $toItemsDesc = implode(', ', array_map(function($i) {
                    return "{$i['item_data']['name']} ({$i['qty']} {$i['item_data']['unit_symbol']})";
                }, $validatedToItems));

                $stmt = $pdo->prepare("
                    INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                    VALUES (?, ?, 'convert_out', ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $item['item_id'],
                    $item['qty'],
                    $voucherNo,
                    $user['id'],
                    "Stock converted to: $toItemsDesc",
                    $conversionDate . ' ' . date('H:i:s')
                ]);
            }

            // Process TO items (increase stock)
            foreach ($validatedToItems as $item) {
                // Insert conversion item record
                $stmt = $pdo->prepare("
                    INSERT INTO stock_conversion_items (conversion_id, item_id, qty, unit_id, direction)
                    VALUES (?, ?, ?, ?, 'to')
                ");
                $stmt->execute([$conversionId, $item['item_id'], $item['qty'], $item['unit_id']]);

                // Update item stock (increase)
                $stmt = $pdo->prepare("
                    UPDATE items SET opening_stock = opening_stock + ?
                    WHERE id = ? AND track_inventory = 1
                ");
                $stmt->execute([$item['qty'], $item['item_id']]);

                // Create stock movement
                $fromItemsDesc = implode(', ', array_map(function($i) {
                    return "{$i['item_data']['name']} ({$i['qty']} {$i['item_data']['unit_symbol']})";
                }, $validatedFromItems));

                $stmt = $pdo->prepare("
                    INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                    VALUES (?, ?, 'convert_in', ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $item['item_id'],
                    $item['qty'],
                    $voucherNo,
                    $user['id'],
                    "Stock converted from: $fromItemsDesc",
                    $conversionDate . ' ' . date('H:i:s')
                ]);
            }

            $pdo->commit();

            $response = [
                'id' => $conversionId,
                'voucher_no' => $voucherNo,
                'conversion_date' => $conversionDate,
                'from_items' => array_map(function($i) {
                    return [
                        'item_id' => $i['item_id'],
                        'name' => $i['item_data']['name'],
                        'qty' => $i['qty'],
                        'unit' => $i['item_data']['unit_symbol']
                    ];
                }, $validatedFromItems),
                'to_items' => array_map(function($i) {
                    return [
                        'item_id' => $i['item_id'],
                        'name' => $i['item_data']['name'],
                        'qty' => $i['qty'],
                        'unit' => $i['item_data']['unit_symbol']
                    ];
                }, $validatedToItems),
                'status' => 'posted'
            ];

            ApiResponse::success($response, 'Stock conversion created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel stock conversion
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
        }

        if (!$id) {
            ApiResponse::error('Conversion ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM stock_conversions WHERE id = ?");
        $stmt->execute([$id]);
        $conversion = $stmt->fetch();

        if (!$conversion) {
            ApiResponse::error('Stock conversion not found', 404);
        }

        if ($conversion['status'] === 'cancelled') {
            ApiResponse::error('Stock conversion is already cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Get all conversion items to reverse
            $stmt = $pdo->prepare("SELECT * FROM stock_conversion_items WHERE conversion_id = ?");
            $stmt->execute([$id]);
            $conversionItems = $stmt->fetchAll();

            foreach ($conversionItems as $item) {
                if ($item['direction'] === 'from') {
                    // Reverse: Add back to FROM items
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['qty'], $item['item_id']]);
                } else {
                    // Reverse: Reduce from TO items
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['qty'], $item['item_id']]);
                }
            }

            // Cancel the conversion
            $stmt = $pdo->prepare("UPDATE stock_conversions SET status = 'cancelled', updated_at = NOW() WHERE id = ?");
            $stmt->execute([$id]);

            // Delete stock movements for this conversion
            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ?");
            $stmt->execute([$conversion['voucher_no']]);

            $pdo->commit();

            ApiResponse::success(null, 'Stock conversion cancelled and stock reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Stock Conversion API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Stock Conversion API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
