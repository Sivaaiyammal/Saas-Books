<?php

class Migration_21_CreateVoucherCharges {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS voucher_charges (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id  INT           NOT NULL,
                charge_name VARCHAR(100)  NOT NULL COMMENT 'e.g. Transport, Packing, Loading',
                amount      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_vc_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
                INDEX idx_vc_voucher (voucher_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS voucher_charges");
    }
}
