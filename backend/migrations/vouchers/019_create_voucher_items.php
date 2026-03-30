<?php

class Migration_19_CreateVoucherItems {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS voucher_items (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id       INT           NOT NULL,
                product_id       INT           NULL,
                item_name        VARCHAR(200)  NOT NULL,
                colour           VARCHAR(100)  NULL,
                quantity         DECIMAL(15,3) NOT NULL,
                unit_id          INT           NULL,
                rate             DECIMAL(15,2) NOT NULL,
                discount_percent DECIMAL(5,2)  DEFAULT 0.00,
                discount_amount  DECIMAL(15,2) DEFAULT 0.00,
                tax_id           INT           NULL,
                tax_percent      DECIMAL(5,2)  DEFAULT 0.00,
                cgst             DECIMAL(15,2) DEFAULT 0.00,
                sgst             DECIMAL(15,2) DEFAULT 0.00,
                igst             DECIMAL(15,2) DEFAULT 0.00,
                tax_amount       DECIMAL(15,2) DEFAULT 0.00,
                amount           DECIMAL(15,2) NOT NULL,
                godown_id        INT           NULL,
                order_item_id    INT           NULL,
                description      TEXT          NULL,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_vi_voucher  FOREIGN KEY (voucher_id)  REFERENCES vouchers(id)  ON DELETE CASCADE,
                CONSTRAINT fk_vi_product  FOREIGN KEY (product_id)  REFERENCES items(id)     ON DELETE SET NULL,
                CONSTRAINT fk_vi_unit     FOREIGN KEY (unit_id)     REFERENCES units(id)     ON DELETE SET NULL,
                CONSTRAINT fk_vi_tax      FOREIGN KEY (tax_id)      REFERENCES taxes(id)     ON DELETE SET NULL,
                CONSTRAINT fk_vi_godown   FOREIGN KEY (godown_id)   REFERENCES godowns(id)   ON DELETE SET NULL,
                INDEX idx_vi_voucher  (voucher_id),
                INDEX idx_vi_product  (product_id),
                INDEX idx_vi_godown   (godown_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS voucher_items");
    }
}
