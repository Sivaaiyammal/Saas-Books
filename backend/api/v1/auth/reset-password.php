<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../helpers/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $rules = [
        'token' => 'required',
        'password' => 'required|min:8',
        'password_confirmation' => 'required'
    ];

    $errors = Validator::validate($input, $rules);

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $token = $input['token'];
    $password = $input['password'];
    $passwordConfirmation = $input['password_confirmation'];

    if ($password !== $passwordConfirmation) {
        ApiResponse::validationError([
            'password_confirmation' => ['Password confirmation does not match']
        ]);
    }

    if (!AuthHelper::isStrongPassword($password)) {
        ApiResponse::validationError([
            'password' => ['Password must be at least 8 characters and contain uppercase, lowercase, and numbers']
        ]);
    }

    $stmt = $pdo->prepare("
        SELECT id, email, status, reset_token_expiry
        FROM users
        WHERE reset_token = ?
    ");

    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        ApiResponse::error('Invalid or expired reset token', 400);
    }

    if (strtotime($user['reset_token_expiry']) < time()) {
        ApiResponse::error('Reset token has expired', 400);
    }

    $hashedPassword = AuthHelper::hashPassword($password);

    $stmt = $pdo->prepare("
        UPDATE users
        SET password = ?, reset_token = NULL, reset_token_expiry = NULL
        WHERE id = ?
    ");

    $stmt->execute([$hashedPassword, $user['id']]);

    ApiResponse::success(null, 'Password has been reset successfully');

} catch (PDOException $e) {
    error_log("Reset password error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to reset password. Please try again.');
} catch (Exception $e) {
    error_log("Reset password exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
