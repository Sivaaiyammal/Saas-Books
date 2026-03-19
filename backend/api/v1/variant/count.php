<?php
/**
 * Yarn Count Master API
 *
 * CRUD operations for managing Yarn Count values
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

    // GET: List Yarn Count values or get single
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $count = $stmt->fetch();
            if (!$count) {
                ApiResponse::error('Yarn Count not found', 404);
            }
            ApiResponse::success($count, 'Yarn Count retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(value LIKE ? OR description LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM yarn_count WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE $whereClause ORDER BY value ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $countList = $stmt->fetchAll();

        ApiResponse::success([
            'yarn_count' => $countList,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Yarn Count list retrieved successfully');
    }

    // POST: Create new Yarn Count
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'value' => 'required',
            'description' => 'optional'
        ];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $value = trim($input['value']);
        $description = $input['description'] ?? null;

        // Check for duplicate
        $stmt = $pdo->prepare("SELECT id FROM yarn_count WHERE value = ? AND status = 'active'");
        $stmt->execute([$value]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['Yarn Count value already exists']]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO yarn_count (value, description, status, created_at)
            VALUES (?, ?, 'active', NOW())
        ");
        $stmt->execute([$value, $description]);
        $countId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE id = ?");
        $stmt->execute([$countId]);
        $count = $stmt->fetch();

        ApiResponse::success($count, 'Yarn Count created successfully', 201);
    }

    // PUT: Update Yarn Count
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Yarn Count ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingCount = $stmt->fetch();
        if (!$existingCount) {
            ApiResponse::error('Yarn Count not found', 404);
        }

        $value = isset($input['value']) ? trim($input['value']) : $existingCount['value'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingCount['description'];

        // Check for duplicate (excluding current)
        $stmt = $pdo->prepare("SELECT id FROM yarn_count WHERE value = ? AND id != ? AND status = 'active'");
        $stmt->execute([$value, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['Yarn Count value already exists']]);
        }

        $stmt = $pdo->prepare("UPDATE yarn_count SET value = ?, description = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$value, $description, $id]);

        $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE id = ?");
        $stmt->execute([$id]);
        $count = $stmt->fetch();

        ApiResponse::success($count, 'Yarn Count updated successfully');
    }

    // DELETE: Soft delete Yarn Count
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Yarn Count ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT * FROM yarn_count WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $count = $stmt->fetch();
        if (!$count) {
            ApiResponse::error('Yarn Count not found', 404);
        }

        // Check if used in items
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE `count` = ? AND status = 'active'");
        $stmt->execute([$count['value']]);
        $itemCount = $stmt->fetchColumn();
        if ($itemCount > 0) {
            ApiResponse::error("Cannot delete Yarn Count. It is used in $itemCount item(s)", 400);
        }

        $stmt = $pdo->prepare("UPDATE yarn_count SET status = 'inactive', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Yarn Count deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Yarn Count API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Yarn Count API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
