<?php

class Migration_6_CreateSubscriptions {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS subscriptions (
                id                INT AUTO_INCREMENT PRIMARY KEY,
                company_id        INT           NOT NULL,
                user_id           INT           NOT NULL,
                plan_id           INT           NOT NULL,
                status            ENUM('pending','active','expired','cancelled') DEFAULT 'pending',
                payment_status    ENUM('pending','paid','failed','refunded')     DEFAULT 'pending',
                amount_paid       DECIMAL(12,2) DEFAULT 0.00,
                payment_reference VARCHAR(100)  NULL,
                start_date        DATE          NULL,
                end_date          DATE          NULL,
                paid_at           DATETIME      NULL,
                created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
                updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_sub_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_sub_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
                CONSTRAINT fk_sub_plan    FOREIGN KEY (plan_id)    REFERENCES plans(id)    ON DELETE RESTRICT,
                INDEX idx_sub_company  (company_id),
                INDEX idx_sub_user     (user_id),
                INDEX idx_sub_status   (status),
                INDEX idx_sub_end_date (end_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS subscriptions");
    }
}
