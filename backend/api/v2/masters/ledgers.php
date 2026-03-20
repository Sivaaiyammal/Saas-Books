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

    // GET: List all ledgers or get single ledger
    if ($method === 'GET') {
        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        if ($company_id <= 0) {
            ApiResponse::error('Company ID is required', 400);
        }

        // Get single ledger by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    l.id as sno,
                    l.name,
                    l.address,
                    l.phone,
                    l.created_at
                FROM ledgers l
                WHERE l.id = ? AND l.company_id = ? AND l.status = 'active'
            ");

            $stmt->execute([$id, $company_id]);
            $ledger = $stmt->fetch();

            if (!$ledger) {
                ApiResponse::error('Ledger not found', 404);
            }

            ApiResponse::success($ledger, 'Ledger retrieved successfully');
        }

        // List all ledgers
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["l.status = 'active'", "l.company_id = ?"];
        $params = [$company_id];

        if ($search) {
            $where[] = "(l.name LIKE ? OR l.address LIKE ? OR l.phone LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM ledgers l WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get ledgers
        $stmt = $pdo->prepare("
            SELECT
                l.id as sno,
                l.name,
                l.address,
                l.phone,
                l.created_at
            FROM ledgers l
            WHERE $whereClause
            ORDER BY l.name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $ledgers = $stmt->fetchAll();

        ApiResponse::success([
            'ledgers' => $ledgers,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Ledgers retrieved successfully');
    }

    // POST: Create new ledger
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'company_id' => 'required|integer',
            'name' => 'required|min:2|max:150',
            'address' => 'optional|max:500',
            'phone' => 'optional|phone'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $company_id = (int)$input['company_id'];
        $name = trim($input['name']);
        $address = array_key_exists('address', $input) ? trim($input['address']) : null;
        $phone = array_key_exists('phone', $input) ? trim($input['phone']) : null;

        $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$company_id]);
        if (!$stmt->fetch()) {
            ApiResponse::error('Company not found or inactive', 400);
        }

        // Default to Sundry Debtors group
        $stmt = $pdo->prepare("SELECT id FROM `groups` WHERE company_id = ? AND name = 'Sundry Debtors' AND status = 'active' LIMIT 1");
        $stmt->execute([$company_id]);
        $defaultGroup = $stmt->fetch();

        if (!$defaultGroup) {
            ApiResponse::error('Default group not found. Please configure Sundry Debtors group first.', 400);
        }

        $group_id = (int)$defaultGroup['id'];

        // Check for duplicate name within the default group
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE company_id = ? AND name = ? AND group_id = ? AND status = 'active'");
        $stmt->execute([$company_id, $name, $group_id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Ledger with this name already exists']
            ]);
        }

        // Insert ledger
        $stmt = $pdo->prepare("
            INSERT INTO ledgers
            (company_id, group_id, name, address, phone)
            VALUES (?, ?, ?, ?, ?)
        ");

        $stmt->execute([$company_id, $group_id, $name, $address, $phone]);

        $ledgerId = $pdo->lastInsertId();

        // Get created ledger
        $stmt = $pdo->prepare("
            SELECT
                l.id as sno,
                l.name,
                l.address,
                l.phone,
                l.created_at
            FROM ledgers l
            WHERE l.id = ? AND l.company_id = ?
        ");
        $stmt->execute([$ledgerId, $company_id]);
        $ledger = $stmt->fetch();

        ApiResponse::success($ledger, 'Ledger created successfully', 201);
    }

    // PUT: Update ledger
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Ledger ID is required');
        }

        $rules = [
            'company_id' => 'required|integer',
            'name' => 'optional|min:2|max:150',
            'address' => 'optional|max:500',
            'phone' => 'optional|phone'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $id = (int)$input['id'];
        $company_id = (int)$input['company_id'];

        // Check if ledger exists
        $stmt = $pdo->prepare("SELECT id, name, address, phone, group_id FROM ledgers WHERE id = ? AND company_id = ? AND status = 'active'");
        $stmt->execute([$id, $company_id]);
        $existingLedger = $stmt->fetch();

        if (!$existingLedger) {
            ApiResponse::error('Ledger not found', 404);
        }

        $name = array_key_exists('name', $input) ? trim($input['name']) : $existingLedger['name'];
        if (array_key_exists('name', $input) && $name === '') {
            ApiResponse::validationError(['name' => ['Name is required']]);
        }

        $address = array_key_exists('address', $input) ? trim($input['address']) : $existingLedger['address'];
        $phone = array_key_exists('phone', $input) ? trim($input['phone']) : $existingLedger['phone'];

        // Check for duplicate name within the same group
        if ($name !== $existingLedger['name']) {
            $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE company_id = ? AND name = ? AND group_id = ? AND status = 'active'");
            $stmt->execute([$company_id, $name, (int)$existingLedger['group_id']]);
            if ($stmt->fetch()) {
                ApiResponse::validationError([
                    'name' => ['Ledger with this name already exists']
                ]);
            }
        }

        // Update ledger
        $stmt = $pdo->prepare("
            UPDATE ledgers
            SET name = ?, address = ?, phone = ?
            WHERE id = ? AND company_id = ?
        ");

        $stmt->execute([$name, $address, $phone, $id, $company_id]);

        // Get updated ledger
        $stmt = $pdo->prepare("
            SELECT
                l.id as sno,
                l.name,
                l.address,
                l.phone,
                l.created_at
            FROM ledgers l
            WHERE l.id = ? AND l.company_id = ?
        ");
        $stmt->execute([$id, $company_id]);
        $ledger = $stmt->fetch();

        ApiResponse::success($ledger, 'Ledger updated successfully');
    }

    // DELETE: Delete ledger
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Ledger ID is required');
        }

        $company_id = isset($input['company_id']) ? (int)$input['company_id'] : (isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0);
        if ($company_id <= 0) {
            ApiResponse::error('Company ID is required', 400);
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if ledger exists
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE id = ? AND company_id = ? AND status = 'active'");
        $stmt->execute([$id, $company_id]);
        $ledger = $stmt->fetch();

        if (!$ledger) {
            ApiResponse::error('Ledger not found', 404);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE ledgers SET status = 'inactive' WHERE id = ? AND company_id = ?");
        $stmt->execute([$id, $company_id]);

        ApiResponse::success(null, 'Ledger deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Ledgers V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Ledgers V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
