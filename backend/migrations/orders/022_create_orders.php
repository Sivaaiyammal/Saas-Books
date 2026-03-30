<?php

class Migration_22_CreateOrders {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS orders (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                company_id       INT           NULL,
                order_type       ENUM('Sales','Purchase') NOT NULL,
                order_no         VARCHAR(50)   NOT NULL,
                order_date       DATE          NOT NULL,
                expected_date    DATE          NULL,
                party_ledger_id  INT           NOT NULL,
                billing_address  TEXT          NULL,
                shipping_address TEXT          NULL,
                total_qty        DECIMAL(15,3) DEFAULT 0.000,
                total_amount     DECIMAL(15,2) DEFAULT 0.00,
                discount_amount  DECIMAL(15,2) DEFAULT 0.00,
                tax_amount       DECIMAL(15,2) DEFAULT 0.00,
                grand_total      DECIMAL(15,2) DEFAULT 0.00,
                narration        TEXT          NULL,
                status           ENUM('Open','Partial','Completed','Cancelled') DEFAULT 'Open',
                created_by       INT           NULL,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_orders_party   FOREIGN KEY (party_ledger_id) REFERENCES ledgers(id) ON DELETE RESTRICT,
                CONSTRAINT fk_orders_user    FOREIGN KEY (created_by)      REFERENCES users(id)   ON DELETE SET NULL,
                UNIQUE KEY uq_orders (order_type, order_no, company_id),
                INDEX idx_orders_type    (order_type),
                INDEX idx_orders_no      (order_no),
                INDEX idx_orders_date    (order_date),
                INDEX idx_orders_party   (party_ledger_id),
                INDEX idx_orders_status  (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS orders");
    }
}
