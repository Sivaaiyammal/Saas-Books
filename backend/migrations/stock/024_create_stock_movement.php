<?php

class Migration_24_CreateStockMovement {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS stock_movement (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT           NOT NULL,
                quantity   DECIMAL(15,3) NOT NULL,
                type       ENUM('Opening','purchase','sales','adjustment','return','damage') NOT NULL,
                reference  VARCHAR(100)  NULL,
                user_id    INT           NULL,
                notes      TEXT          NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES items(id) ON DELETE CASCADE,
                CONSTRAINT fk_sm_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_sm_product (product_id),
                INDEX idx_sm_type    (type),
                INDEX idx_sm_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS stock_movement");
    }
}
