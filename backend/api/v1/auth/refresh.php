<?php
/**
 * Token Refresh API
 *
 * Use refresh token to get a new access token
 * Call this when access token expires (401 error)
 */

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
require_once __DIR__ . '/../../../helpers/jwt.php';
require_once __DIR__ . '/../../../helpers/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    // Get refresh token from body or header
    $refreshToken = $input['refreshToken'] ?? null;

    if (!$refreshToken) {
        // Try to get from Authorization header
        $refreshToken = JWTHelper::getTokenFromHeader();
    }

    if (!$refreshToken) {
        ApiResponse::error('Refresh token is required', 400);
    }

    // Verify the refresh token
    $result = JWTHelper::verifyToken($refreshToken);

    if (!$result['success']) {
        ApiResponse::unauthorized('Invalid or expired refresh token. Please login again.');
    }

    $decoded = $result['data'];

    // Ensure it's a refresh token, not an access token
    if ($decoded->type !== 'refresh') {
        ApiResponse::unauthorized('Invalid token type. Please provide a refresh token.');
    }

    // Check if user still exists and is active
    $user = AuthHelper::getUserAuthContext($pdo, $decoded->sub);

    if (!$user || $user['status'] !== 'active') {
        ApiResponse::unauthorized('User not found or inactive. Please login again.');
    }

    // Generate new access token
    $newAccessToken = JWTHelper::generateToken($user['id'], $user['email'], $user['role'], false, $user['company_id'] ?? null, $user['role_id'] ?? null);

    // Optionally generate new refresh token (token rotation for security)
    $newRefreshToken = JWTHelper::generateToken($user['id'], $user['email'], $user['role'], true, $user['company_id'] ?? null, $user['role_id'] ?? null);

    ApiResponse::success([
        'tokens' => [
            'accessToken' => $newAccessToken,
            'refreshToken' => $newRefreshToken,
            'tokenType' => 'Bearer',
            'expiresIn' => (int)$_ENV['JWT_EXPIRY']
        ]
    ], 'Token refreshed successfully');

} catch (PDOException $e) {
    error_log("Token refresh error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Token refresh failed');
} catch (Exception $e) {
    error_log("Token refresh exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
