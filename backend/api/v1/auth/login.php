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
        'email' => 'required|email',
        'password' => 'required'
    ];

    $errors = Validator::validate($input, $rules);

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $email = AuthHelper::sanitizeEmail($input['email']);
    $password = $input['password'];

    if (!AuthHelper::checkRateLimit($pdo, $email)) {
        ApiResponse::error('Too many login attempts. Please try again later.', 429);
    }

    $stmt = $pdo->prepare("
        SELECT
            u.id,
            u.name,
            u.email,
            u.password,
            u.phone,
            u.company_id,
            u.role_id,
            COALESCE(r.name, u.role, 'user') AS role,
            u.status,
            u.created_at
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.email = ?
        LIMIT 1
    ");

    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !AuthHelper::verifyPassword($password, $user['password'])) {
        AuthHelper::logLoginAttempt($pdo, $email, false);
        ApiResponse::error('Invalid email or password', 401);
    }

    if ($user['status'] !== 'active') {
        ApiResponse::error('Account is inactive. Please contact support.', 403);
    }

    AuthHelper::logLoginAttempt($pdo, $email, true);

    $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    $accessToken = JWTHelper::generateToken(
        $user['id'],
        $user['email'],
        $user['role'],
        false,
        $user['company_id'] ?? null,
        $user['role_id'] ?? null
    );
    $refreshToken = JWTHelper::generateToken(
        $user['id'],
        $user['email'],
        $user['role'],
        true,
        $user['company_id'] ?? null,
        $user['role_id'] ?? null
    );

    unset($user['password']);

    ApiResponse::success([
        'user' => $user,
        'tokens' => [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'tokenType' => 'Bearer',
            'expiresIn' => (int)$_ENV['JWT_EXPIRY']
        ]
    ], 'Login successful');

} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Login failed. Please try again.');
} catch (Exception $e) {
    error_log("Login exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
