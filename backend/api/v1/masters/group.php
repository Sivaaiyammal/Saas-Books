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
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

// Authenticate user
$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List all groups or get single group
    if ($method === 'GET') {
        // Get single group by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    g.*,
                    p.name as parent_name,
                    (SELECT COUNT(*) FROM `groups` WHERE parent_id = g.id) as child_count
                FROM `groups` g
                LEFT JOIN `groups` p ON g.parent_id = p.id
                WHERE g.id = ? AND g.status = 'active'
            ");

            $stmt->execute([$id]);
            $group = $stmt->fetch();

            if (!$group) {
                ApiResponse::error('Group not found', 404);
            }

            // Get children groups
            $stmt = $pdo->prepare("
                SELECT id, name, nature, affects_gross_profit
                FROM `groups`
                WHERE parent_id = ? AND status = 'active'
                ORDER BY name
            ");
            $stmt->execute([$id]);
            $group['children'] = $stmt->fetchAll();

            ApiResponse::success($group, 'Group retrieved successfully');
        }

        // List all groups
        $search = $_GET['search'] ?? '';
        $nature = $_GET['nature'] ?? '';
        $parent_id = $_GET['parent_id'] ?? '';
        $is_system = $_GET['is_system'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["g.status = 'active'", "(g.is_system = 1 OR g.company_id = ?)"];
        $params = [$companyId];

        if ($search) {
            $where[] = "g.name LIKE ?";
            $params[] = "%$search%";
        }

        if ($nature && in_array($nature, ['Asset', 'Liability', 'Income', 'Expense'])) {
            $where[] = "g.nature = ?";
            $params[] = $nature;
        }

        if ($parent_id !== '') {
            if ($parent_id === 'null' || $parent_id === '0') {
                $where[] = "g.parent_id IS NULL";
            } else {
                $where[] = "g.parent_id = ?";
                $params[] = (int)$parent_id;
            }
        }

        if ($is_system !== '') {
            $where[] = "g.is_system = ?";
            $params[] = (int)$is_system;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM `groups` g WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get groups
        $stmt = $pdo->prepare("
            SELECT
                g.id,
                g.name,
                g.parent_id,
                p.name as parent_name,
                g.nature,
                g.affects_gross_profit,
                g.is_system,
                g.created_at,
                (SELECT COUNT(*) FROM `groups` WHERE parent_id = g.id AND status = 'active') as child_count
            FROM `groups` g
            LEFT JOIN `groups` p ON g.parent_id = p.id
            WHERE $whereClause
            ORDER BY g.is_system DESC, g.name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $groups = $stmt->fetchAll();

        ApiResponse::success([
            'groups' => $groups,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Groups retrieved successfully');
    }

    // POST: Create new group
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:2|max:100',
            'nature' => 'required',
            'parent_id' => 'optional',
            'affects_gross_profit' => 'optional',
            'company_id' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $nature = $input['nature'];
        $parent_id = $input['parent_id'] ?? null;
        $affects_gross_profit = isset($input['affects_gross_profit']) ? (int)$input['affects_gross_profit'] : 0;
        $company_id = $companyId;

        // Validate nature
        if (!in_array($nature, ['Asset', 'Liability', 'Income', 'Expense'])) {
            ApiResponse::validationError([
                'nature' => ['Nature must be one of: Asset, Liability, Income, Expense']
            ]);
        }

        // Check if parent exists (if provided)
        if ($parent_id) {
            $stmt = $pdo->prepare("SELECT id, nature FROM `groups` WHERE id = ? AND status = 'active'");
            $stmt->execute([$parent_id]);
            $parent = $stmt->fetch();

            if (!$parent) {
                ApiResponse::validationError([
                    'parent_id' => ['Parent group not found']
                ]);
            }

            // Validate that nature matches parent nature
            if ($parent['nature'] !== $nature) {
                ApiResponse::validationError([
                    'nature' => ["Child group nature must match parent nature ({$parent['nature']})"]
                ]);
            }
        }

        // Check for duplicate name
        $stmt = $pdo->prepare("SELECT id FROM `groups` WHERE name = ? AND (is_system = 1 OR company_id = ?) AND status = 'active'");
        $stmt->execute([$name, $company_id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Group with this name already exists']
            ]);
        }

        // Insert group
        $stmt = $pdo->prepare("
            INSERT INTO `groups` (company_id, name, parent_id, nature, affects_gross_profit, is_system)
            VALUES (?, ?, ?, ?, ?, 0)
        ");

        $stmt->execute([$company_id, $name, $parent_id, $nature, $affects_gross_profit]);
        $groupId = $pdo->lastInsertId();

        // Get created group
        $stmt = $pdo->prepare("
            SELECT
                g.*,
                p.name as parent_name
            FROM `groups` g
            LEFT JOIN `groups` p ON g.parent_id = p.id
            WHERE g.id = ?
        ");
        $stmt->execute([$groupId]);
        $group = $stmt->fetch();

        ApiResponse::success($group, 'Group created successfully', 201);
    }

    // PUT: Update group
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Group ID is required');
        }

        $id = (int)$input['id'];

        // Check if group exists
        $stmt = $pdo->prepare("SELECT * FROM `groups` WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingGroup = $stmt->fetch();

        if (!$existingGroup) {
            ApiResponse::error('Group not found', 404);
        }

        // Prevent updating system groups
        if ($existingGroup['is_system']) {
            ApiResponse::error('System groups cannot be modified', 403);
        }

        $rules = [
            'name' => 'optional|min:2|max:100',
            'nature' => 'optional',
            'parent_id' => 'optional',
            'affects_gross_profit' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingGroup['name'];
        $nature = $input['nature'] ?? $existingGroup['nature'];
        $parent_id = array_key_exists('parent_id', $input) ? $input['parent_id'] : $existingGroup['parent_id'];
        $affects_gross_profit = isset($input['affects_gross_profit']) ? (int)$input['affects_gross_profit'] : $existingGroup['affects_gross_profit'];

        // Validate nature
        if (!in_array($nature, ['Asset', 'Liability', 'Income', 'Expense'])) {
            ApiResponse::validationError([
                'nature' => ['Nature must be one of: Asset, Liability, Income, Expense']
            ]);
        }

        // Check if parent exists and prevent circular reference
        if ($parent_id) {
            if ($parent_id == $id) {
                ApiResponse::validationError([
                    'parent_id' => ['Group cannot be its own parent']
                ]);
            }

            $stmt = $pdo->prepare("SELECT id, nature FROM `groups` WHERE id = ? AND status = 'active'");
            $stmt->execute([$parent_id]);
            $parent = $stmt->fetch();

            if (!$parent) {
                ApiResponse::validationError([
                    'parent_id' => ['Parent group not found']
                ]);
            }

            // Validate that nature matches parent nature
            if ($parent['nature'] !== $nature) {
                ApiResponse::validationError([
                    'nature' => ["Child group nature must match parent nature ({$parent['nature']})"]
                ]);
            }
        }

        // Check for duplicate name (excluding current group)
        $stmt = $pdo->prepare("SELECT id FROM `groups` WHERE name = ? AND id != ? AND (is_system = 1 OR company_id = ?) AND status = 'active'");
        $stmt->execute([$name, $id, $companyId]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Group with this name already exists']
            ]);
        }

        // Update group
        $stmt = $pdo->prepare("
            UPDATE `groups`
            SET name = ?, parent_id = ?, nature = ?, affects_gross_profit = ?
            WHERE id = ?
        ");

        $stmt->execute([$name, $parent_id, $nature, $affects_gross_profit, $id]);

        // Get updated group
        $stmt = $pdo->prepare("
            SELECT
                g.*,
                p.name as parent_name
            FROM `groups` g
            LEFT JOIN `groups` p ON g.parent_id = p.id
            WHERE g.id = ?
        ");
        $stmt->execute([$id]);
        $group = $stmt->fetch();

        ApiResponse::success($group, 'Group updated successfully');
    }

    // DELETE: Delete group
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Group ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if group exists
        $stmt = $pdo->prepare("SELECT * FROM `groups` WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $group = $stmt->fetch();

        if (!$group) {
            ApiResponse::error('Group not found', 404);
        }

        // Prevent deleting system groups
        if ($group['is_system']) {
            ApiResponse::error('System groups cannot be deleted', 403);
        }

        // Check if group has children
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM `groups` WHERE parent_id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $childCount = $stmt->fetchColumn();

        if ($childCount > 0) {
            ApiResponse::error("Cannot delete group with $childCount child groups. Delete children first.", 400);
        }

        // Soft delete (set status to inactive)
        $stmt = $pdo->prepare("UPDATE `groups` SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Group deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Groups API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Groups API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
