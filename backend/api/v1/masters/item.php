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
        // Get single item by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    i.*,
                    i.variant_of,
                    ig.name as item_group_name,
                    ig.group_type as item_group_type,
                    u.name as unit_name,
                    u.symbol as unit_symbol,
                    t.name as tax_name,
                    t.rate as tax_rate
                FROM items i
                LEFT JOIN item_groups ig ON i.item_group_id = ig.id
                LEFT JOIN units u ON i.unit_id = u.id
                LEFT JOIN taxes t ON i.tax_id = t.id
                WHERE i.id = ? AND i.status != 'inactive'
            ");

            $stmt->execute([$id]);
            $item = $stmt->fetch();

            if (!$item) {
                ApiResponse::error('Item not found', 404);
            }

            // Convert boolean fields
            $item['is_service'] = (bool)$item['is_service'];
            $item['track_inventory'] = (bool)$item['track_inventory'];

            // Get variants if this is a parent item
            $stmt = $pdo->prepare("
                SELECT i.*, u.name as unit_name
                FROM items i
                LEFT JOIN units u ON i.unit_id = u.id
                WHERE i.variant_of = ? AND i.status != 'inactive'
            ");
            $stmt->execute([$id]);
            $variants = $stmt->fetchAll();
            if ($variants) {
                $item['variants'] = $variants;
            }

            ApiResponse::success($item, 'Item retrieved successfully');
        }

        // List all items
        $search = $_GET['search'] ?? '';
        $item_group_id = $_GET['item_group_id'] ?? '';
        $status = $_GET['status'] ?? '';
        $is_service = $_GET['is_service'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["i.status != 'inactive'"];
        $params = [];

        if ($search) {
            $where[] = "(i.name LIKE ? OR i.alias LIKE ? OR i.item_code LIKE ? OR i.description LIKE ? OR i.colour LIKE ? OR i.gsm LIKE ? OR i.dia LIKE ? OR i.count LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($item_group_id) {
            $where[] = "i.item_group_id = ?";
            $params[] = (int)$item_group_id;
        }

        if ($status && in_array($status, ['active', 'inactive', 'discontinued'])) {
            $where[] = "i.status = ?";
            $params[] = $status;
        }

        if ($is_service !== '') {
            $where[] = "i.is_service = ?";
            $params[] = (int)$is_service;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items i WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get items
        $stmt = $pdo->prepare("
            SELECT
                i.*,
                ig.name as item_group_name,
                u.name as unit_name,
                u.symbol as unit_symbol,
                t.name as tax_name,
                t.rate as tax_rate
            FROM items i
            LEFT JOIN item_groups ig ON i.item_group_id = ig.id
            LEFT JOIN units u ON i.unit_id = u.id
            LEFT JOIN taxes t ON i.tax_id = t.id
            WHERE $whereClause
            ORDER BY i.name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        // Convert boolean fields
        foreach ($items as &$item) {
            $item['is_service'] = (bool)$item['is_service'];
            $item['track_inventory'] = (bool)$item['track_inventory'];
        }

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

        $rules = [
            'item_code' => 'optional|alpha_num_dash_space|max:100',
            'name' => 'required|min:2|max:200',
            'item_group_id' => 'optional',
            'unit_id' => 'optional',
            'hsn_code' => 'optional',
            'alias' => 'optional',
            'description' => 'optional',
            'gsm' => 'optional',
            'count' => 'optional',
            'dia' => 'optional',
            'colour' => 'optional',
            'opening_stock' => 'optional',
            'opening_value' => 'optional',
            'opening_rate' => 'optional',
            'minimum_level' => 'optional',
            'maximum_level' => 'optional',
            'reorder_level' => 'optional',
            'standard_cost' => 'optional',
            'standard_price' => 'optional',
            'tax_id' => 'optional',
            'is_service' => 'optional',
            'track_inventory' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $alias = isset($input['alias']) ? trim($input['alias']) : null;
        $description = $input['description'] ?? null;
        $item_code = isset($input['item_code']) ? trim($input['item_code']) : null;
        $hsn_code = isset($input['hsn_code']) ? trim($input['hsn_code']) : null;
        $gsm = isset($input['gsm']) ? trim($input['gsm']) : null;
        $count = isset($input['count']) ? trim($input['count']) : null;
        $dia = isset($input['dia']) ? trim($input['dia']) : null;
        $colour = isset($input['colour']) ? trim($input['colour']) : null;
        $item_group_id = isset($input['item_group_id']) ? (int)$input['item_group_id'] : null;
        $unit_id = isset($input['unit_id']) ? (int)$input['unit_id'] : null;
        $opening_stock = isset($input['opening_stock']) ? floatval($input['opening_stock']) : 0.000;
        $opening_value = isset($input['opening_value']) ? floatval($input['opening_value']) : 0.00;
        $opening_rate = isset($input['opening_rate']) ? floatval($input['opening_rate']) : 0.00;
        $minimum_level = isset($input['minimum_level']) ? floatval($input['minimum_level']) : 0.000;
        $maximum_level = isset($input['maximum_level']) ? floatval($input['maximum_level']) : 0.000;
        $reorder_level = isset($input['reorder_level']) ? floatval($input['reorder_level']) : 0.000;
        $standard_cost = isset($input['standard_cost']) ? floatval($input['standard_cost']) : 0.00;
        $standard_price = isset($input['standard_price']) ? floatval($input['standard_price']) : 0.00;
        $tax_id = isset($input['tax_id']) ? (int)$input['tax_id'] : null;
        $is_service = isset($input['is_service']) ? (int)$input['is_service'] : 0;
        $track_inventory = isset($input['track_inventory']) ? (int)$input['track_inventory'] : 1;
        $variants = isset($input['variants']) && is_array($input['variants']) ? $input['variants'] : [];

        // Check if item_code is unique (if provided)
        if ($item_code) {
            $stmt = $pdo->prepare("SELECT id FROM items WHERE item_code = ? AND status != 'inactive'");
            $stmt->execute([$item_code]);
            if ($stmt->fetch()) {
                ApiResponse::validationError([
                    'item_code' => ['Item with this code already exists']
                ]);
            }
        }

        // Check if item_group exists
        if ($item_group_id) {
            $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND status = 'active'");
            $stmt->execute([$item_group_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'item_group_id' => ['Item group does not exist']
                ]);
            }
        }

        // Check if unit exists
        if ($unit_id) {
            $stmt = $pdo->prepare("SELECT id FROM units WHERE id = ? AND status = 'active'");
            $stmt->execute([$unit_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'unit_id' => ['Unit does not exist']
                ]);
            }
        }

        // Check if tax exists
        if ($tax_id) {
            $stmt = $pdo->prepare("SELECT id FROM taxes WHERE id = ? AND status = 'active'");
            $stmt->execute([$tax_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'tax_id' => ['Tax does not exist']
                ]);
            }
        }

        $pdo->beginTransaction();

        try {
        // Insert item
        $stmt = $pdo->prepare("
            INSERT INTO items (
                item_group_id, name, colour, alias, description, item_code, hsn_code,
                gsm, count, dia, unit_id, opening_stock, opening_value, opening_rate,
                minimum_level, maximum_level, reorder_level,
                standard_cost, standard_price, tax_id,
                is_service, track_inventory, variant_of
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $item_group_id, $name, $colour, $alias, $description, $item_code, $hsn_code,
            $gsm, $count, $dia, $unit_id, $opening_stock, $opening_value, $opening_rate,
            $minimum_level, $maximum_level, $reorder_level,
            $standard_cost, $standard_price, $tax_id,
            $is_service, $track_inventory, null
        ]);

        $itemId = $pdo->lastInsertId();

        // Add opening stock to stock_movement if > 0
        if ($opening_stock > 0) {
            $stmtMovement = $pdo->prepare("
                INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                VALUES (?, ?, 'Opening', ?, ?, 'Opening stock on item creation', NOW())
            ");
            $stmtMovement->execute([$itemId, $opening_stock, 'ITEM-' . $itemId, $user['id']]);
        }

        // Handle Variants Creation
        if (!empty($variants)) {
            foreach ($variants as $idx => $variant) {
                // Generate Variant Name (e.g., "Cotton Fabric - Red 140GSM")
                $vGsm = $variant['gsm'] ?? $gsm;
                $vDia = $variant['dia'] ?? $dia;
                $vCount = $variant['count'] ?? $count;
                $vColour = $variant['colour'] ?? $colour;

                $vName = $variant['name'] ?? ($name . ' - ' . ($vColour ?? '') . ' ' . ($vGsm ? $vGsm . 'GSM' : ''));
                $vQty = isset($variant['opening_stock']) ? floatval($variant['opening_stock']) : 0;
                $vRate = isset($variant['opening_rate']) ? floatval($variant['opening_rate']) : $opening_rate;
                $vValue = $vQty * $vRate;
                $vItemCode = $variant['item_code'] ?? ($item_code ? $item_code . '-' . ($idx + 1) : null);

                $stmt->execute([
                    $item_group_id, $vName, $vColour, $alias, $description, $vItemCode, $hsn_code,
                    $vGsm, $vCount, $vDia, $unit_id, $vQty, $vValue, $vRate,
                    $minimum_level, $maximum_level, $reorder_level,
                    $standard_cost, $standard_price, $tax_id,
                    $is_service, $track_inventory, $itemId // Link to Parent
                ]);

                // Add opening stock to stock_movement for variant if > 0
                $variantId = $pdo->lastInsertId();
                if ($vQty > 0) {
                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'Opening', ?, ?, 'Opening stock on variant creation', NOW())
                    ");
                    $stmtMovement->execute([$variantId, $vQty, 'ITEM-' . $variantId, $user['id']]);
                }
            }
        }

        $pdo->commit();

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        // Get created item
        $stmt = $pdo->prepare("
            SELECT
                i.*,
                ig.name as item_group_name,
                u.name as unit_name,
                u.symbol as unit_symbol,
                t.name as tax_name,
                t.rate as tax_rate
            FROM items i
            LEFT JOIN item_groups ig ON i.item_group_id = ig.id
            LEFT JOIN units u ON i.unit_id = u.id
            LEFT JOIN taxes t ON i.tax_id = t.id
            WHERE i.id = ?
        ");
        $stmt->execute([$itemId]);
        $item = $stmt->fetch();

        $item['is_service'] = (bool)$item['is_service'];
        $item['track_inventory'] = (bool)$item['track_inventory'];

        ApiResponse::success($item, 'Item created successfully', 201);
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

        $id = (int)$input['id'];

        // Check if item exists
        $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ? AND status != 'inactive'");
        $stmt->execute([$id]);
        $existingItem = $stmt->fetch();

        if (!$existingItem) {
            ApiResponse::error('Item not found', 404);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingItem['name'];
        $alias = isset($input['alias']) ? trim($input['alias']) : $existingItem['alias'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingItem['description'];
        $item_code = isset($input['item_code']) ? trim($input['item_code']) : $existingItem['item_code'];
        $hsn_code = isset($input['hsn_code']) ? trim($input['hsn_code']) : $existingItem['hsn_code'];
        $gsm = array_key_exists('gsm', $input) ? $input['gsm'] : $existingItem['gsm'];
        $count = array_key_exists('count', $input) ? $input['count'] : $existingItem['count'];
        $dia = array_key_exists('dia', $input) ? $input['dia'] : $existingItem['dia'];
        $colour = array_key_exists('colour', $input) ? $input['colour'] : $existingItem['colour'];
        $item_group_id = array_key_exists('item_group_id', $input) ? (!empty($input['item_group_id']) ? (int)$input['item_group_id'] : null) : $existingItem['item_group_id'];
        $unit_id = array_key_exists('unit_id', $input) ? (!empty($input['unit_id']) ? (int)$input['unit_id'] : null) : $existingItem['unit_id'];
        $opening_stock = isset($input['opening_stock']) ? floatval($input['opening_stock']) : $existingItem['opening_stock'];
        $opening_value = isset($input['opening_value']) ? floatval($input['opening_value']) : $existingItem['opening_value'];
        $opening_rate = isset($input['opening_rate']) ? floatval($input['opening_rate']) : $existingItem['opening_rate'];
        $minimum_level = isset($input['minimum_level']) ? floatval($input['minimum_level']) : $existingItem['minimum_level'];
        $maximum_level = isset($input['maximum_level']) ? floatval($input['maximum_level']) : $existingItem['maximum_level'];
        $reorder_level = isset($input['reorder_level']) ? floatval($input['reorder_level']) : $existingItem['reorder_level'];
        $standard_cost = isset($input['standard_cost']) ? floatval($input['standard_cost']) : $existingItem['standard_cost'];
        $standard_price = isset($input['standard_price']) ? floatval($input['standard_price']) : $existingItem['standard_price'];
        $tax_id = array_key_exists('tax_id', $input) ? (!empty($input['tax_id']) ? (int)$input['tax_id'] : null) : $existingItem['tax_id'];
        $is_service = isset($input['is_service']) ? (int)$input['is_service'] : $existingItem['is_service'];
        $track_inventory = isset($input['track_inventory']) ? (int)$input['track_inventory'] : $existingItem['track_inventory'];
        $status = isset($input['status']) ? $input['status'] : $existingItem['status'];
        $variants = isset($input['variants']) && is_array($input['variants']) ? $input['variants'] : [];

        // Validate status
        if (!in_array($status, ['active', 'inactive', 'discontinued'])) {
            ApiResponse::validationError([
                'status' => ['Status must be one of: active, inactive, discontinued']
            ]);
        }

        // Check if item_code is unique (if changed)
        if ($item_code && $item_code !== $existingItem['item_code']) {
            $stmt = $pdo->prepare("SELECT id FROM items WHERE item_code = ? AND id != ? AND status != 'inactive'");
            $stmt->execute([$item_code, $id]);
            if ($stmt->fetch()) {
                ApiResponse::validationError([
                    'item_code' => ['Item with this code already exists']
                ]);
            }
        }

        // Check if item_group exists
        if ($item_group_id) {
            $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND status = 'active'");
            $stmt->execute([$item_group_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'item_group_id' => ['Item group does not exist']
                ]);
            }
        }

        // Check if unit exists
        if ($unit_id) {
            $stmt = $pdo->prepare("SELECT id FROM units WHERE id = ? AND status = 'active'");
            $stmt->execute([$unit_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'unit_id' => ['Unit does not exist']
                ]);
            }
        }

        // Check if tax exists
        if ($tax_id) {
            $stmt = $pdo->prepare("SELECT id FROM taxes WHERE id = ? AND status = 'active'");
            $stmt->execute([$tax_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'tax_id' => ['Tax does not exist']
                ]);
            }
        }

        $pdo->beginTransaction();

        try {
        // Update item
        $stmt = $pdo->prepare("
            UPDATE items
            SET item_group_id = ?, name = ?, colour = ?, alias = ?, description = ?,
                item_code = ?, hsn_code = ?, gsm = ?, count = ?, dia = ?, unit_id = ?,
                opening_stock = ?, opening_value = ?, opening_rate = ?,
                minimum_level = ?, maximum_level = ?, reorder_level = ?,
                standard_cost = ?, standard_price = ?, tax_id = ?,
                is_service = ?, track_inventory = ?, status = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $item_group_id, $name, $colour, $alias, $description,
            $item_code, $hsn_code, $gsm, $count, $dia, $unit_id,
            $opening_stock, $opening_value, $opening_rate,
            $minimum_level, $maximum_level, $reorder_level,
            $standard_cost, $standard_price, $tax_id,
            $is_service, $track_inventory, $status,
            $id
        ]);

        // Update stock_movement for Opening stock (delete old and insert new if > 0)
        $stmtDelMovement = $pdo->prepare("DELETE FROM stock_movement WHERE product_id = ? AND type = 'Opening'");
        $stmtDelMovement->execute([$id]);

        if ($opening_stock > 0) {
            $stmtMovement = $pdo->prepare("
                INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                VALUES (?, ?, 'Opening', ?, ?, 'Opening stock updated', NOW())
            ");
            $stmtMovement->execute([$id, $opening_stock, 'ITEM-' . $id, $user['id']]);
        }

        // Handle Variants Update/Create/Delete
        // Get existing variant IDs for this parent item
        $stmtExisting = $pdo->prepare("SELECT id FROM items WHERE variant_of = ? AND status != 'inactive'");
        $stmtExisting->execute([$id]);
        $existingVariantIds = $stmtExisting->fetchAll(PDO::FETCH_COLUMN);

        // Track which variant IDs are being kept/updated
        $updatedVariantIds = [];

        if (!empty($variants)) {
            // Get max variant number for generating new item codes
            $stmtMaxCode = $pdo->prepare("SELECT COUNT(*) FROM items WHERE variant_of = ?");
            $stmtMaxCode->execute([$id]);
            $variantCount = (int)$stmtMaxCode->fetchColumn();

            foreach ($variants as $idx => $variant) {
                $vId = isset($variant['id']) && $variant['id'] !== '' && $variant['id'] !== null ? (int)$variant['id'] : null;

                $vGsm = array_key_exists('gsm', $variant) ? $variant['gsm'] : $gsm;
                $vDia = array_key_exists('dia', $variant) ? $variant['dia'] : $dia;
                $vCount = array_key_exists('count', $variant) ? $variant['count'] : $count;
                $vColour = array_key_exists('colour', $variant) ? $variant['colour'] : $colour;
                $vName = isset($variant['name']) && $variant['name'] !== ''
                    ? $variant['name']
                    : ($name . ' - ' . ($vColour ?? '') . ' ' . ($vGsm ? $vGsm . 'GSM' : ''));

                $vQty = isset($variant['opening_stock']) ? floatval($variant['opening_stock']) : 0;
                $vRate = isset($variant['opening_rate']) ? floatval($variant['opening_rate']) : $opening_rate;
                $vValue = $vQty * $vRate;

                if ($vId && in_array($vId, $existingVariantIds)) {
                    // Update existing variant
                    $updatedVariantIds[] = $vId;

                    $stmtUpdate = $pdo->prepare("
                        UPDATE items SET
                            name = ?, colour = ?, gsm = ?, count = ?, dia = ?,
                            opening_stock = ?, opening_rate = ?, opening_value = ?,
                            item_group_id = ?, unit_id = ?, hsn_code = ?, tax_id = ?,
                            alias = ?, description = ?, minimum_level = ?, maximum_level = ?,
                            reorder_level = ?, standard_cost = ?, standard_price = ?,
                            is_service = ?, track_inventory = ?
                        WHERE id = ? AND variant_of = ?
                    ");

                    $stmtUpdate->execute([
                        $vName, $vColour, $vGsm, $vCount, $vDia,
                        $vQty, $vRate, $vValue,
                        $item_group_id, $unit_id, $hsn_code, $tax_id,
                        $alias, $description, $minimum_level, $maximum_level,
                        $reorder_level, $standard_cost, $standard_price,
                        $is_service, $track_inventory,
                        $vId, $id
                    ]);

                    // Update stock_movement for variant Opening stock
                    $stmtDelMovement->execute([$vId]);
                    if ($vQty > 0) {
                        $stmtMovement = $pdo->prepare("
                            INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                            VALUES (?, ?, 'Opening', ?, ?, 'Opening stock updated for variant', NOW())
                        ");
                        $stmtMovement->execute([$vId, $vQty, 'ITEM-' . $vId, $user['id']]);
                    }
                } else {
                    // Create new variant
                    $variantCount++;
                    $vItemCode = isset($variant['item_code']) && $variant['item_code'] !== ''
                        ? $variant['item_code']
                        : ($item_code ? $item_code . '-V' . $variantCount : null);

                    // Check if generated item_code already exists
                    if ($vItemCode) {
                        $stmtCheckCode = $pdo->prepare("SELECT id FROM items WHERE item_code = ? AND status != 'inactive'");
                        $stmtCheckCode->execute([$vItemCode]);
                        if ($stmtCheckCode->fetch()) {
                            // Generate unique code with timestamp
                            $vItemCode = $item_code . '-V' . $variantCount . '-' . time();
                        }
                    }

                    $stmtInsert = $pdo->prepare("
                        INSERT INTO items (
                            item_group_id, name, colour, alias, description, item_code, hsn_code,
                            gsm, count, dia, unit_id, opening_stock, opening_value, opening_rate,
                            minimum_level, maximum_level, reorder_level,
                            standard_cost, standard_price, tax_id,
                            is_service, track_inventory, variant_of
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");

                    $stmtInsert->execute([
                        $item_group_id, $vName, $vColour, $alias, $description, $vItemCode, $hsn_code,
                        $vGsm, $vCount, $vDia, $unit_id, $vQty, $vValue, $vRate,
                        $minimum_level, $maximum_level, $reorder_level,
                        $standard_cost, $standard_price, $tax_id,
                        $is_service, $track_inventory, $id
                    ]);

                    // Add stock_movement for new variant if opening_stock > 0
                    $newVariantId = $pdo->lastInsertId();
                    if ($vQty > 0) {
                        $stmtMovement = $pdo->prepare("
                            INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                            VALUES (?, ?, 'Opening', ?, ?, 'Opening stock on variant creation', NOW())
                        ");
                        $stmtMovement->execute([$newVariantId, $vQty, 'ITEM-' . $newVariantId, $user['id']]);
                    }
                }
            }
        }

        // Delete variants that were removed (soft delete)
        $variantsToDelete = array_diff($existingVariantIds, $updatedVariantIds);
        if (!empty($variantsToDelete)) {
            $placeholders = implode(',', array_fill(0, count($variantsToDelete), '?'));
            $stmtDelete = $pdo->prepare("UPDATE items SET status = 'inactive' WHERE id IN ($placeholders) AND variant_of = ?");
            $stmtDelete->execute([...$variantsToDelete, $id]);

            // Also remove Opening stock_movement entries for deleted variants
            $stmtDelMovements = $pdo->prepare("DELETE FROM stock_movement WHERE product_id IN ($placeholders) AND type = 'Opening'");
            $stmtDelMovements->execute($variantsToDelete);
        }

        $pdo->commit();

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        // Get updated item
        $stmt = $pdo->prepare("
            SELECT
                i.*,
                ig.name as item_group_name,
                u.name as unit_name,
                u.symbol as unit_symbol,
                t.name as tax_name,
                t.rate as tax_rate
            FROM items i
            LEFT JOIN item_groups ig ON i.item_group_id = ig.id
            LEFT JOIN units u ON i.unit_id = u.id
            LEFT JOIN taxes t ON i.tax_id = t.id
            WHERE i.id = ?
        ");
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        $item['is_service'] = (bool)$item['is_service'];
        $item['track_inventory'] = (bool)$item['track_inventory'];

        ApiResponse::success($item, 'Item updated successfully');
    }

    // DELETE: Delete item
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Item ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if item exists
        $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ? AND status != 'inactive'");
        $stmt->execute([$id]);
        $item = $stmt->fetch();

        if (!$item) {
            ApiResponse::error('Item not found', 404);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE items SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Item deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Items API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Items API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
