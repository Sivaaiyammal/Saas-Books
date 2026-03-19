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

    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, password, phone, role, status, created_at)
        VALUES (?, ?, ?, ?, 'user', 'active', NOW())
    ");

    $stmt->execute([$name, $email, $hashedPassword, $phone]);

    $userId = $pdo->lastInsertId();

    $accessToken = JWTHelper::generateToken($userId, $email, 'user', false);
    $refreshToken = JWTHelper::generateToken($userId, $email, 'user', true);

    $stmt = $pdo->prepare("SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

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
    error_log("Signup error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Registration failed. Please try again.');
} catch (Exception $e) {
    error_log("Signup exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
