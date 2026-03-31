<?php
/**
 * Color Master API
 *
 * CRUD operations for managing colors
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
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List colors or get single color
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $color = $stmt->fetch();
            if (!$color) {
                ApiResponse::error('Color not found', 404);
            }
            ApiResponse::success($color, 'Color retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(name LIKE ? OR code LIKE ? OR description LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM colors WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get colors
        $stmt = $pdo->prepare("SELECT * FROM colors WHERE $whereClause ORDER BY name ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $colors = $stmt->fetchAll();

        ApiResponse::success([
            'colors' => $colors,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Colors retrieved successfully');
    }

    // POST: Create new color
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:1|max:100',
            'code' => 'optional|max:20',
            'hex_code' => 'optional|max:7',
            'description' => 'optional'
        ];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $code = isset($input['code']) ? trim($input['code']) : null;
        $hex_code = isset($input['hex_code']) ? trim($input['hex_code']) : null;
        $description = $input['description'] ?? null;

        // Check for duplicate name
        $stmt = $pdo->prepare("SELECT id FROM colors WHERE name = ? AND status = 'active'");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['name' => ['Color with this name already exists']]);
        }

        // Check for duplicate code if provided
        if ($code) {
            $stmt = $pdo->prepare("SELECT id FROM colors WHERE code = ? AND status = 'active'");
            $stmt->execute([$code]);
            if ($stmt->fetch()) {
                ApiResponse::validationError(['code' => ['Color with this code already exists']]);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO colors (name, code, hex_code, description, status, created_at)
            VALUES (?, ?, ?, ?, 'active', NOW())
        ");
        $stmt->execute([$name, $code, $hex_code, $description]);
        $colorId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ?");
        $stmt->execute([$colorId]);
        $color = $stmt->fetch();

        ApiResponse::success($color, 'Color created successfully', 201);
    }

    // PUT: Update color
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Color ID is required');
        }

        $id = (int)$input['id'];

        // Check if color exists
        $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingColor = $stmt->fetch();
        if (!$existingColor) {
            ApiResponse::error('Color not found', 404);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingColor['name'];
        $code = array_key_exists('code', $input) ? ($input['code'] ? trim($input['code']) : null) : $existingColor['code'];
        $hex_code = array_key_exists('hex_code', $input) ? ($input['hex_code'] ? trim($input['hex_code']) : null) : $existingColor['hex_code'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingColor['description'];

        // Check for duplicate name (excluding current)
        $stmt = $pdo->prepare("SELECT id FROM colors WHERE name = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['name' => ['Color with this name already exists']]);
        }

        // Check for duplicate code if provided (excluding current)
        if ($code) {
            $stmt = $pdo->prepare("SELECT id FROM colors WHERE code = ? AND id != ? AND status = 'active'");
            $stmt->execute([$code, $id]);
            if ($stmt->fetch()) {
                ApiResponse::validationError(['code' => ['Color with this code already exists']]);
            }
        }

        $stmt = $pdo->prepare("
            UPDATE colors
            SET name = ?, code = ?, hex_code = ?, description = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$name, $code, $hex_code, $description, $id]);

        $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ?");
        $stmt->execute([$id]);
        $color = $stmt->fetch();

        ApiResponse::success($color, 'Color updated successfully');
    }

    // DELETE: Soft delete color
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Color ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if color exists
        $stmt = $pdo->prepare("SELECT * FROM colors WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            ApiResponse::error('Color not found', 404);
        }

        // Check if color is used in items
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE colour = (SELECT name FROM colors WHERE id = ?) AND status = 'active'");
        $stmt->execute([$id]);
        $itemCount = $stmt->fetchColumn();
        if ($itemCount > 0) {
            ApiResponse::error("Cannot delete color. It is used in $itemCount item(s)", 400);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE colors SET status = 'inactive', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Color deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Colors API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Colors API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
