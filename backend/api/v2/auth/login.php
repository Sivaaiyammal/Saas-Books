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
        SELECT id, name, email, password, phone, role, status, created_at
        FROM users
        WHERE email = ?
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

    $stmt = $pdo->prepare("
        SELECT cu.company_id, c.name as company_name
        FROM company_users cu
        INNER JOIN companies c ON cu.company_id = c.id
        WHERE cu.user_id = ? AND cu.status = 'active' AND c.status = 'active'
        ORDER BY cu.is_default DESC, cu.id ASC
        LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $primaryCompany = $stmt->fetch();

    if ($primaryCompany) {
        $stmt = $pdo->prepare("
            SELECT s.id
            FROM subscriptions s
            WHERE s.company_id = ?
              AND s.user_id = ?
              AND s.status = 'active'
              AND s.payment_status = 'paid'
              AND (s.end_date IS NULL OR s.end_date >= CURDATE())
            ORDER BY s.id DESC
            LIMIT 1
        ");
        $stmt->execute([(int)$primaryCompany['company_id'], $user['id']]);
        $activeSubscription = $stmt->fetch();

        if (!$activeSubscription) {
            ApiResponse::error('Payment required. Please complete subscription payment to access your account.', 402, [
                'payment_required' => true,
                'company_id' => (int)$primaryCompany['company_id'],
                'company_name' => $primaryCompany['company_name']
            ]);
        }
    }

    AuthHelper::logLoginAttempt($pdo, $email, true);

    $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);

    $accessToken = JWTHelper::generateToken($user['id'], $user['email'], $user['role'], false);
    $refreshToken = JWTHelper::generateToken($user['id'], $user['email'], $user['role'], true);

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
