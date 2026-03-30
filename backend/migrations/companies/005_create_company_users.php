<?php

class Migration_5_CreateCompanyUsers {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS company_users (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                user_id    INT NOT NULL,
                role       ENUM('owner','admin','manager','user','viewer') DEFAULT 'user',
                is_default TINYINT(1) DEFAULT 0,
                status     ENUM('active','inactive') DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_cu_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_cu_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
                UNIQUE KEY uq_company_user (company_id, user_id),
                INDEX idx_cu_user    (user_id),
                INDEX idx_cu_default (is_default)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Assign default admin to the default company as owner
        $this->pdo->exec("
            INSERT INTO company_users (company_id, user_id, role, is_default, status)
            SELECT c.id, u.id, 'owner', 1, 'active'
            FROM   companies c
            JOIN   users u ON u.email = 'admin@anutextiles.com'
            WHERE  c.code = 'COMP001'
            AND NOT EXISTS (
                SELECT 1 FROM company_users cu
                WHERE cu.company_id = c.id AND cu.user_id = u.id
            )
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS company_users");
    }
}
