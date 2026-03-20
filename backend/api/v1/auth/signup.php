<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../helpers/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $rules = [
        'name' => 'required|min:2|max:100',
        'email' => 'required|email',
        'password' => 'required|min:8',
        'confirm_password' => 'required|min:8',
        'phone' => 'phone'
    ];

    $errors = Validator::validate($input, $rules);

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    // Check if password and confirm_password match
    if ($input['password'] !== $input['confirm_password']) {
        ApiResponse::validationError([
            'confirm_password' => ['Password and confirm password do not match']
        ]);
    }

    $name = Validator::sanitize($input['name']);
    $email = AuthHelper::sanitizeEmail($input['email']);
    $password = $input['password'];
    $phone = Validator::sanitize($input['phone'] ?? '');
    $companyName = trim(strip_tags($input['company_name'] ?? ($name . ' Company')));

    if ($companyName === '') {
        $companyName = $name . ' Company';
    }

    if (!AuthHelper::isStrongPassword($password)) {
        ApiResponse::validationError([
            'password' => ['Password must be at least 8 characters and contain uppercase, lowercase, and numbers']
        ]);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        ApiResponse::error('Email already registered', 409);
    }

    $hashedPassword = AuthHelper::hashPassword($password);
    $pdo->beginTransaction();

    $companyCode = AuthHelper::generateCompanyCode($pdo);

    $stmt = $pdo->prepare("
        INSERT INTO companies (code, name, email, phone, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
    ");
    $stmt->execute([$companyCode, $companyName, $email, $phone ?: null]);
    $companyId = (int)$pdo->lastInsertId();

    $permissionIds = AuthHelper::ensurePermissions($pdo);
    $roleIds = AuthHelper::ensureCompanyRoles($pdo, $companyId);
    AuthHelper::assignDefaultRolePermissions($pdo, $roleIds, $permissionIds);

    $ownerRoleId = $roleIds['owner'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, password, phone, company_id, role_id, role, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', NOW())
    ");

    $stmt->execute([$name, $email, $hashedPassword, $phone, $companyId, $ownerRoleId]);

    $userId = $pdo->lastInsertId();

    $stmt = $pdo->prepare("
        INSERT INTO company_users (company_id, user_id, role_id, role, is_default, status, created_at, updated_at)
        VALUES (?, ?, ?, 'owner', 1, 'active', NOW(), NOW())
    ");
    $stmt->execute([$companyId, $userId, $ownerRoleId]);

    $accessToken = JWTHelper::generateToken($userId, $email, 'owner', false, $companyId, $ownerRoleId);
    $refreshToken = JWTHelper::generateToken($userId, $email, 'owner', true, $companyId, $ownerRoleId);

    $pdo->commit();

    $user = AuthHelper::getUserAuthContext($pdo, $userId);

    ApiResponse::created([
        'user' => $user,
        'tokens' => [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'tokenType' => 'Bearer',
            'expiresIn' => (int)$_ENV['JWT_EXPIRY']
        ]
    ], 'User registered successfully');

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Signup error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Registration failed. Please try again.');
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Signup exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
