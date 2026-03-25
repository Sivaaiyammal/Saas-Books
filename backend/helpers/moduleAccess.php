<?php

require_once __DIR__ . '/apiResponse.php';

class ModuleAccessHelper {

    public static function defaultModules() {
        return [
            'sales_order' => true,
            'purchase_order' => true,
            'sales' => true,
            'purchase' => true,
            'payment' => true,
            'receipt' => true,
            'delivery_note' => true,
            'quotation' => true
        ];
    }

    public static function hasAccessTable(PDO $pdo): bool {
        try {
            $stmt = $pdo->prepare("SHOW TABLES LIKE 'company_module_access'");
            $stmt->execute();
            return (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            error_log('Error checking company_module_access table: ' . $e->getMessage());
            return false;
        }
    }

    public static function normalizeModules($modulesInput): array {
        $defaults = self::defaultModules();

        if (is_string($modulesInput)) {
            $decoded = json_decode($modulesInput, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $modulesInput = $decoded;
            }
        }

        if (!is_array($modulesInput)) {
            return $defaults;
        }

        $normalized = $defaults;
        foreach ($defaults as $key => $value) {
            if (array_key_exists($key, $modulesInput)) {
                $normalized[$key] = filter_var($modulesInput[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

        return $normalized;
    }

    public static function getCompanyModules(PDO $pdo, ?int $companyId): array {
        if (empty($companyId) || $companyId <= 0) {
            return self::defaultModules();
        }

        if (!self::hasAccessTable($pdo)) {
            return self::defaultModules();
        }

        try {
            $stmt = $pdo->prepare('SELECT modules_json FROM company_module_access WHERE company_id = ? LIMIT 1');
            $stmt->execute([$companyId]);
            $row = $stmt->fetch();

            if (!$row || empty($row['modules_json'])) {
                return self::defaultModules();
            }

            return self::normalizeModules($row['modules_json']);
        } catch (Throwable $e) {
            error_log('Error reading company modules: ' . $e->getMessage());
            return self::defaultModules();
        }
    }

    public static function upsertCompanyModules(PDO $pdo, int $companyId, array $modules, int $updatedBy): void {
        if (!self::hasAccessTable($pdo)) {
            throw new Exception('company_module_access table does not exist. Run migration add_company_module_access.php');
        }

        $normalized = self::normalizeModules($modules);
        $jsonModules = json_encode($normalized, JSON_UNESCAPED_SLASHES);

        $stmt = $pdo->prepare(
            'INSERT INTO company_module_access (company_id, modules_json, updated_by, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE modules_json = VALUES(modules_json), updated_by = VALUES(updated_by), updated_at = NOW()'
        );
        $stmt->execute([$companyId, $jsonModules, $updatedBy]);
    }

    public static function isModuleEnabled(PDO $pdo, ?int $companyId, string $moduleKey): bool {
        $modules = self::getCompanyModules($pdo, $companyId);
        return !empty($modules[$moduleKey]);
    }

    public static function requireModule(PDO $pdo, array $user, string $moduleKey, string $moduleLabel): void {
        if (($user['role'] ?? '') === 'super_admin') {
            return;
        }

        $companyId = isset($user['company_id']) ? (int)$user['company_id'] : 0;
        if ($companyId <= 0) {
            ApiResponse::forbidden('Company context is required for this action.');
        }

        if (!self::isModuleEnabled($pdo, $companyId, $moduleKey)) {
            ApiResponse::forbidden($moduleLabel . ' feature is disabled for your company plan.');
        }
    }
}
