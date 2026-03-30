<?php

class Migration_26_CreateEinvoiceLog {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS einvoice_log (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id     INT          NOT NULL,
                irn            VARCHAR(100) NOT NULL,
                ack_no         VARCHAR(50)  NULL,
                ack_date       DATETIME     NULL,
                signed_invoice TEXT         NULL,
                signed_qr_code TEXT         NULL,
                status         ENUM('generated','cancelled','failed') DEFAULT 'generated',
                cancel_reason  TEXT         NULL,
                cancel_date    DATETIME     NULL,
                api_response   TEXT         NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_einvoice_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
                UNIQUE KEY uq_irn (irn),
                INDEX idx_einvoice_voucher (voucher_id),
                INDEX idx_einvoice_status  (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS einvoice_log");
    }
}
