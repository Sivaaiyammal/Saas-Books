<?php

class Migration_20_CreateBillAllocations {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS bill_allocations (
                id                   INT AUTO_INCREMENT PRIMARY KEY,
                ledger_id            INT           NOT NULL,
                voucher_entry_id     INT           NOT NULL,
                bill_no              VARCHAR(50)   NOT NULL,
                bill_date            DATE          NULL,
                amount               DECIMAL(15,2) NOT NULL,
                type                 ENUM('New','Against','On Account') NOT NULL DEFAULT 'New',
                pending_amount       DECIMAL(15,2) NOT NULL,
                reference_voucher_id INT           NULL,
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_ba_ledger     FOREIGN KEY (ledger_id)            REFERENCES ledgers(id)         ON DELETE RESTRICT,
                CONSTRAINT fk_ba_entry      FOREIGN KEY (voucher_entry_id)     REFERENCES voucher_entries(id) ON DELETE CASCADE,
                CONSTRAINT fk_ba_ref_voucher FOREIGN KEY (reference_voucher_id) REFERENCES vouchers(id)       ON DELETE SET NULL,
                INDEX idx_ba_ledger  (ledger_id),
                INDEX idx_ba_bill_no (bill_no),
                INDEX idx_ba_type    (type),
                INDEX idx_ba_pending (pending_amount)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS bill_allocations");
    }
}
