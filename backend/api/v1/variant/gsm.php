<?php
/**
 * GSM Master API
 *
 * CRUD operations for managing GSM (Grams per Square Meter)
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

    // GET: List GSM values or get single
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM gsm WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $gsm = $stmt->fetch();
            if (!$gsm) {
                ApiResponse::error('GSM not found', 404);
            }
            ApiResponse::success($gsm, 'GSM retrieved successfully');
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

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM gsm WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM gsm WHERE $whereClause ORDER BY value ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $gsmList = $stmt->fetchAll();

        ApiResponse::success([
            'gsm' => $gsmList,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'GSM list retrieved successfully');
    }

    // POST: Create new GSM
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
        $stmt = $pdo->prepare("SELECT id FROM gsm WHERE value = ? AND status = 'active'");
        $stmt->execute([$value]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['GSM value already exists']]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO gsm (value, description, status, created_at)
            VALUES (?, ?, 'active', NOW())
        ");
        $stmt->execute([$value, $description]);
        $gsmId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM gsm WHERE id = ?");
        $stmt->execute([$gsmId]);
        $gsm = $stmt->fetch();

        ApiResponse::success($gsm, 'GSM created successfully', 201);
    }

    // PUT: Update GSM
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('GSM ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM gsm WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingGsm = $stmt->fetch();
        if (!$existingGsm) {
            ApiResponse::error('GSM not found', 404);
        }

        $value = isset($input['value']) ? trim($input['value']) : $existingGsm['value'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingGsm['description'];

        // Check for duplicate (excluding current)
        $stmt = $pdo->prepare("SELECT id FROM gsm WHERE value = ? AND id != ? AND status = 'active'");
        $stmt->execute([$value, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['GSM value already exists']]);
        }

        $stmt = $pdo->prepare("UPDATE gsm SET value = ?, description = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$value, $description, $id]);

        $stmt = $pdo->prepare("SELECT * FROM gsm WHERE id = ?");
        $stmt->execute([$id]);
        $gsm = $stmt->fetch();

        ApiResponse::success($gsm, 'GSM updated successfully');
    }

    // DELETE: Soft delete GSM
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('GSM ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT * FROM gsm WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $gsm = $stmt->fetch();
        if (!$gsm) {
            ApiResponse::error('GSM not found', 404);
        }

        // Check if used in items
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE gsm = ? AND status = 'active'");
        $stmt->execute([$gsm['value']]);
        $itemCount = $stmt->fetchColumn();
        if ($itemCount > 0) {
            ApiResponse::error("Cannot delete GSM. It is used in $itemCount item(s)", 400);
        }

        $stmt = $pdo->prepare("UPDATE gsm SET status = 'inactive', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'GSM deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("GSM API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("GSM API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
