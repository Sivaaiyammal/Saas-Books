<?php

class Migration_1_CreateUsers {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                name               VARCHAR(100) NOT NULL,
                email              VARCHAR(100) NOT NULL UNIQUE,
                password           VARCHAR(255) NOT NULL,
                phone              VARCHAR(20)  NULL,
                profile_image      VARCHAR(255) NULL,
                role               ENUM('super_admin','admin','manager','user','guest') DEFAULT 'user',
                status             ENUM('active','inactive','suspended') DEFAULT 'active',
                reset_token        VARCHAR(64)  NULL,
                reset_token_expiry DATETIME     NULL,
                last_login         DATETIME     NULL,
                created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
                updated_at         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_users_email  (email),
                INDEX idx_users_status (status),
                INDEX idx_users_role   (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Default admin — password: Admin@123
        $this->pdo->exec("
            INSERT INTO users (name, email, password, role, status)
            SELECT 'Admin User', 'admin@anutextiles.com',
                   '\$2y\$12\$LQv3c1yycUGdQvDN3ZRYPeXq6F3KUgvLhKqZJHXGFhLjqHxS9K3xG',
                   'admin', 'active'
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@anutextiles.com')
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS users");
    }
}
