<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/env.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;

class JWTHelper {
    private static $secret;
    private static $algorithm = 'HS256';
    private static $expiry;
    private static $refreshExpiry;

    private static function init() {
        if (!self::$secret) {
            self::$secret = $_ENV['JWT_SECRET'] ?? 'default-secret-key-change-this';
            self::$expiry = (int)($_ENV['JWT_EXPIRY'] ?? 3600);
            self::$refreshExpiry = (int)($_ENV['JWT_REFRESH_EXPIRY'] ?? 2592000);
        }
    }

    public static function generateToken($userId, $email, $role = 'user', $isRefresh = false) {
        self::init();

        $issuedAt = time();
        $expire = $issuedAt + ($isRefresh ? self::$refreshExpiry : self::$expiry);

        $payload = [
            'iat' => $issuedAt,
            'exp' => $expire,
            'iss' => $_SERVER['HTTP_HOST'] ?? 'localhost',
            'sub' => $userId,
            'email' => $email,
            'role' => $role,
            'type' => $isRefresh ? 'refresh' : 'access'
        ];

        return JWT::encode($payload, self::$secret, self::$algorithm);
    }

    public static function verifyToken($token) {
        self::init();

        try {
            $decoded = JWT::decode($token, new Key(self::$secret, self::$algorithm));
            return [
                'success' => true,
                'data' => $decoded
            ];
        } catch (ExpiredException $e) {
            return [
                'success' => false,
                'error' => 'Token has expired',
                'code' => 'TOKEN_EXPIRED'
            ];
        } catch (SignatureInvalidException $e) {
            return [
                'success' => false,
                'error' => 'Invalid token signature',
                'code' => 'INVALID_SIGNATURE'
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Invalid token: ' . $e->getMessage(),
                'code' => 'INVALID_TOKEN'
            ];
        }
    }

    public static function getTokenFromHeader() {
        $headers = getallheaders();

        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }

    public static function refreshToken($refreshToken) {
        $result = self::verifyToken($refreshToken);

        if (!$result['success']) {
            return $result;
        }

        $decoded = $result['data'];

        if ($decoded->type !== 'refresh') {
            return [
                'success' => false,
                'error' => 'Invalid token type',
                'code' => 'INVALID_TOKEN_TYPE'
            ];
        }

        $newAccessToken = self::generateToken($decoded->sub, $decoded->email, $decoded->role, false);
        $newRefreshToken = self::generateToken($decoded->sub, $decoded->email, $decoded->role, true);

        return [
            'success' => true,
            'accessToken' => $newAccessToken,
            'refreshToken' => $newRefreshToken
        ];
    }
}
