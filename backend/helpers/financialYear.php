<?php

class FinancialYearHelper {
    private static $bootstrapped = false;

    public static function bootstrap(PDO $pdo): void {
        if (self::$bootstrapped) {
            return;
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS financial_years (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NULL,
            code VARCHAR(9) NOT NULL,
            name VARCHAR(30) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            is_current TINYINT(1) DEFAULT 0,
            status ENUM('open','closed') DEFAULT 'open',
            closed_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_financial_year_company (company_id, code),
            INDEX idx_financial_years_company (company_id),
            INDEX idx_financial_years_current (is_current),
            INDEX idx_financial_years_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureVoucherColumns($pdo);
        self::$bootstrapped = true;
    }

    private static function ensureVoucherColumns(PDO $pdo): void {
        $table = 'vouchers';

        if (!self::hasColumn($pdo, $table, 'financial_year_id')) {
            $pdo->exec("ALTER TABLE vouchers ADD COLUMN financial_year_id INT NULL AFTER voucher_date");
        }

        if (!self::hasColumn($pdo, $table, 'financial_year')) {
            $pdo->exec("ALTER TABLE vouchers ADD COLUMN financial_year VARCHAR(9) NULL AFTER financial_year_id");
        }

        if (!self::hasIndex($pdo, $table, 'idx_vouchers_financial_year_id')) {
            $pdo->exec("ALTER TABLE vouchers ADD INDEX idx_vouchers_financial_year_id (financial_year_id)");
        }

        if (!self::hasIndex($pdo, $table, 'idx_vouchers_financial_year')) {
            $pdo->exec("ALTER TABLE vouchers ADD INDEX idx_vouchers_financial_year (financial_year)");
        }
    }

    private static function hasColumn(PDO $pdo, string $table, string $column): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    private static function hasIndex(PDO $pdo, string $table, string $indexName): bool {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
        $stmt->execute([$table, $indexName]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    public static function yearMetaFromDate(string $date): array {
        $dt = new DateTime($date);
        $year = (int)$dt->format('Y');
        $month = (int)$dt->format('n');
        $startYear = $month >= 4 ? $year : ($year - 1);
        $endYear = $startYear + 1;

        return [
            'code' => sprintf('%04d-%02d', $startYear, $endYear % 100),
            'name' => sprintf('FY %04d-%02d', $startYear, $endYear % 100),
            'start_date' => sprintf('%04d-04-01', $startYear),
            'end_date' => sprintf('%04d-03-31', $endYear),
        ];
    }

    public static function ensureYear(PDO $pdo, ?int $companyId, string $date): array {
        self::bootstrap($pdo);
        $meta = self::yearMetaFromDate($date);

        $stmt = $pdo->prepare("SELECT * FROM financial_years WHERE company_id <=> ? AND code = ? LIMIT 1");
        $stmt->execute([$companyId, $meta['code']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            return $row;
        }

        $currentCountStmt = $pdo->prepare("SELECT COUNT(*) FROM financial_years WHERE company_id <=> ? AND is_current = 1");
        $currentCountStmt->execute([$companyId]);
        $hasCurrent = ((int)$currentCountStmt->fetchColumn()) > 0;

        $insert = $pdo->prepare("INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status) VALUES (?, ?, ?, ?, ?, ?, 'open')");
        $insert->execute([
            $companyId,
            $meta['code'],
            $meta['name'],
            $meta['start_date'],
            $meta['end_date'],
            $hasCurrent ? 0 : 1,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM financial_years WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function seedFromVouchers(PDO $pdo, ?int $companyId): void {
        self::bootstrap($pdo);

        $stmt = $pdo->prepare("SELECT DISTINCT voucher_date FROM vouchers WHERE company_id <=> ? ORDER BY voucher_date ASC");
        $stmt->execute([$companyId]);
        $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($dates as $date) {
            if ($date) {
                self::ensureYear($pdo, $companyId, (string)$date);
            }
        }
    }

    public static function listYears(PDO $pdo, ?int $companyId): array {
        self::seedFromVouchers($pdo, $companyId);

        $stmt = $pdo->prepare("SELECT * FROM financial_years WHERE company_id <=> ? ORDER BY start_date DESC");
        $stmt->execute([$companyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public static function setCurrent(PDO $pdo, ?int $companyId, int $financialYearId): array {
        self::bootstrap($pdo);

        $stmt = $pdo->prepare("SELECT * FROM financial_years WHERE id = ? AND company_id <=> ? LIMIT 1");
        $stmt->execute([$financialYearId, $companyId]);
        $fy = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$fy) {
            throw new Exception('Financial year not found');
        }

        $pdo->prepare("UPDATE financial_years SET is_current = 0 WHERE company_id <=> ?")->execute([$companyId]);
        $pdo->prepare("UPDATE financial_years SET is_current = 1 WHERE id = ?")->execute([$financialYearId]);

        $stmt->execute([$financialYearId, $companyId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public static function getById(PDO $pdo, ?int $companyId, int $financialYearId): ?array {
        self::bootstrap($pdo);

        $stmt = $pdo->prepare("SELECT * FROM financial_years WHERE id = ? AND company_id <=> ? LIMIT 1");
        $stmt->execute([$financialYearId, $companyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function isVoucherYearClosed(PDO $pdo, int $voucherId): bool {
        self::bootstrap($pdo);

        $stmt = $pdo->prepare("SELECT fy.status
            FROM vouchers v
            LEFT JOIN financial_years fy ON fy.id = v.financial_year_id
            WHERE v.id = ?
            LIMIT 1");
        $stmt->execute([$voucherId]);
        $status = $stmt->fetchColumn();

        return $status === 'closed';
    }
}
