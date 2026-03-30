<?php

class Migration_16_CreateFinancialYears {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS financial_years (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT         NULL,
                code       VARCHAR(9)  NOT NULL,
                name       VARCHAR(30) NOT NULL,
                start_date DATE        NOT NULL,
                end_date   DATE        NOT NULL,
                is_current TINYINT(1)  DEFAULT 0,
                status     ENUM('active','inactive') DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_fy_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uq_fy_company_code (company_id, code),
                INDEX idx_fy_company (company_id),
                INDEX idx_fy_current (is_current),
                INDEX idx_fy_status  (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Seed FY 2024-25, 2025-26 (current), 2026-27 for the default company
        $this->pdo->exec("
            INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status)
            SELECT c.id, '2024-25', 'FY 2024-25', '2024-04-01', '2025-03-31', 0, 'active'
            FROM companies c WHERE c.code = 'COMP001'
            AND NOT EXISTS (SELECT 1 FROM financial_years fy WHERE fy.company_id = c.id AND fy.code = '2024-25')
        ");

        $this->pdo->exec("
            INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status)
            SELECT c.id, '2025-26', 'FY 2025-26', '2025-04-01', '2026-03-31', 1, 'active'
            FROM companies c WHERE c.code = 'COMP001'
            AND NOT EXISTS (SELECT 1 FROM financial_years fy WHERE fy.company_id = c.id AND fy.code = '2025-26')
        ");

        $this->pdo->exec("
            INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status)
            SELECT c.id, '2026-27', 'FY 2026-27', '2026-04-01', '2027-03-31', 0, 'active'
            FROM companies c WHERE c.code = 'COMP001'
            AND NOT EXISTS (SELECT 1 FROM financial_years fy WHERE fy.company_id = c.id AND fy.code = '2026-27')
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS financial_years");
    }
}
