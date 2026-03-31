<?php
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
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM units WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $unit = $stmt->fetch();
            if (!$unit) ApiResponse::error('Unit not found', 404);
            ApiResponse::success($unit, 'Unit retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $unit_type = $_GET['unit_type'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["status = 'active'"];
        $params = [];
        TenantHelper::appendCompanyFilter($where, $params, $companyId, 'company_id');

        if ($search) {
            $where[] = "(name LIKE ? OR symbol LIKE ? OR description LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($unit_type) {
            $where[] = "unit_type = ?";
            $params[] = $unit_type;
        }

        $whereClause = implode(' AND ', $where);
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM units WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM units WHERE $whereClause ORDER BY name ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $units = $stmt->fetchAll();

        ApiResponse::success([
            'units' => $units,
            'pagination' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'pages' => ceil($total / $limit)]
        ], 'Units retrieved successfully');
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) ApiResponse::error('Invalid JSON data');

        $rules = ['name' => 'required|min:1|max:50', 'symbol' => 'required|min:1|max:20', 'unit_type' => 'optional', 'decimal_places' => 'optional', 'description' => 'optional'];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) ApiResponse::validationError($errors);

        $name = trim($input['name']);
        $symbol = trim($input['symbol']);
        $unit_type = $input['unit_type'] ?? 'Quantity';
        $decimal_places = isset($input['decimal_places']) ? (int)$input['decimal_places'] : 2;
        $description = $input['description'] ?? null;

        $stmt = $pdo->prepare("SELECT id FROM units WHERE name = ? AND company_id = ? AND status = 'active'");
        $stmt->execute([$name, $companyId]);
        if ($stmt->fetch()) ApiResponse::validationError(['name' => ['Unit with this name already exists']]);

        $stmt = $pdo->prepare("INSERT INTO units (name, symbol, unit_type, decimal_places, description, company_id) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $symbol, $unit_type, $decimal_places, $description, $companyId]);
        $unitId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM units WHERE id = ?");
        $stmt->execute([$unitId]);
        $unit = $stmt->fetch();

        ApiResponse::success($unit, 'Unit created successfully', 201);
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) ApiResponse::error('Invalid JSON data');
        if (!isset($input['id'])) ApiResponse::error('Unit ID is required');

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM units WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingUnit = $stmt->fetch();
        if (!$existingUnit) ApiResponse::error('Unit not found', 404);

        $name = isset($input['name']) ? trim($input['name']) : $existingUnit['name'];
        $symbol = isset($input['symbol']) ? trim($input['symbol']) : $existingUnit['symbol'];
        $unit_type = $input['unit_type'] ?? $existingUnit['unit_type'];
        $decimal_places = isset($input['decimal_places']) ? (int)$input['decimal_places'] : $existingUnit['decimal_places'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingUnit['description'];

        $stmt = $pdo->prepare("SELECT id FROM units WHERE name = ? AND company_id = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $companyId, $id]);
        if ($stmt->fetch()) ApiResponse::validationError(['name' => ['Unit with this name already exists']]);

        $stmt = $pdo->prepare("UPDATE units SET name = ?, symbol = ?, unit_type = ?, decimal_places = ?, description = ? WHERE id = ?");
        $stmt->execute([$name, $symbol, $unit_type, $decimal_places, $description, $id]);

        $stmt = $pdo->prepare("SELECT * FROM units WHERE id = ?");
        $stmt->execute([$id]);
        $unit = $stmt->fetch();

        ApiResponse::success($unit, 'Unit updated successfully');
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) ApiResponse::error('Unit ID is required');

        $id = (int)($input['id'] ?? $_GET['id']);
        $stmt = $pdo->prepare("SELECT * FROM units WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) ApiResponse::error('Unit not found', 404);

        $stmt = $pdo->prepare("UPDATE units SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Unit deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Units API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database Error: ' . $e->getMessage());
} catch (Throwable $e) {
    error_log("Units API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('System Error: ' . $e->getMessage());
}
