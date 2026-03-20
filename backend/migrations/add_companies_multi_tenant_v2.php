<?php
/**
 * Migration: Add companies (multi-tenant SaaS) support for V2
 * Run once: php backend/migrations/add_companies_multi_tenant_v2.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    $pdo->exec("CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(20) NULL,
        gstin VARCHAR(20) NULL,
        address TEXT NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        pincode VARCHAR(10) NULL,
        country VARCHAR(100) DEFAULT 'India',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_companies_status (status),
        INDEX idx_companies_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS company_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner', 'admin', 'manager', 'user', 'viewer') DEFAULT 'user',
        is_default TINYINT(1) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_company_users_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        CONSTRAINT fk_company_users_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE KEY uq_company_user (company_id, user_id),
        INDEX idx_company_users_user (user_id),
        INDEX idx_company_users_default (is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = $pdo->prepare("INSERT INTO companies (code, name, email, phone, status)
        SELECT 'COMP001', 'Default Company', 'admin@anutextiles.com', '9876543210', 'active'
        WHERE NOT EXISTS (SELECT 1 FROM companies WHERE code = 'COMP001')");
    $stmt->execute();

    $defaultCompanyIdStmt = $pdo->prepare("SELECT id FROM companies WHERE code = 'COMP001' LIMIT 1");
    $defaultCompanyIdStmt->execute();
    $defaultCompanyId = (int)$defaultCompanyIdStmt->fetchColumn();

    if ($defaultCompanyId <= 0) {
        throw new Exception('Default company creation failed');
    }

    $adminStmt = $pdo->prepare("SELECT id FROM users WHERE email = 'admin@anutextiles.com' LIMIT 1");
    $adminStmt->execute();
    $adminUserId = (int)$adminStmt->fetchColumn();

    if ($adminUserId > 0) {
        $linkStmt = $pdo->prepare("INSERT INTO company_users (company_id, user_id, role, is_default, status)
            SELECT ?, ?, 'owner', 1, 'active'
            WHERE NOT EXISTS (
                SELECT 1 FROM company_users WHERE company_id = ? AND user_id = ?
            )");
        $linkStmt->execute([$defaultCompanyId, $adminUserId, $defaultCompanyId, $adminUserId]);
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM financial_years");
    $fyCols = [];
    while ($row = $stmt->fetch()) {
        $fyCols[] = $row['Field'];
    }

    if (!in_array('company_id', $fyCols, true)) {
        $pdo->exec("ALTER TABLE financial_years ADD COLUMN company_id INT NULL AFTER id");
        echo "Added column: financial_years.company_id\n";
    }

    $tablesNeedingCompanyId = ['groups', 'ledgers', 'items', 'vouchers'];
    foreach ($tablesNeedingCompanyId as $tableName) {
        $stmt = $pdo->query("SHOW COLUMNS FROM `{$tableName}`");
        $cols = [];
        while ($row = $stmt->fetch()) {
            $cols[] = $row['Field'];
        }

        if (!in_array('company_id', $cols, true)) {
            $pdo->exec("ALTER TABLE `{$tableName}` ADD COLUMN company_id INT NULL AFTER id");
            echo "Added column: {$tableName}.company_id\n";
        }
    }

    $pdo->exec("UPDATE financial_years SET company_id = {$defaultCompanyId} WHERE company_id IS NULL");

    $fkChecks = [
        ['table' => 'groups', 'constraint' => 'fk_groups_company', 'column' => 'company_id'],
        ['table' => 'ledgers', 'constraint' => 'fk_ledgers_company', 'column' => 'company_id'],
        ['table' => 'items', 'constraint' => 'fk_items_company', 'column' => 'company_id'],
        ['table' => 'vouchers', 'constraint' => 'fk_vouchers_company', 'column' => 'company_id'],
        ['table' => 'financial_years', 'constraint' => 'fk_financial_years_company', 'column' => 'company_id'],
    ];

    foreach ($fkChecks as $fk) {
        $constraintCheck = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?");
        $constraintCheck->execute([$fk['table'], $fk['constraint']]);
        $exists = (int)$constraintCheck->fetchColumn() > 0;

        if (!$exists) {
            $pdo->exec("ALTER TABLE `{$fk['table']}` ADD CONSTRAINT `{$fk['constraint']}` FOREIGN KEY (`{$fk['column']}`) REFERENCES companies(id) ON DELETE SET NULL");
            echo "Added FK: {$fk['constraint']}\n";
        }
    }

    $pdo->exec("UPDATE `groups` SET company_id = {$defaultCompanyId} WHERE company_id IS NULL");
    $pdo->exec("UPDATE ledgers SET company_id = {$defaultCompanyId} WHERE company_id IS NULL");
    $pdo->exec("UPDATE items SET company_id = {$defaultCompanyId} WHERE company_id IS NULL");
    $pdo->exec("UPDATE vouchers SET company_id = {$defaultCompanyId} WHERE company_id IS NULL");

    $idxStmt = $pdo->prepare("SHOW INDEX FROM vouchers WHERE Key_name = 'idx_vouchers_company'");
    $idxStmt->execute();
    if (!$idxStmt->fetch()) {
        $pdo->exec("ALTER TABLE vouchers ADD INDEX idx_vouchers_company (company_id)");
    }

    $itemIdxStmt = $pdo->prepare("SHOW INDEX FROM items WHERE Key_name = 'idx_items_company'");
    $itemIdxStmt->execute();
    if (!$itemIdxStmt->fetch()) {
        $pdo->exec("ALTER TABLE items ADD INDEX idx_items_company (company_id)");
    }

    $fyIndexesStmt = $pdo->query("SHOW INDEX FROM financial_years");
    $fyIndexes = [];
    while ($idx = $fyIndexesStmt->fetch()) {
        $keyName = $idx['Key_name'];
        if (!isset($fyIndexes[$keyName])) {
            $fyIndexes[$keyName] = [
                'non_unique' => (int)$idx['Non_unique'],
                'columns' => []
            ];
        }
        $fyIndexes[$keyName]['columns'][] = $idx['Column_name'];
    }

    foreach ($fyIndexes as $keyName => $meta) {
        if ($keyName === 'PRIMARY') {
            continue;
        }

        $columns = $meta['columns'];
        if ($meta['non_unique'] === 0 && count($columns) === 1 && $columns[0] === 'code' && $keyName !== 'uq_financial_year_company') {
            $pdo->exec("ALTER TABLE financial_years DROP INDEX `{$keyName}`");
            echo "Dropped legacy unique index on financial_years.code: {$keyName}\n";
        }
    }

    $fyUniqueCheck = $pdo->prepare("SHOW INDEX FROM financial_years WHERE Key_name = 'uq_financial_year_company'");
    $fyUniqueCheck->execute();
    if (!$fyUniqueCheck->fetch()) {
        $pdo->exec("ALTER TABLE financial_years ADD UNIQUE KEY uq_financial_year_company (company_id, code)");
    }

    $insertFY = $pdo->prepare("INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status)
        SELECT ?, ?, ?, ?, ?, ?, 'active'
        WHERE NOT EXISTS (
            SELECT 1 FROM financial_years WHERE company_id = ? AND code = ?
        )");

    $insertFY->execute([$defaultCompanyId, '2024-25', 'FY 2024-25', '2024-04-01', '2025-03-31', 0, $defaultCompanyId, '2024-25']);
    $insertFY->execute([$defaultCompanyId, '2025-26', 'FY 2025-26', '2025-04-01', '2026-03-31', 1, $defaultCompanyId, '2025-26']);
    $insertFY->execute([$defaultCompanyId, '2026-27', 'FY 2026-27', '2026-04-01', '2027-03-31', 0, $defaultCompanyId, '2026-27']);

    echo "Multi-company V2 migration completed successfully.\n";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
