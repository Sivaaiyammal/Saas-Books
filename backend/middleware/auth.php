<?php
require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/apiResponse.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/auth.php';

class AuthMiddleware {

    public static function authenticate($requiredRole = null) {
        $token = JWTHelper::getTokenFromHeader();

        if (!$token) {
            ApiResponse::unauthorized('No token provided');
        }

        $result = JWTHelper::verifyToken($token);

        if (!$result['success']) {
            ApiResponse::unauthorized($result['error']);
        }

        $decoded = $result['data'];

        if ($decoded->type !== 'access') {
            ApiResponse::unauthorized('Invalid token type. Please use an access token.');
        }

        global $pdo;

        try {
            $user = AuthHelper::getUserAuthContext($pdo, $decoded->sub);

            if (!$user || $user['status'] !== 'active') {
                ApiResponse::unauthorized('User not found or inactive');
            }

            if ($requiredRole) {
                if (!AuthHelper::checkPermission($pdo, $user['id'], $requiredRole)) {
                    ApiResponse::forbidden('Insufficient permissions');
                }
            }

            global $currentUser;
            $currentUser = $user;

            return $user;

        } catch (PDOException $e) {
            error_log("Auth middleware error: " . $e->getMessage(), 3, __DIR__ . '/../logs/api_error.log');
            ApiResponse::serverError('Authentication failed');
        }
    }

    public static function optionalAuth() {
        $token = JWTHelper::getTokenFromHeader();

        if (!$token) {
            return null;
        }

        $result = JWTHelper::verifyToken($token);

        if (!$result['success']) {
            return null;
        }

        $decoded = $result['data'];

        global $pdo;

        try {
            $user = AuthHelper::getUserAuthContext($pdo, $decoded->sub);

            if ($user && $user['status'] === 'active') {
                global $currentUser;
                $currentUser = $user;
                return $user;
            }

        } catch (PDOException $e) {
            error_log("Optional auth error: " . $e->getMessage());
        }

        return null;
    }
}
