<?php
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

// Authenticate user
$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List all items or get single item
    if ($method === 'GET') {
        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        if ($company_id <= 0) {
            ApiResponse::error('Company ID is required', 400);
        }

        // Get single item by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    i.id as sno,
                    i.name,
                    i.lot_no,
                    i.count as counts,
                    i.colour,
                    i.cones,
                    i.grams,
                    i.gross_weight,
                    i.net_weight,
                    i.opening_stock,
                    i.opening_stock as quantity,
                    i.created_at
                FROM items i
                WHERE i.id = ? AND i.company_id = ? AND i.status != 'inactive'
            ");

            $stmt->execute([$id, $company_id]);
            $item = $stmt->fetch();

            if (!$item) {
                ApiResponse::error('Item not found', 404);
            }

            ApiResponse::success($item, 'Item retrieved successfully');
        }

        // List all items
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["i.status != 'inactive'", "i.company_id = ?"];
        $params = [$company_id];

        if ($search) {
            $where[] = "(i.lot_no LIKE ? OR i.count LIKE ? OR i.colour LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items i WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get items
        $stmt = $pdo->prepare("
            SELECT
                i.id as sno,
                i.name,
                i.lot_no,
                i.count as counts,
                i.colour,
                i.cones,
                i.grams,
                i.gross_weight,
                i.net_weight,
                i.opening_stock,
                i.opening_stock as quantity,
                i.created_at
            FROM items i
            WHERE $whereClause
            ORDER BY i.id ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        ApiResponse::success([
            'items' => $items,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Items retrieved successfully');
    }

    // POST: Create new item
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $isListArray = is_array($input) && array_keys($input) === range(0, count($input) - 1);
        $isBatchByItemsKey = is_array($input) && isset($input['items']) && is_array($input['items']);

        $batchItems = [];
        $defaultCompanyId = null;

        if ($isBatchByItemsKey) {
            $batchItems = $input['items'];
            $defaultCompanyId = isset($input['company_id']) ? (int)$input['company_id'] : null;
        } elseif ($isListArray) {
            $batchItems = $input;
        } else {
            $batchItems = [$input];
        }

        if (empty($batchItems)) {
            ApiResponse::validationError([
                'items' => ['At least one item is required']
            ]);
        }

        $rules = [
            'company_id' => 'required|integer',
            'lot_no' => 'required|max:50',
            'counts' => 'optional|max:50',
            'colour' => 'optional|max:100',
            'cones' => 'required',
            'grams' => 'required',
            'gross_weight' => 'required',
            'quantity' => 'optional'
        ];

        $validatedItems = [];
        $companyIds = [];
        $validationErrors = [];

        foreach ($batchItems as $index => $rawItem) {
            if (!is_array($rawItem)) {
                $validationErrors[(string)$index] = ['item' => ['Each item must be an object']];
                continue;
            }

            $itemInput = $rawItem;
            if (!isset($itemInput['company_id']) && $defaultCompanyId !== null) {
                $itemInput['company_id'] = $defaultCompanyId;
            }

            $errors = Validator::validate($itemInput, $rules);
            if (!empty($errors)) {
                $validationErrors[(string)$index] = $errors;
                continue;
            }

            $company_id = (int)$itemInput['company_id'];
            $lot_no = trim($itemInput['lot_no']);
            $counts = isset($itemInput['counts']) ? trim((string)$itemInput['counts']) : null;
            $colour = isset($itemInput['colour']) ? trim((string)$itemInput['colour']) : null;
            $cones = (int)$itemInput['cones'];
            $grams = floatval($itemInput['grams']);
            $gross_weight = floatval($itemInput['gross_weight']);

            $net_weight = round($gross_weight-(($cones * $grams)/1000), 3);
            $quantity = array_key_exists('quantity', $itemInput)
                ? floatval($itemInput['quantity'])
                : $net_weight;

            $nameParts = [$lot_no];
            if (!empty($colour)) {
                $nameParts[] = $colour;
            }
            if (!empty($counts)) {
                $nameParts[] = $counts . ' counts';
            }
            $name = implode('_', $nameParts);

            $validatedItems[] = [
                'company_id' => $company_id,
                'name' => $name,
                'lot_no' => $lot_no,
                'counts' => $counts,
                'colour' => $colour,
                'cones' => $cones,
                'grams' => $grams,
                'gross_weight' => $gross_weight,
                'net_weight' => $net_weight,
                'quantity' => $quantity

            ];

            $companyIds[$company_id] = true;
        }

        if (!empty($validationErrors)) {
            ApiResponse::validationError([
                'items' => $validationErrors
            ]);
        }

        foreach (array_keys($companyIds) as $company_id) {
            $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$company_id]);
            if (!$stmt->fetch()) {
                ApiResponse::error('Company not found or inactive', 400);
            }
        }

        $pdo->beginTransaction();

        try {
            $findExistingStmt = $pdo->prepare("SELECT
                    id,
                    opening_stock,
                    net_weight
                FROM items
                WHERE company_id = ?
                  AND lot_no = ?
                  AND IFNULL(`count`, '') = IFNULL(?, '')
                  AND IFNULL(colour, '') = IFNULL(?, '')
                  AND status != 'inactive'
                LIMIT 1");

            $mergeQtyStmt = $pdo->prepare("UPDATE items
                SET opening_stock = opening_stock + ?,
                    net_weight = net_weight + ?
                WHERE id = ? AND company_id = ?");

            $insertStmt = $pdo->prepare("
                INSERT INTO items
                     (company_id, name, lot_no, count, colour, cones, grams, gross_weight, net_weight, opening_stock, track_inventory)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ");

            $fetchStmt = $pdo->prepare("
                SELECT
                    i.id as sno,
                    i.lot_no,
                    i.count as counts,
                    i.colour,
                    i.cones,
                    i.grams,
                    i.gross_weight,
                    i.net_weight,
                    i.opening_stock,
                    i.opening_stock as quantity,
                    i.created_at
                FROM items i
                WHERE i.id = ? AND i.company_id = ?
            ");

            $createdItems = [];

            foreach ($validatedItems as $item) {
                $findExistingStmt->execute([
                    $item['company_id'],
                    $item['lot_no'],
                    $item['counts'],
                    $item['colour']
                ]);
                $existing = $findExistingStmt->fetch();

                if ($existing) {
                    $itemId = (int)$existing['id'];
                    $mergeQtyStmt->execute([
                        $item['quantity'],
                        $item['net_weight'],
                        $itemId,
                        $item['company_id']
                    ]);
                } else {
                    $insertStmt->execute([
                        $item['company_id'],
                        $item['name'],
                        $item['lot_no'],
                        $item['counts'],
                        $item['colour'],
                        $item['cones'],
                        $item['grams'],
                        $item['gross_weight'],
                        $item['net_weight'],
                        $item['quantity']
                    ]);

                    $itemId = (int)$pdo->lastInsertId();
                }

                $fetchStmt->execute([$itemId, $item['company_id']]);
                $createdItems[] = $fetchStmt->fetch();
            }

            $pdo->commit();

            if (count($createdItems) === 1 && !$isBatchByItemsKey && !$isListArray) {
                ApiResponse::success($createdItems[0], 'Item created successfully', 201);
            }

            ApiResponse::success([
                'items' => $createdItems,
                'count' => count($createdItems)
            ], 'Items created successfully', 201);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    // PUT: Update item
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Item ID is required');
        }

        if (!isset($input['company_id'])) {
            ApiResponse::error('Company ID is required', 400);
        }

        $id = (int)$input['id'];
        $company_id = (int)$input['company_id'];

        // Check if item exists
        $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ? AND company_id = ? AND status != 'inactive'");
        $stmt->execute([$id, $company_id]);
        $existingItem = $stmt->fetch();

        if (!$existingItem) {
            ApiResponse::error('Item not found', 404);
        }

        $lot_no = isset($input['lot_no']) ? trim($input['lot_no']) : $existingItem['lot_no'];
        $counts = array_key_exists('counts', $input) ? $input['counts'] : $existingItem['count'];
        $colour = array_key_exists('colour', $input) ? $input['colour'] : $existingItem['colour'];
        $cones = isset($input['cones']) ? (int)$input['cones'] : (int)$existingItem['cones'];
        $grams = isset($input['grams']) ? floatval($input['grams']) : floatval($existingItem['grams']);
        $gross_weight = isset($input['gross_weight']) ? floatval($input['gross_weight']) : floatval($existingItem['gross_weight']);
        $quantity = array_key_exists('quantity', $input) ? floatval($input['quantity']) : floatval($existingItem['opening_stock']);

        // Auto-calculate net_weight: (Cones * Grams) - Gross Weight
        $net_weight = round(($cones * $grams) - $gross_weight, 3);

        $nameParts = [$lot_no];
        if (!empty($colour)) {
            $nameParts[] = $colour;
        }
        if (!empty($counts)) {
            $nameParts[] = $counts . ' counts';
        }
        $name = implode('_', $nameParts);

        // Update item
        $stmt = $pdo->prepare("
            UPDATE items
                SET name = ?, lot_no = ?, count = ?, colour = ?, cones = ?, grams = ?, gross_weight = ?, net_weight = ?, opening_stock = ?
            WHERE id = ? AND company_id = ?
        ");

        $stmt->execute([
            $name, $lot_no, $counts, $colour, $cones, $grams, $gross_weight, $net_weight, $quantity, $id, $company_id
        ]);

        // Get updated item
        $stmt = $pdo->prepare("
            SELECT
                i.id as sno,
                i.lot_no,
                i.count as counts,
                i.colour,
                i.cones,
                i.grams,
                i.gross_weight,
                i.net_weight,
                i.opening_stock,
                i.opening_stock as quantity
            FROM items i
            WHERE i.id = ? AND i.company_id = ?
        ");
        $stmt->execute([$id, $company_id]);
        $item = $stmt->fetch();

        ApiResponse::success($item, 'Item updated successfully');
    }

    // DELETE: Delete item
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Item ID is required');
        }

        $company_id = isset($input['company_id']) ? (int)$input['company_id'] : (isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0);
        if ($company_id <= 0) {
            ApiResponse::error('Company ID is required', 400);
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if item exists
        $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ? AND company_id = ? AND status != 'inactive'");
        $stmt->execute([$id, $company_id]);
        $item = $stmt->fetch();

        if (!$item) {
            ApiResponse::error('Item not found', 404);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE items SET status = 'inactive' WHERE id = ? AND company_id = ?");
        $stmt->execute([$id, $company_id]);

        ApiResponse::success(null, 'Item deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Items V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Items V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
