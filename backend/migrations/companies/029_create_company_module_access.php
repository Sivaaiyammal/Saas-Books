<?php

class Migration_29_CreateCompanyModuleAccess {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS company_module_access (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                company_id   INT NOT NULL,
                modules_json TEXT NOT NULL,
                updated_by   INT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_company_modules (company_id),
                CONSTRAINT fk_cma_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_cma_user    FOREIGN KEY (updated_by) REFERENCES users(id)     ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS company_module_access");
    }
}
