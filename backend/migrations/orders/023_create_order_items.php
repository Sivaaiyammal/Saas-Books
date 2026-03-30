<?php

class Migration_23_CreateOrderItems {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS order_items (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                order_id         INT           NOT NULL,
                item_id          INT           NOT NULL,
                item_name        VARCHAR(200)  NOT NULL,
                unit_id          INT           NULL,
                ordered_qty      DECIMAL(15,3) NOT NULL,
                billed_qty       DECIMAL(15,3) DEFAULT 0.000,
                pending_qty      DECIMAL(15,3) NOT NULL,
                rate             DECIMAL(15,2) NOT NULL,
                discount_percent DECIMAL(5,2)  DEFAULT 0.00,
                discount_amount  DECIMAL(15,2) DEFAULT 0.00,
                tax_id           INT           NULL,
                tax_percent      DECIMAL(5,2)  DEFAULT 0.00,
                tax_amount       DECIMAL(15,2) DEFAULT 0.00,
                amount           DECIMAL(15,2) NOT NULL,
                godown_id        INT           NULL,
                description      TEXT          NULL,
                status           ENUM('Pending','Partial','Completed','Cancelled') DEFAULT 'Pending',
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)  REFERENCES orders(id)   ON DELETE CASCADE,
                CONSTRAINT fk_oi_item    FOREIGN KEY (item_id)   REFERENCES items(id)    ON DELETE RESTRICT,
                CONSTRAINT fk_oi_unit    FOREIGN KEY (unit_id)   REFERENCES units(id)    ON DELETE SET NULL,
                CONSTRAINT fk_oi_tax     FOREIGN KEY (tax_id)    REFERENCES taxes(id)    ON DELETE SET NULL,
                CONSTRAINT fk_oi_godown  FOREIGN KEY (godown_id) REFERENCES godowns(id)  ON DELETE SET NULL,
                INDEX idx_oi_order   (order_id),
                INDEX idx_oi_item    (item_id),
                INDEX idx_oi_status  (status),
                INDEX idx_oi_pending (pending_qty)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS order_items");
    }
}
