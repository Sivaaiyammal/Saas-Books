<?php

class Migration_25_CreateEwbSettings {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS ewb_settings (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                gstin          VARCHAR(20)  NOT NULL,
                username       VARCHAR(100) NOT NULL,
                ewbpwd         VARCHAR(255) NOT NULL,
                from_trade_name VARCHAR(150) NULL,
                from_addr1     VARCHAR(200) NULL,
                from_addr2     VARCHAR(200) NULL,
                from_place     VARCHAR(100) NULL,
                from_state     VARCHAR(100) NULL,
                from_pincode   VARCHAR(10)  NULL,
                from_state_code VARCHAR(5)  NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_ewb_gstin (gstin)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS ewb_settings");
    }
}
