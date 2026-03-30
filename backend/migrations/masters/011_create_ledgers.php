<?php

class Migration_11_CreateLedgers {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS ledgers (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                company_id      INT           NULL,
                group_id        INT           NOT NULL,
                name            VARCHAR(150)  NOT NULL,
                opening_balance DECIMAL(15,2) DEFAULT 0.00,
                opening_type    ENUM('Dr','Cr') DEFAULT 'Dr',
                bill_by_bill    TINYINT(1)    DEFAULT 0,
                gst_applicable  TINYINT(1)    DEFAULT 0,
                gst_number      VARCHAR(20)   NULL,
                bank_name       VARCHAR(100)  NULL,
                bank_branch     VARCHAR(100)  NULL,
                account_number  VARCHAR(30)   NULL,
                ifsc_code       VARCHAR(11)   NULL,
                is_default_bank TINYINT(1)    DEFAULT 0,
                address         TEXT          NULL,
                city            VARCHAR(100)  NULL,
                state           VARCHAR(100)  NULL,
                pincode         VARCHAR(10)   NULL,
                phone           VARCHAR(20)   NULL,
                email           VARCHAR(100)  NULL,
                status          ENUM('active','inactive') DEFAULT 'active',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_ledgers_group   FOREIGN KEY (group_id)   REFERENCES `groups`(id)   ON DELETE RESTRICT,
                CONSTRAINT fk_ledgers_company FOREIGN KEY (company_id) REFERENCES companies(id)  ON DELETE SET NULL,
                INDEX idx_ledgers_company        (company_id),
                INDEX idx_ledgers_group          (group_id),
                INDEX idx_ledgers_name           (name),
                INDEX idx_ledgers_status         (status),
                INDEX idx_ledgers_gst            (gst_number),
                INDEX idx_ledgers_is_default_bank(is_default_bank)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS ledgers");
    }
}
