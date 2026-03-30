<?php

class Migration_8_CreateGodowns {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS godowns (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                name         VARCHAR(100) NOT NULL UNIQUE,
                code         VARCHAR(20)  NULL,
                address      TEXT         NULL,
                city         VARCHAR(100) NULL,
                state        VARCHAR(100) NULL,
                pincode      VARCHAR(10)  NULL,
                gstin        VARCHAR(20)  NULL,
                phone        VARCHAR(20)  NULL,
                email        VARCHAR(100) NULL,
                manager_name VARCHAR(100) NULL,
                capacity     DECIMAL(15,2) NULL,
                is_default   TINYINT(1)   DEFAULT 0,
                description  TEXT         NULL,
                status       ENUM('active','inactive') DEFAULT 'active',
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_godowns_code       (code),
                INDEX idx_godowns_status     (status),
                INDEX idx_godowns_is_default (is_default)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Default main godown
        $this->pdo->exec("
            INSERT INTO godowns (name, code, is_default, status)
            SELECT 'Main Godown', 'MAIN', 1, 'active'
            WHERE NOT EXISTS (SELECT 1 FROM godowns WHERE code = 'MAIN')
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS godowns");
    }
}
