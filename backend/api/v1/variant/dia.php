<?php
/**
 * Dia Master API
 *
 * CRUD operations for managing Diameter/Width values
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

    // GET: List Dia values or get single
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM dia WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $dia = $stmt->fetch();
            if (!$dia) {
                ApiResponse::error('Dia not found', 404);
            }
            ApiResponse::success($dia, 'Dia retrieved successfully');
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

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM dia WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM dia WHERE $whereClause ORDER BY value ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $diaList = $stmt->fetchAll();

        ApiResponse::success([
            'dia' => $diaList,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Dia list retrieved successfully');
    }

    // POST: Create new Dia
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
        $stmt = $pdo->prepare("SELECT id FROM dia WHERE value = ? AND status = 'active'");
        $stmt->execute([$value]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['Dia value already exists']]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO dia (value, description, status, created_at)
            VALUES (?, ?, 'active', NOW())
        ");
        $stmt->execute([$value, $description]);
        $diaId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM dia WHERE id = ?");
        $stmt->execute([$diaId]);
        $dia = $stmt->fetch();

        ApiResponse::success($dia, 'Dia created successfully', 201);
    }

    // PUT: Update Dia
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Dia ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM dia WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingDia = $stmt->fetch();
        if (!$existingDia) {
            ApiResponse::error('Dia not found', 404);
        }

        $value = isset($input['value']) ? trim($input['value']) : $existingDia['value'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingDia['description'];

        // Check for duplicate (excluding current)
        $stmt = $pdo->prepare("SELECT id FROM dia WHERE value = ? AND id != ? AND status = 'active'");
        $stmt->execute([$value, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['value' => ['Dia value already exists']]);
        }

        $stmt = $pdo->prepare("UPDATE dia SET value = ?, description = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$value, $description, $id]);

        $stmt = $pdo->prepare("SELECT * FROM dia WHERE id = ?");
        $stmt->execute([$id]);
        $dia = $stmt->fetch();

        ApiResponse::success($dia, 'Dia updated successfully');
    }

    // DELETE: Soft delete Dia
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Dia ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT * FROM dia WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $dia = $stmt->fetch();
        if (!$dia) {
            ApiResponse::error('Dia not found', 404);
        }

        // Check if used in items
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE dia = ? AND status = 'active'");
        $stmt->execute([$dia['value']]);
        $itemCount = $stmt->fetchColumn();
        if ($itemCount > 0) {
            ApiResponse::error("Cannot delete Dia. It is used in $itemCount item(s)", 400);
        }

        $stmt = $pdo->prepare("UPDATE dia SET status = 'inactive', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Dia deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Dia API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Dia API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
