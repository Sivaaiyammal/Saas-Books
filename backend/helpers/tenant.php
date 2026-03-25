<?php

class TenantHelper {

    public static function isSuperAdmin(array $user): bool {
        return ($user['role'] ?? null) === 'super_admin';
    }

    public static function getCompanyId(array $user, $requestedCompanyId = null, bool $allowSuperAdminOverride = true): ?int {
        if (self::isSuperAdmin($user)) {
            if ($allowSuperAdminOverride && $requestedCompanyId !== null && $requestedCompanyId !== '') {
                return (int)$requestedCompanyId;
            }

            if (isset($user['company_id']) && $user['company_id'] !== null && $user['company_id'] !== '') {
                return (int)$user['company_id'];
            }

            return null;
        }

        if (!isset($user['company_id']) || $user['company_id'] === null || $user['company_id'] === '') {
            ApiResponse::forbidden('User is not assigned to a company');
        }

        return (int)$user['company_id'];
    }

    public static function hasCompanyColumn(PDO $pdo, string $tableName): bool {
        static $cache = [];

        if (array_key_exists($tableName, $cache)) {
            return $cache[$tableName];
        }

        $stmt = $pdo->prepare("SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = 'company_id'");
        $stmt->execute([$tableName]);

        $cache[$tableName] = ((int)$stmt->fetchColumn()) > 0;
        return $cache[$tableName];
    }

    public static function appendCompanyFilter(array &$where, array &$params, ?int $companyId, string $column): void {
        if ($companyId === null) {
            return;
        }

        $where[] = $column . ' = ?';
        $params[] = $companyId;
    }

    public static function requireOwnership(?array $row, string $resourceName = 'Record'): void {
        if (!$row) {
            ApiResponse::error($resourceName . ' not found', 404);
        }
    }
}