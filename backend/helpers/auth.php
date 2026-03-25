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
        $user = self::getUserAuthContext($pdo, $userId);
        return $user ? $user['role'] : null;
    }

    public static function getUserAuthContext($pdo, $userId) {
        try {
            $stmt = $pdo->prepare("
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.phone,
                    COALESCE(
                        u.company_id,
                        (
                            SELECT cu.company_id
                            FROM company_users cu
                            WHERE cu.user_id = u.id
                              AND (cu.status = 'active' OR cu.status IS NULL)
                            ORDER BY cu.is_default DESC, cu.id ASC
                            LIMIT 1
                        )
                    ) AS company_id,
                    c.name AS company_name,
                    u.role_id,
                    COALESCE(r.name, u.role, 'user') AS role,
                    u.status,
                    u.created_at,
                    u.last_login
                FROM users u
                LEFT JOIN companies c ON c.id = COALESCE(
                    u.company_id,
                    (
                        SELECT cu2.company_id
                        FROM company_users cu2
                        WHERE cu2.user_id = u.id
                          AND (cu2.status = 'active' OR cu2.status IS NULL)
                        ORDER BY cu2.is_default DESC, cu2.id ASC
                        LIMIT 1
                    )
                )
                LEFT JOIN roles r ON r.id = u.role_id
                WHERE u.id = ?
                LIMIT 1
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            return $user ?: null;
        } catch (PDOException $e) {
            error_log("Error fetching user auth context: " . $e->getMessage());
            return null;
        }
    }

    public static function checkPermission($pdo, $userId, $requiredPermission) {
        $user = self::getUserAuthContext($pdo, $userId);

        if (!$user) {
            return false;
        }

        $roleHierarchy = [
            'owner' => 5,
            'super_admin' => 4,
            'admin' => 3,
            'manager' => 2,
            'user' => 1,
            'viewer' => 1,
            'guest' => 0
        ];

        if (isset($roleHierarchy[$requiredPermission])) {
            $userLevel = $roleHierarchy[$user['role']] ?? 0;
            $requiredLevel = $roleHierarchy[$requiredPermission] ?? 0;
            return $userLevel >= $requiredLevel;
        }

        if (in_array($user['role'], ['owner', 'super_admin'], true)) {
            return true;
        }

        if (empty($user['role_id'])) {
            return false;
        }

        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM role_permissions rp
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = ? AND p.name = ?
            ");
            $stmt->execute([(int)$user['role_id'], $requiredPermission]);
            return (int)$stmt->fetchColumn() > 0;
        } catch (PDOException $e) {
            error_log("Error checking permission: " . $e->getMessage());
            return false;
        }
    }

    public static function generateCompanyCode($pdo) {
        $baseId = 1;

        try {
            $stmt = $pdo->query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM companies");
            $baseId = (int)$stmt->fetchColumn();
        } catch (PDOException $e) {
            error_log("Error generating company code: " . $e->getMessage());
        }

        for ($offset = 0; $offset < 20; $offset++) {
            $code = sprintf('COMP%04d', $baseId + $offset);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM companies WHERE code = ?");
            $stmt->execute([$code]);

            if ((int)$stmt->fetchColumn() === 0) {
                return $code;
            }
        }

        return 'COMP' . strtoupper(bin2hex(random_bytes(2)));
    }

    public static function ensurePermissions($pdo) {
        $permissions = [
            'manage_company',
            'manage_users',
            'manage_roles',
            'manage_permissions',
            'manage_masters',
            'manage_vouchers',
            'view_reports'
        ];

        $insert = $pdo->prepare("INSERT IGNORE INTO permissions (name) VALUES (?)");
        foreach ($permissions as $permission) {
            $insert->execute([$permission]);
        }

        $stmt = $pdo->query("SELECT id, name FROM permissions");
        $permissionIds = [];
        while ($row = $stmt->fetch()) {
            $permissionIds[$row['name']] = (int)$row['id'];
        }

        return $permissionIds;
    }

    public static function ensureCompanyRoles($pdo, $companyId) {
        $roles = ['owner', 'admin', 'manager', 'user', 'viewer'];
        $insert = $pdo->prepare("INSERT IGNORE INTO roles (company_id, name) VALUES (?, ?)");

        foreach ($roles as $role) {
            $insert->execute([$companyId, $role]);
        }

        $stmt = $pdo->prepare("SELECT id, name FROM roles WHERE company_id = ?");
        $stmt->execute([$companyId]);

        $roleIds = [];
        while ($row = $stmt->fetch()) {
            $roleIds[$row['name']] = (int)$row['id'];
        }

        return $roleIds;
    }

    public static function assignDefaultRolePermissions($pdo, $roleIds, $permissionIds) {
        $matrix = [
            'owner' => array_keys($permissionIds),
            'admin' => ['manage_users', 'manage_roles', 'manage_permissions', 'manage_masters', 'manage_vouchers', 'view_reports'],
            'manager' => ['manage_masters', 'manage_vouchers', 'view_reports'],
            'user' => ['manage_vouchers', 'view_reports'],
            'viewer' => ['view_reports']
        ];

        $insert = $pdo->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");

        foreach ($matrix as $roleName => $permissions) {
            if (empty($roleIds[$roleName])) {
                continue;
            }

            foreach ($permissions as $permissionName) {
                if (empty($permissionIds[$permissionName])) {
                    continue;
                }

                $insert->execute([$roleIds[$roleName], $permissionIds[$permissionName]]);
            }
        }
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
