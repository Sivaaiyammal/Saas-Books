<?php

class Migration_3_CreateCompanies {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS companies (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                code       VARCHAR(20)  NOT NULL UNIQUE,
                name       VARCHAR(150) NOT NULL,
                email      VARCHAR(100) NULL,
                phone      VARCHAR(20)  NULL,
                gstin      VARCHAR(20)  NULL,
                address    TEXT         NULL,
                city       VARCHAR(100) NULL,
                state      VARCHAR(100) NULL,
                pincode    VARCHAR(10)  NULL,
                country    VARCHAR(100) DEFAULT 'India',
                status     ENUM('active','inactive') DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_companies_status (status),
                INDEX idx_companies_name   (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->pdo->exec("
            INSERT INTO companies (code, name, email, phone, status)
            SELECT 'COMP001','Default Company','admin@anutextiles.com','9876543210','active'
            WHERE NOT EXISTS (SELECT 1 FROM companies WHERE code = 'COMP001')
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS companies");
    }
}
