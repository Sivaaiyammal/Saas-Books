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
require_once __DIR__ . '/../../../helpers/email.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $rules = [
        'email' => 'required|email'
    ];

    $errors = Validator::validate($input, $rules);

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $email = AuthHelper::sanitizeEmail($input['email']);

    $stmt = $pdo->prepare("SELECT id, name, email FROM users WHERE email = ? AND status = 'active'");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        $resetToken = AuthHelper::generateResetToken();
        $resetTokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $stmt = $pdo->prepare("
            UPDATE users
            SET reset_token = ?, reset_token_expiry = ?
            WHERE id = ?
        ");

        $stmt->execute([$resetToken, $resetTokenExpiry, $user['id']]);

        // Send password reset email
        $emailSent = EmailHelper::sendPasswordReset($user['email'], $user['name'], $resetToken);

        if ($emailSent) {
            error_log("Password reset email sent to {$email}", 3, __DIR__ . '/../../../logs/api_error.log');
        } else {
            error_log("Failed to send password reset email to {$email}. Token: {$resetToken}", 3, __DIR__ . '/../../../logs/api_error.log');
        }
    }

    // Always return success message for security (don't reveal if email exists)
    ApiResponse::success(null, 'If the email exists, a password reset link has been sent.');

} catch (PDOException $e) {
    error_log("Forgot password error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Forgot password exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
