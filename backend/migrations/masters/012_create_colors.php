<?php

class Migration_12_CreateColors {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS colors (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(100) NOT NULL,
                code        VARCHAR(20)  NULL,
                hex_code    VARCHAR(7)   NULL,
                description TEXT         NULL,
                status      ENUM('active','inactive') DEFAULT 'active',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_color_name (name),
                INDEX idx_colors_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS colors");
    }
}
