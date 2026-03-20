<?php

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/auth.php';

function tableHasColumn(PDO $pdo, $tableName, $columnName) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$tableName, $columnName]);
    return (int)$stmt->fetchColumn() > 0;
}

function tableHasIndex(PDO $pdo, $tableName, $indexName) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
    $stmt->execute([$tableName, $indexName]);
    return (int)$stmt->fetchColumn() > 0;
}

function tableHasConstraint(PDO $pdo, $tableName, $constraintName) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?");
    $stmt->execute([$tableName, $constraintName]);
    return (int)$stmt->fetchColumn() > 0;
}

try {
    $pdo = getDBConnection();

    $pdo->exec("CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(20) NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_companies_name (name),
        INDEX idx_companies_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_roles_company_name (company_id, name),
        INDEX idx_roles_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_permissions_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        INDEX idx_role_permissions_permission (permission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS company_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        user_id INT NOT NULL,
        role_id INT NULL,
        role VARCHAR(100) NULL,
        is_default TINYINT(1) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_user (company_id, user_id),
        INDEX idx_company_users_user (user_id),
        INDEX idx_company_users_role_id (role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!tableHasColumn($pdo, 'users', 'company_id')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN company_id INT NULL AFTER phone");
        echo "Added users.company_id\n";
    }

    if (!tableHasColumn($pdo, 'users', 'role_id')) {
        $pdo->exec("ALTER TABLE users ADD COLUMN role_id INT NULL AFTER company_id");
        echo "Added users.role_id\n";
    }

    if (!tableHasIndex($pdo, 'users', 'idx_users_company_id')) {
        $pdo->exec("ALTER TABLE users ADD INDEX idx_users_company_id (company_id)");
    }

    if (!tableHasIndex($pdo, 'users', 'idx_users_role_id')) {
        $pdo->exec("ALTER TABLE users ADD INDEX idx_users_role_id (role_id)");
    }

    if (!tableHasConstraint($pdo, 'roles', 'fk_roles_company')) {
        $pdo->exec("ALTER TABLE roles ADD CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE");
    }

    if (!tableHasConstraint($pdo, 'role_permissions', 'fk_role_permissions_role')) {
        $pdo->exec("ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE");
    }

    if (!tableHasConstraint($pdo, 'role_permissions', 'fk_role_permissions_permission')) {
        $pdo->exec("ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE");
    }

    if (!tableHasConstraint($pdo, 'company_users', 'fk_company_users_company')) {
        $pdo->exec("ALTER TABLE company_users ADD CONSTRAINT fk_company_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE");
    }

    if (!tableHasConstraint($pdo, 'company_users', 'fk_company_users_user')) {
        $pdo->exec("ALTER TABLE company_users ADD CONSTRAINT fk_company_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
    }

    if (!tableHasConstraint($pdo, 'company_users', 'fk_company_users_role')) {
        $pdo->exec("ALTER TABLE company_users ADD CONSTRAINT fk_company_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL");
    }

    if (!tableHasConstraint($pdo, 'users', 'fk_users_company')) {
        $pdo->exec("ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL");
    }

    if (!tableHasConstraint($pdo, 'users', 'fk_users_role')) {
        $pdo->exec("ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL");
    }

    $stmt = $pdo->prepare("INSERT INTO companies (code, name, email, status)
        SELECT 'COMP0001', 'Default Company', 'admin@saasbooks.local', 'active'
        WHERE NOT EXISTS (SELECT 1 FROM companies WHERE code = 'COMP0001')");
    $stmt->execute();

    $defaultCompanyId = (int)$pdo->query("SELECT id FROM companies ORDER BY id ASC LIMIT 1")->fetchColumn();

    if ($defaultCompanyId <= 0) {
        throw new Exception('Unable to determine default company');
    }

    $pdo->prepare("UPDATE users SET company_id = ? WHERE company_id IS NULL")->execute([$defaultCompanyId]);

    $permissionIds = AuthHelper::ensurePermissions($pdo);

    $companyStmt = $pdo->query("SELECT id FROM companies");
    while ($company = $companyStmt->fetch()) {
        $companyId = (int)$company['id'];
        $roleIds = AuthHelper::ensureCompanyRoles($pdo, $companyId);
        AuthHelper::assignDefaultRolePermissions($pdo, $roleIds, $permissionIds);
    }

    $usersStmt = $pdo->query("SELECT id, company_id, role FROM users");
    $updateUserRole = $pdo->prepare("UPDATE users SET role_id = ? WHERE id = ?");
    $insertCompanyUser = $pdo->prepare("
        INSERT INTO company_users (company_id, user_id, role_id, role, is_default, status)
        VALUES (?, ?, ?, ?, 1, 'active')
        ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), role = VALUES(role), is_default = VALUES(is_default), status = VALUES(status)
    ");

    while ($user = $usersStmt->fetch()) {
        $companyId = (int)($user['company_id'] ?: $defaultCompanyId);
        $roleIds = AuthHelper::ensureCompanyRoles($pdo, $companyId);

        $legacyRole = $user['role'] ?? 'user';
        $mappedRole = 'user';
        if ($legacyRole === 'super_admin') {
            $mappedRole = 'owner';
        } elseif ($legacyRole === 'admin') {
            $mappedRole = 'admin';
        } elseif ($legacyRole === 'manager') {
            $mappedRole = 'manager';
        } elseif ($legacyRole === 'guest') {
            $mappedRole = 'viewer';
        }

        $roleId = $roleIds[$mappedRole] ?? ($roleIds['user'] ?? null);
        if ($roleId) {
            $updateUserRole->execute([$roleId, $user['id']]);
        }

        $insertCompanyUser->execute([$companyId, $user['id'], $roleId, $mappedRole]);
    }

    echo "SaaS tenant and RBAC migration completed successfully.\n";
} catch (Throwable $e) {
    echo 'Migration failed: ' . $e->getMessage() . "\n";
    exit(1);
}