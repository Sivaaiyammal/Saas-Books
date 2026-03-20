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

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM godowns WHERE id = ? AND status = 'active'");
            $stmt->execute([(int)$_GET['id']]);
            $godown = $stmt->fetch();
            if (!$godown) ApiResponse::error('Godown not found', 404);
            $godown['is_default'] = (bool)$godown['is_default'];
            ApiResponse::success($godown, 'Godown retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $is_default = $_GET['is_default'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(name LIKE ? OR code LIKE ? OR city LIKE ? OR manager_name LIKE ? OR gstin LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($is_default !== '') {
            $where[] = "is_default = ?";
            $params[] = (int)$is_default;
        }

        $whereClause = implode(' AND ', $where);
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM godowns WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM godowns WHERE $whereClause ORDER BY is_default DESC, name ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $godowns = $stmt->fetchAll();

        foreach ($godowns as &$godown) {
            $godown['is_default'] = (bool)$godown['is_default'];
        }

        ApiResponse::success([
            'godowns' => $godowns,
            'pagination' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'pages' => ceil($total / $limit)]
        ], 'Godowns retrieved successfully');
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) ApiResponse::error('Invalid JSON data');

        $rules = ['name' => 'required|min:2|max:100', 'code' => 'optional', 'address' => 'optional', 'city' => 'optional', 'state' => 'optional', 'pincode' => 'optional', 'phone' => 'optional', 'email' => 'optional', 'manager_name' => 'optional', 'capacity' => 'optional', 'is_default' => 'optional', 'description' => 'optional', 'gstin' => 'optional'];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) ApiResponse::validationError($errors);

        $name = trim($input['name']);
        $code = $input['code'] ?? null;
        $address = $input['address'] ?? null;
        $city = $input['city'] ?? null;
        $state = $input['state'] ?? null;
        $pincode = $input['pincode'] ?? null;
        $phone = $input['phone'] ?? null;
        $email = $input['email'] ?? null;
        $manager_name = $input['manager_name'] ?? null;
        $capacity = isset($input['capacity']) ? floatval($input['capacity']) : null;
        $is_default = isset($input['is_default']) ? (int)$input['is_default'] : 0;
        $description = $input['description'] ?? null;
        $gstin = $input['gstin'] ?? null;

        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::validationError(['email' => ['Invalid email format']]);
        }

        $stmt = $pdo->prepare("SELECT id FROM godowns WHERE name = ? AND status = 'active'");
        $stmt->execute([$name]);
        if ($stmt->fetch()) ApiResponse::validationError(['name' => ['Godown with this name already exists']]);

        if ($is_default) {
            $pdo->exec("UPDATE godowns SET is_default = 0");
        }

        $stmt = $pdo->prepare("INSERT INTO godowns (name, code, address, city, state, pincode, phone, email, manager_name, capacity, is_default, description, gstin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $code, $address, $city, $state, $pincode, $phone, $email, $manager_name, $capacity, $is_default, $description, $gstin]);
        $godownId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT * FROM godowns WHERE id = ?");
        $stmt->execute([$godownId]);
        $godown = $stmt->fetch();
        $godown['is_default'] = (bool)$godown['is_default'];

        ApiResponse::success($godown, 'Godown created successfully', 201);
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) ApiResponse::error('Invalid JSON data');
        if (!isset($input['id'])) ApiResponse::error('Godown ID is required');

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM godowns WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingGodown = $stmt->fetch();
        if (!$existingGodown) ApiResponse::error('Godown not found', 404);

        $name = isset($input['name']) ? trim($input['name']) : $existingGodown['name'];
        $code = array_key_exists('code', $input) ? $input['code'] : $existingGodown['code'];
        $address = array_key_exists('address', $input) ? $input['address'] : $existingGodown['address'];
        $city = array_key_exists('city', $input) ? $input['city'] : $existingGodown['city'];
        $state = array_key_exists('state', $input) ? $input['state'] : $existingGodown['state'];
        $pincode = array_key_exists('pincode', $input) ? $input['pincode'] : $existingGodown['pincode'];
        $phone = array_key_exists('phone', $input) ? $input['phone'] : $existingGodown['phone'];
        $email = array_key_exists('email', $input) ? $input['email'] : $existingGodown['email'];
        $manager_name = array_key_exists('manager_name', $input) ? $input['manager_name'] : $existingGodown['manager_name'];
        $capacity = isset($input['capacity']) ? floatval($input['capacity']) : $existingGodown['capacity'];
        $is_default = isset($input['is_default']) ? (int)$input['is_default'] : $existingGodown['is_default'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingGodown['description'];
        $gstin = array_key_exists('gstin', $input) ? $input['gstin'] : $existingGodown['gstin'];

        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::validationError(['email' => ['Invalid email format']]);
        }

        $stmt = $pdo->prepare("SELECT id FROM godowns WHERE name = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $id]);
        if ($stmt->fetch()) ApiResponse::validationError(['name' => ['Godown with this name already exists']]);

        if ($is_default) {
            $stmt = $pdo->prepare("UPDATE godowns SET is_default = 0 WHERE id != ?");
            $stmt->execute([$id]);
        }

        $stmt = $pdo->prepare("UPDATE godowns SET name = ?, code = ?, address = ?, city = ?, state = ?, pincode = ?, phone = ?, email = ?, manager_name = ?, capacity = ?, is_default = ?, description = ?, gstin = ? WHERE id = ?");
        $stmt->execute([$name, $code, $address, $city, $state, $pincode, $phone, $email, $manager_name, $capacity, $is_default, $description, $gstin, $id]);

        $stmt = $pdo->prepare("SELECT * FROM godowns WHERE id = ?");
        $stmt->execute([$id]);
        $godown = $stmt->fetch();
        $godown['is_default'] = (bool)$godown['is_default'];

        ApiResponse::success($godown, 'Godown updated successfully');
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) ApiResponse::error('Godown ID is required');

        $id = (int)($input['id'] ?? $_GET['id']);
        $stmt = $pdo->prepare("SELECT * FROM godowns WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) ApiResponse::error('Godown not found', 404);

        $stmt = $pdo->prepare("UPDATE godowns SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Godown deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Godowns API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request');
} catch (Exception $e) {
    error_log("Godowns API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
