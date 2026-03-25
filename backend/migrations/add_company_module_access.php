<?php
/**
 * Migration: Add per-company module access settings
 * Run once: php backend/migrations/add_company_module_access.php
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/moduleAccess.php';

try {
    $pdo = getDBConnection();

    $pdo->exec("CREATE TABLE IF NOT EXISTS company_module_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        modules_json JSON NOT NULL,
        updated_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_company_module_access_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        CONSTRAINT fk_company_module_access_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
        UNIQUE KEY uq_company_module_access_company (company_id),
        INDEX idx_company_module_access_updated_by (updated_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $defaults = json_encode(ModuleAccessHelper::defaultModules(), JSON_UNESCAPED_SLASHES);

    $stmt = $pdo->prepare(
        "INSERT INTO company_module_access (company_id, modules_json, created_at, updated_at)
         SELECT c.id, ?, NOW(), NOW()
         FROM companies c
         LEFT JOIN company_module_access cma ON cma.company_id = c.id
         WHERE cma.id IS NULL"
    );
    $stmt->execute([$defaults]);

    echo "Company module access migration completed successfully.\n";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
