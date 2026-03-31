<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../helpers/moduleAccess.php';
require_once __DIR__ . '/../../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $user = AuthMiddleware::authenticate();

    $userData = AuthHelper::getUserAuthContext($pdo, $user['id']);

    if (!$userData) {
        ApiResponse::notFound('User not found');
    }

    if (!empty($userData['profile_image'])) {
        $normalizedProfileImage = ltrim(str_replace('\\', '/', (string)$userData['profile_image']), '/');
        if (preg_match('#^https?://#i', $normalizedProfileImage)) {
            $userData['profile_image_url'] = $normalizedProfileImage;
        } else {
            $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $userData['profile_image_url'] = $scheme . '://' . $host . '/' . $normalizedProfileImage;
        }
    } else {
        $userData['profile_image_url'] = null;
    }

    $userData['modules'] = ModuleAccessHelper::getCompanyModules($pdo, isset($userData['company_id']) ? (int)$userData['company_id'] : null);
    $userData['is_saas_admin'] = (($userData['role'] ?? '') === 'super_admin');

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
