<?php

class AuthHelper {

    public static function hashPassword($password) {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    public static function generateResetToken() {
        return bin2hex(random_bytes(32));
    }

    public static function generateVerificationCode($length = 6) {
        return str_pad(random_int(0, pow(10, $length) - 1), $length, '0', STR_PAD_LEFT);
    }

    public static function isStrongPassword($password) {
        if (strlen($password) < 8) {
            return false;
        }

        $hasUpperCase = preg_match('/[A-Z]/', $password);
        $hasLowerCase = preg_match('/[a-z]/', $password);
        $hasNumbers = preg_match('/[0-9]/', $password);
        $hasSpecialChars = preg_match('/[^A-Za-z0-9]/', $password);

        return $hasUpperCase && $hasLowerCase && $hasNumbers;
    }

    public static function sanitizeEmail($email) {
        return filter_var(trim($email), FILTER_SANITIZE_EMAIL);
    }

    public static function maskEmail($email) {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $username = $parts[0];
        $domain = $parts[1];

        $visibleChars = min(3, strlen($username));
        $maskedUsername = substr($username, 0, $visibleChars) . str_repeat('*', strlen($username) - $visibleChars);

        return $maskedUsername . '@' . $domain;
    }

    public static function getUserRole($pdo, $userId) {
        try {
            $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            return $user ? $user['role'] : null;
        } catch (PDOException $e) {
            error_log("Error fetching user role: " . $e->getMessage());
            return null;
        }
    }

    public static function checkPermission($userRole, $requiredRole) {
        $roleHierarchy = [
            'super_admin' => 4,
            'admin' => 3,
            'manager' => 2,
            'user' => 1,
            'guest' => 0
        ];

        $userLevel = $roleHierarchy[$userRole] ?? 0;
        $requiredLevel = $roleHierarchy[$requiredRole] ?? 0;

        return $userLevel >= $requiredLevel;
    }

    public static function logLoginAttempt($pdo, $email, $success, $ipAddress = null) {
        try {
            $ipAddress = $ipAddress ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';

            $stmt = $pdo->prepare("
                INSERT INTO login_attempts (email, success, ip_address, attempted_at)
                VALUES (?, ?, ?, NOW())
            ");

            $stmt->execute([$email, $success ? 1 : 0, $ipAddress]);
        } catch (PDOException $e) {
            error_log("Error logging login attempt: " . $e->getMessage());
        }
    }

    public static function checkRateLimit($pdo, $email, $maxAttempts = 5, $timeWindow = 900) {
        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as attempts
                FROM login_attempts
                WHERE email = ?
                AND success = 0
                AND attempted_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
            ");

            $stmt->execute([$email, $timeWindow]);
            $result = $stmt->fetch();

            return $result['attempts'] < $maxAttempts;
        } catch (PDOException $e) {
            error_log("Error checking rate limit: " . $e->getMessage());
            return true;
        }
    }
}
