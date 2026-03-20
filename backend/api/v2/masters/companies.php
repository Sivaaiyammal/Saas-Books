<?php
ob_start(); // Buffer output to prevent PHP warnings from corrupting JSON
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
            $id = (int)$_GET['id'];
            $stmt = $pdo->prepare("SELECT * FROM companies WHERE id = ? AND status = 'active'");
            $stmt->execute([$id]);
            $company = $stmt->fetch();

            if (!$company) {
                ApiResponse::error('Company not found', 404);
            }

            ApiResponse::success($company, 'Company retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(name LIKE ? OR code LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM companies WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM companies WHERE $whereClause ORDER BY name ASC LIMIT ? OFFSET ?");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $companies = $stmt->fetchAll();

        ApiResponse::success([
            'companies' => $companies,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Companies retrieved successfully');
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:2|max:150',
            'code' => 'optional|max:20',
            'email' => 'optional|email|max:100',
            'phone' => 'optional|phone',
            'gstin' => 'optional|max:20',
            'city' => 'optional|max:100',
            'state' => 'optional|max:100',
            'pincode' => 'optional|max:10',
            'country' => 'optional|max:100'
        ];

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $code = isset($input['code']) && trim($input['code']) !== ''
            ? strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', trim($input['code'])))
            : ('CMP' . strtoupper(substr(md5($name . microtime(true)), 0, 6)));

        $stmt = $pdo->prepare("SELECT id FROM companies WHERE code = ?");
        $stmt->execute([$code]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'code' => ['Company code already exists']
            ]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO companies (code, name, email, phone, gstin, address, city, state, pincode, country, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        ");

        $stmt->execute([
            $code,
            $name,
            isset($input['email']) ? trim($input['email']) : null,
            isset($input['phone']) ? trim($input['phone']) : null,
            isset($input['gstin']) ? trim($input['gstin']) : null,
            isset($input['address']) ? trim($input['address']) : null,
            isset($input['city']) ? trim($input['city']) : null,
            isset($input['state']) ? trim($input['state']) : null,
            isset($input['pincode']) ? trim($input['pincode']) : null,
            isset($input['country']) ? trim($input['country']) : 'India'
        ]);

        $companyId = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM company_users WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$user['id']]);
        $userCompanyCount = (int)$stmt->fetchColumn();

        $stmt = $pdo->prepare("
            INSERT INTO company_users (company_id, user_id, role, is_default, status)
            VALUES (?, ?, 'owner', ?, 'active')
        ");
        $stmt->execute([$companyId, $user['id'], $userCompanyCount === 0 ? 1 : 0]);

        $stmt = $pdo->prepare("SELECT * FROM companies WHERE id = ?");
        $stmt->execute([$companyId]);
        $company = $stmt->fetch();

        ApiResponse::success($company, 'Company created successfully', 201);
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Company ID is required');
        }

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM companies WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Company not found', 404);
        }

        $name = array_key_exists('name', $input) ? trim($input['name']) : $existing['name'];
        $code = array_key_exists('code', $input) ? strtoupper(preg_replace('/[^A-Za-z0-9_-]/', '', trim($input['code']))) : $existing['code'];

        if ($name === '') {
            ApiResponse::validationError(['name' => ['Name is required']]);
        }

        if ($code === '') {
            ApiResponse::validationError(['code' => ['Code is required']]);
        }

        if ($code !== $existing['code']) {
            $stmt = $pdo->prepare("SELECT id FROM companies WHERE code = ? AND id != ?");
            $stmt->execute([$code, $id]);
            if ($stmt->fetch()) {
                ApiResponse::validationError(['code' => ['Company code already exists']]);
            }
        }

        $stmt = $pdo->prepare("
            UPDATE companies
            SET code = ?, name = ?, email = ?, phone = ?, gstin = ?, address = ?, city = ?, state = ?, pincode = ?, country = ?,
                website = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $code,
            $name,
            array_key_exists('email', $input) ? trim((string)$input['email']) : $existing['email'],
            array_key_exists('phone', $input) ? trim((string)$input['phone']) : $existing['phone'],
            array_key_exists('gstin', $input) ? trim((string)$input['gstin']) : $existing['gstin'],
            array_key_exists('address', $input) ? trim((string)$input['address']) : $existing['address'],
            array_key_exists('city', $input) ? trim((string)$input['city']) : $existing['city'],
            array_key_exists('state', $input) ? trim((string)$input['state']) : $existing['state'],
            array_key_exists('pincode', $input) ? trim((string)$input['pincode']) : $existing['pincode'],
            array_key_exists('country', $input) ? trim((string)$input['country']) : $existing['country'],
            array_key_exists('website', $input) ? trim((string)$input['website']) : ($existing['website'] ?? null),
            $id
        ]);

        $stmt = $pdo->prepare("SELECT * FROM companies WHERE id = ?");
        $stmt->execute([$id]);
        $company = $stmt->fetch();

        ApiResponse::success($company, 'Company updated successfully');
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Company ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            ApiResponse::error('Company not found', 404);
        }

        $stmt = $pdo->prepare("UPDATE companies SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        $stmt = $pdo->prepare("UPDATE company_users SET status = 'inactive' WHERE company_id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Company deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    ob_clean();
    error_log("Companies V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request: ' . $e->getMessage());
} catch (Exception $e) {
    ob_clean();
    error_log("Companies V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred: ' . $e->getMessage());
}
