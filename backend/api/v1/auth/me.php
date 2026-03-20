<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $user = AuthMiddleware::authenticate();

    $stmt = $pdo->prepare("
        SELECT id, name, email, phone, role, status, created_at, last_login
        FROM users
        WHERE id = ?
    ");

    $stmt->execute([$user['id']]);
    $userData = $stmt->fetch();

    if (!$userData) {
        ApiResponse::notFound('User not found');
    }

    ApiResponse::success([
        'user' => $userData
    ], 'User data retrieved successfully');

} catch (PDOException $e) {
    error_log("Me endpoint error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to retrieve user data');
} catch (Exception $e) {
    error_log("Me endpoint exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
