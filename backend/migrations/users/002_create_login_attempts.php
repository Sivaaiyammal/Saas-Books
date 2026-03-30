<?php

class Migration_2_CreateLoginAttempts {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS login_attempts (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                email        VARCHAR(100) NOT NULL,
                success      TINYINT(1)   DEFAULT 0,
                ip_address   VARCHAR(45)  NULL,
                attempted_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_attempts_email_time (email, attempted_at),
                INDEX idx_attempts_success    (success)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS login_attempts");
    }
}
