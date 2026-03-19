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

    // GET: List all item groups or get single item group
    if ($method === 'GET') {
        // Get single item group by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    ig.*,
                    parent.name as parent_name
                FROM item_groups ig
                LEFT JOIN item_groups parent ON ig.parent_id = parent.id
                WHERE ig.id = ? AND ig.status = 'active'
            ");

            $stmt->execute([$id]);
            $itemGroup = $stmt->fetch();

            if (!$itemGroup) {
                ApiResponse::error('Item group not found', 404);
            }

            ApiResponse::success($itemGroup, 'Item group retrieved successfully');
        }

        // List all item groups
        $search = $_GET['search'] ?? '';
        $group_type = $_GET['group_type'] ?? '';
        $parent_id = $_GET['parent_id'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["ig.status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(ig.name LIKE ? OR ig.description LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($group_type && in_array($group_type, ['Raw Material', 'Finished Goods', 'Work in Progress', 'Consumables', 'Services', 'Other'])) {
            $where[] = "ig.group_type = ?";
            $params[] = $group_type;
        }

        if ($parent_id !== '') {
            if ($parent_id === '0' || $parent_id === 0) {
                $where[] = "ig.parent_id IS NULL";
            } else {
                $where[] = "ig.parent_id = ?";
                $params[] = (int)$parent_id;
            }
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM item_groups ig WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get item groups
        $stmt = $pdo->prepare("
            SELECT
                ig.*,
                parent.name as parent_name,
                (SELECT COUNT(*) FROM items WHERE item_group_id = ig.id AND status = 'active') as item_count
            FROM item_groups ig
            LEFT JOIN item_groups parent ON ig.parent_id = parent.id
            WHERE $whereClause
            ORDER BY ig.name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $itemGroups = $stmt->fetchAll();

        ApiResponse::success([
            'item_groups' => $itemGroups,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Item groups retrieved successfully');
    }

    // POST: Create new item group
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:2|max:100',
            'group_type' => 'optional',
            'parent_id' => 'optional',
            'description' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $group_type = $input['group_type'] ?? 'Other';
        $parent_id = isset($input['parent_id']) ? (int)$input['parent_id'] : null;
        $description = $input['description'] ?? null;

        // Validate group_type
        if (!in_array($group_type, ['Raw Material', 'Finished Goods', 'Work in Progress', 'Consumables', 'Services', 'Other'])) {
            ApiResponse::validationError([
                'group_type' => ['Group type must be one of: Raw Material, Finished Goods, Work in Progress, Consumables, Services, Other']
            ]);
        }

        // Check if parent exists
        if ($parent_id) {
            $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND status = 'active'");
            $stmt->execute([$parent_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'parent_id' => ['Parent item group does not exist']
                ]);
            }
        }

        // Check for duplicate name
        $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE name = ? AND status = 'active'");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Item group with this name already exists']
            ]);
        }

        // Insert item group
        $stmt = $pdo->prepare("
            INSERT INTO item_groups (name, parent_id, group_type, description)
            VALUES (?, ?, ?, ?)
        ");

        $stmt->execute([$name, $parent_id, $group_type, $description]);
        $itemGroupId = $pdo->lastInsertId();

        // Get created item group
        $stmt = $pdo->prepare("
            SELECT
                ig.*,
                parent.name as parent_name
            FROM item_groups ig
            LEFT JOIN item_groups parent ON ig.parent_id = parent.id
            WHERE ig.id = ?
        ");
        $stmt->execute([$itemGroupId]);
        $itemGroup = $stmt->fetch();

        ApiResponse::success($itemGroup, 'Item group created successfully', 201);
    }

    // PUT: Update item group
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Item group ID is required');
        }

        $id = (int)$input['id'];

        // Check if item group exists
        $stmt = $pdo->prepare("SELECT * FROM item_groups WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingGroup = $stmt->fetch();

        if (!$existingGroup) {
            ApiResponse::error('Item group not found', 404);
        }

        $rules = [
            'name' => 'optional|min:2|max:100',
            'group_type' => 'optional',
            'parent_id' => 'optional',
            'description' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingGroup['name'];
        $group_type = $input['group_type'] ?? $existingGroup['group_type'];
        $parent_id = array_key_exists('parent_id', $input) ? (isset($input['parent_id']) ? (int)$input['parent_id'] : null) : $existingGroup['parent_id'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingGroup['description'];

        // Validate group_type
        if (!in_array($group_type, ['Raw Material', 'Finished Goods', 'Work in Progress', 'Consumables', 'Services', 'Other'])) {
            ApiResponse::validationError([
                'group_type' => ['Group type must be one of: Raw Material, Finished Goods, Work in Progress, Consumables, Services, Other']
            ]);
        }

        // Check if parent exists and prevent circular reference
        if ($parent_id) {
            if ($parent_id == $id) {
                ApiResponse::validationError([
                    'parent_id' => ['Item group cannot be its own parent']
                ]);
            }

            $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND status = 'active'");
            $stmt->execute([$parent_id]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError([
                    'parent_id' => ['Parent item group does not exist']
                ]);
            }
        }

        // Check for duplicate name (excluding current group)
        $stmt = $pdo->prepare("SELECT id FROM item_groups WHERE name = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Item group with this name already exists']
            ]);
        }

        // Update item group
        $stmt = $pdo->prepare("
            UPDATE item_groups
            SET name = ?, parent_id = ?, group_type = ?, description = ?, updated_at = NOW()
            WHERE id = ?
        ");

        $stmt->execute([$name, $parent_id, $group_type, $description, $id]);

        // Get updated item group
        $stmt = $pdo->prepare("
            SELECT
                ig.*,
                parent.name as parent_name
            FROM item_groups ig
            LEFT JOIN item_groups parent ON ig.parent_id = parent.id
            WHERE ig.id = ?
        ");
        $stmt->execute([$id]);
        $itemGroup = $stmt->fetch();

        ApiResponse::success($itemGroup, 'Item group updated successfully');
    }

    // DELETE: Delete item group
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Item group ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if item group exists
        $stmt = $pdo->prepare("SELECT * FROM item_groups WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $itemGroup = $stmt->fetch();

        if (!$itemGroup) {
            ApiResponse::error('Item group not found', 404);
        }

        // Check if item group has items
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE item_group_id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $itemCount = $stmt->fetchColumn();

        if ($itemCount > 0) {
            ApiResponse::error("Cannot delete item group. It has {$itemCount} active items. Please reassign or delete the items first.", 400);
        }

        // Check if item group has child groups
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM item_groups WHERE parent_id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $childCount = $stmt->fetchColumn();

        if ($childCount > 0) {
            ApiResponse::error("Cannot delete item group. It has {$childCount} child groups. Please reassign or delete the child groups first.", 400);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE item_groups SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Item group deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Item Groups API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Item Groups API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
