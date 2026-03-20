<?php
/**
 * Migration: Add financial year support for V2 vouchers
 * Run once via CLI: php backend/migrations/add_financial_year_to_v2_vouchers.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    $stmt = $pdo->query("SHOW COLUMNS FROM vouchers");
    $columns = [];
    while ($row = $stmt->fetch()) {
        $columns[] = $row['Field'];
    }

    if (!in_array('financial_year', $columns, true)) {
        $pdo->exec("ALTER TABLE vouchers ADD COLUMN financial_year VARCHAR(9) NULL AFTER voucher_date");
        echo "Added column: vouchers.financial_year\n";
    } else {
        echo "Skipped column: vouchers.financial_year already exists\n";
    }

    if (!in_array('financial_year_id', $columns, true)) {
        $pdo->exec("ALTER TABLE vouchers ADD COLUMN financial_year_id INT NULL AFTER voucher_date");
        echo "Added column: vouchers.financial_year_id\n";
    } else {
        echo "Skipped column: vouchers.financial_year_id already exists\n";
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS financial_years (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(9) NOT NULL UNIQUE,
        name VARCHAR(30) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current TINYINT(1) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_financial_years_current (is_current),
        INDEX idx_financial_years_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "Ensured table: financial_years\n";

    $fkStmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND CONSTRAINT_NAME = 'fk_vouchers_financial_year'");
    $fkStmt->execute();
    $fkExists = (int)$fkStmt->fetchColumn() > 0;

    if (!$fkExists) {
        $pdo->exec("ALTER TABLE vouchers ADD CONSTRAINT fk_vouchers_financial_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE SET NULL");
        echo "Added FK: fk_vouchers_financial_year\n";
    } else {
        echo "Skipped FK: fk_vouchers_financial_year already exists\n";
    }

    $indexStmt = $pdo->prepare("SHOW INDEX FROM vouchers WHERE Key_name = 'idx_vouchers_financial_year'");
    $indexStmt->execute();
    $indexExists = (bool)$indexStmt->fetch();

    if (!$indexExists) {
        $pdo->exec("ALTER TABLE vouchers ADD INDEX idx_vouchers_financial_year (financial_year)");
        echo "Added index: idx_vouchers_financial_year\n";
    } else {
        echo "Skipped index: idx_vouchers_financial_year already exists\n";
    }

    $pdo->exec("UPDATE financial_years SET is_current = 0");

    $insert = $pdo->prepare("INSERT INTO financial_years (code, name, start_date, end_date, is_current, status)
        SELECT ?, ?, ?, ?, ?, 'active'
        WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE code = ?)");

    $insert->execute(['2024-25', 'FY 2024-25', '2024-04-01', '2025-03-31', 0, '2024-25']);
    $insert->execute(['2025-26', 'FY 2025-26', '2025-04-01', '2026-03-31', 1, '2025-26']);
    $insert->execute(['2026-27', 'FY 2026-27', '2026-04-01', '2027-03-31', 0, '2026-27']);

    echo "Seeded financial_years\n";
    echo "Migration completed successfully.\n";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
