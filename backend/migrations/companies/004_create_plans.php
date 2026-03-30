<?php

class Migration_4_CreatePlans {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS plans (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                code           VARCHAR(30)    NOT NULL UNIQUE,
                name           VARCHAR(100)   NOT NULL,
                amount         DECIMAL(12,2)  NOT NULL,
                currency       VARCHAR(10)    DEFAULT 'INR',
                validity_days  INT            NOT NULL DEFAULT 30,
                status         ENUM('active','inactive') DEFAULT 'active',
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_plans_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->pdo->exec("
            INSERT INTO plans (code, name, amount, currency, validity_days, status) VALUES
            ('BASIC_MONTHLY', 'Basic Monthly',  999.00, 'INR',  30, 'active'),
            ('PRO_MONTHLY',   'Pro Monthly',   2499.00, 'INR',  30, 'active'),
            ('PRO_YEARLY',    'Pro Yearly',   24999.00, 'INR', 365, 'active')
            ON DUPLICATE KEY UPDATE name = VALUES(name)
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS plans");
    }
}
