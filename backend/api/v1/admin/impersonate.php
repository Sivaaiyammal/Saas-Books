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
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../helpers/jwt.php';
require_once __DIR__ . '/../../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $currentUser = AuthMiddleware::authenticate();
    if (($currentUser['role'] ?? '') !== 'super_admin') {
        ApiResponse::forbidden('Only SaaS admin can impersonate company users.');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
        ApiResponse::error('Invalid JSON data');
    }

    $companyId = isset($input['company_id']) ? (int)$input['company_id'] : 0;
    if ($companyId <= 0) {
        ApiResponse::validationError(['company_id' => ['Valid company_id is required']]);
    }

    $pdo = getDBConnection();

    $stmt = $pdo->prepare(
        "SELECT
            u.id,
            u.name,
            u.email,
            u.company_id,
            u.role_id,
            COALESCE(r.name, u.role, 'user') AS role,
            u.status
        FROM company_users cu
        INNER JOIN users u ON u.id = cu.user_id
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE cu.company_id = ?
          AND cu.status = 'active'
          AND u.status = 'active'
        ORDER BY CASE cu.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, cu.id ASC
        LIMIT 1"
    );
    $stmt->execute([$companyId]);
    $impersonatedUser = $stmt->fetch();

    if (!$impersonatedUser) {
        ApiResponse::notFound('No active user found for this company');
    }

    $accessToken = JWTHelper::generateToken(
        (int)$impersonatedUser['id'],
        $impersonatedUser['email'],
        $impersonatedUser['role'],
        false,
        $impersonatedUser['company_id'] ?? null,
        $impersonatedUser['role_id'] ?? null
    );
    $refreshToken = JWTHelper::generateToken(
        (int)$impersonatedUser['id'],
        $impersonatedUser['email'],
        $impersonatedUser['role'],
        true,
        $impersonatedUser['company_id'] ?? null,
        $impersonatedUser['role_id'] ?? null
    );

    $userContext = AuthHelper::getUserAuthContext($pdo, (int)$impersonatedUser['id']);

    ApiResponse::success([
        'user' => $userContext,
        'tokens' => [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'tokenType' => 'Bearer',
            'expiresIn' => (int)($_ENV['JWT_EXPIRY'] ?? 3600)
        ]
    ], 'Impersonation successful');
} catch (PDOException $e) {
    error_log('Admin impersonate API error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to impersonate company user');
} catch (Exception $e) {
    error_log('Admin impersonate API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
