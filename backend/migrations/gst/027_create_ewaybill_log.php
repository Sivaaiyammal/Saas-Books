<?php

class Migration_27_CreateEwaybillLog {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS ewaybill_log (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id       INT          NOT NULL,
                ewb_no           VARCHAR(20)  NOT NULL,
                ewb_date         DATETIME     NOT NULL,
                valid_upto       DATETIME     NOT NULL,
                transporter_id   VARCHAR(20)  NULL,
                transporter_name VARCHAR(200) NULL,
                vehicle_no       VARCHAR(20)  NULL,
                vehicle_type     ENUM('Regular','Over Dimensional Cargo') DEFAULT 'Regular',
                trans_mode       ENUM('Road','Rail','Air','Ship') DEFAULT 'Road',
                trans_distance   INT          DEFAULT 0,
                from_place       VARCHAR(100) NULL,
                to_place         VARCHAR(100) NULL,
                status           ENUM('generated','cancelled','expired','extended') DEFAULT 'generated',
                cancel_reason    TEXT         NULL,
                cancel_date      DATETIME     NULL,
                api_response     TEXT         NULL,
                error_message    TEXT         NULL,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_ewb_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
                UNIQUE KEY uq_ewb_no (ewb_no),
                INDEX idx_ewb_voucher    (voucher_id),
                INDEX idx_ewb_status     (status),
                INDEX idx_ewb_valid_upto (valid_upto)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS ewaybill_log");
    }
}
