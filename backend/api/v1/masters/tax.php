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

    // GET: List all taxes or get single tax
    if ($method === 'GET') {
        // Get single tax by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT * FROM taxes
                WHERE id = ? AND status = 'active'
            ");

            $stmt->execute([$id]);
            $tax = $stmt->fetch();

            if (!$tax) {
                ApiResponse::error('Tax not found', 404);
            }

            $tax['is_default'] = (bool)$tax['is_default'];

            ApiResponse::success($tax, 'Tax retrieved successfully');
        }

        // List all taxes
        $search = $_GET['search'] ?? '';
        $tax_type = $_GET['tax_type'] ?? '';
        $is_default = $_GET['is_default'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(name LIKE ? OR description LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($tax_type && in_array($tax_type, ['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'Cess', 'Other'])) {
            $where[] = "tax_type = ?";
            $params[] = $tax_type;
        }

        if ($is_default !== '') {
            $where[] = "is_default = ?";
            $params[] = (int)$is_default;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM taxes WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get taxes
        $stmt = $pdo->prepare("
            SELECT *
            FROM taxes
            WHERE $whereClause
            ORDER BY is_default DESC, rate ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $taxes = $stmt->fetchAll();

        // Convert boolean fields
        foreach ($taxes as &$tax) {
            $tax['is_default'] = (bool)$tax['is_default'];
        }

        ApiResponse::success([
            'taxes' => $taxes,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Taxes retrieved successfully');
    }

    // POST: Create new tax
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:2|max:100',
            'tax_type' => 'required',
            'rate' => 'required',
            'is_default' => 'optional',
            'description' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $tax_type = $input['tax_type'];
        $rate = floatval($input['rate']);
        $is_default = isset($input['is_default']) ? (int)$input['is_default'] : 0;
        $description = $input['description'] ?? null;

        // Validate tax_type
        if (!in_array($tax_type, ['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'Cess', 'Other'])) {
            ApiResponse::validationError([
                'tax_type' => ['Tax type must be one of: GST, CGST, SGST, IGST, VAT, Cess, Other']
            ]);
        }

        // Validate rate
        if ($rate < 0 || $rate > 100) {
            ApiResponse::validationError([
                'rate' => ['Tax rate must be between 0 and 100']
            ]);
        }

        // Check for duplicate name
        $stmt = $pdo->prepare("SELECT id FROM taxes WHERE name = ? AND status = 'active'");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Tax with this name already exists']
            ]);
        }

        // If is_default is set, unset other defaults for same tax_type
        if ($is_default) {
            $stmt = $pdo->prepare("UPDATE taxes SET is_default = 0 WHERE tax_type = ?");
            $stmt->execute([$tax_type]);
        }

        // Insert tax
        $stmt = $pdo->prepare("
            INSERT INTO taxes (name, tax_type, rate, is_default, description)
            VALUES (?, ?, ?, ?, ?)
        ");

        $stmt->execute([$name, $tax_type, $rate, $is_default, $description]);
        $taxId = $pdo->lastInsertId();

        // Get created tax
        $stmt = $pdo->prepare("SELECT * FROM taxes WHERE id = ?");
        $stmt->execute([$taxId]);
        $tax = $stmt->fetch();

        $tax['is_default'] = (bool)$tax['is_default'];

        ApiResponse::success($tax, 'Tax created successfully', 201);
    }

    // PUT: Update tax
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Tax ID is required');
        }

        $id = (int)$input['id'];

        // Check if tax exists
        $stmt = $pdo->prepare("SELECT * FROM taxes WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingTax = $stmt->fetch();

        if (!$existingTax) {
            ApiResponse::error('Tax not found', 404);
        }

        $rules = [
            'name' => 'optional|min:2|max:100',
            'tax_type' => 'optional',
            'rate' => 'optional',
            'is_default' => 'optional',
            'description' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingTax['name'];
        $tax_type = $input['tax_type'] ?? $existingTax['tax_type'];
        $rate = isset($input['rate']) ? floatval($input['rate']) : $existingTax['rate'];
        $is_default = isset($input['is_default']) ? (int)$input['is_default'] : $existingTax['is_default'];
        $description = array_key_exists('description', $input) ? $input['description'] : $existingTax['description'];

        // Validate tax_type
        if (!in_array($tax_type, ['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'Cess', 'Other'])) {
            ApiResponse::validationError([
                'tax_type' => ['Tax type must be one of: GST, CGST, SGST, IGST, VAT, Cess, Other']
            ]);
        }

        // Validate rate
        if ($rate < 0 || $rate > 100) {
            ApiResponse::validationError([
                'rate' => ['Tax rate must be between 0 and 100']
            ]);
        }

        // Check for duplicate name (excluding current tax)
        $stmt = $pdo->prepare("SELECT id FROM taxes WHERE name = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Tax with this name already exists']
            ]);
        }

        // If is_default is set, unset other defaults for same tax_type
        if ($is_default) {
            $stmt = $pdo->prepare("UPDATE taxes SET is_default = 0 WHERE tax_type = ? AND id != ?");
            $stmt->execute([$tax_type, $id]);
        }

        // Update tax
        $stmt = $pdo->prepare("
            UPDATE taxes
            SET name = ?, tax_type = ?, rate = ?, is_default = ?, description = ?
            WHERE id = ?
        ");

        $stmt->execute([$name, $tax_type, $rate, $is_default, $description, $id]);

        // Get updated tax
        $stmt = $pdo->prepare("SELECT * FROM taxes WHERE id = ?");
        $stmt->execute([$id]);
        $tax = $stmt->fetch();

        $tax['is_default'] = (bool)$tax['is_default'];

        ApiResponse::success($tax, 'Tax updated successfully');
    }

    // DELETE: Delete tax
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Tax ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if tax exists
        $stmt = $pdo->prepare("SELECT * FROM taxes WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $tax = $stmt->fetch();

        if (!$tax) {
            ApiResponse::error('Tax not found', 404);
        }

        // Soft delete
        $stmt = $pdo->prepare("UPDATE taxes SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Tax deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Taxes API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Taxes API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
