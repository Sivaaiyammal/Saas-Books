<?php

class Migration_18_CreateVoucherEntries {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS voucher_entries (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id     INT           NOT NULL,
                ledger_id      INT           NOT NULL,
                amount         DECIMAL(15,2) NOT NULL,
                dr_cr          ENUM('Dr','Cr') NOT NULL,
                bill_reference VARCHAR(50)   NULL,
                description    TEXT          NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_ve_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
                CONSTRAINT fk_ve_ledger  FOREIGN KEY (ledger_id)  REFERENCES ledgers(id)  ON DELETE RESTRICT,
                INDEX idx_ve_voucher (voucher_id),
                INDEX idx_ve_ledger  (ledger_id),
                INDEX idx_ve_dr_cr   (dr_cr)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS voucher_entries");
    }
}
