<?php

class Migration_17_CreateVouchers {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS vouchers (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                company_id               INT           NULL,
                voucher_type             ENUM('Sales','Purchase','Receipt','Payment',
                                              'Sales Order','Purchase Order','Quotation',
                                              'Contra','Journal') NOT NULL,
                voucher_no               VARCHAR(50)   NOT NULL,
                voucher_date             DATE          NOT NULL,
                financial_year_id        INT           NULL,
                financial_year           VARCHAR(9)    NULL,
                reference_no             VARCHAR(50)   NULL,
                party_ledger_id          INT           NULL,
                -- Billing (Bill To)
                billing_name             VARCHAR(200)  NULL,
                billing_address          TEXT          NULL,
                billing_city             VARCHAR(100)  NULL,
                billing_state            VARCHAR(100)  NULL,
                billing_pincode          VARCHAR(10)   NULL,
                billing_gstin            VARCHAR(20)   NULL,
                billing_phone            VARCHAR(20)   NULL,
                -- Consignee (Ship To)
                consignee_same_as_billing TINYINT(1)   DEFAULT 1,
                consignee_name           VARCHAR(200)  NULL,
                consignee_address        TEXT          NULL,
                consignee_city           VARCHAR(100)  NULL,
                consignee_state          VARCHAR(100)  NULL,
                consignee_pincode        VARCHAR(10)   NULL,
                consignee_gstin          VARCHAR(20)   NULL,
                consignee_phone          VARCHAR(20)   NULL,
                place_of_supply          VARCHAR(100)  NULL,
                -- Totals
                total_amount             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                narration                TEXT          NULL,
                status                   ENUM('draft','posted','cancelled') DEFAULT 'posted',
                created_by               INT           NULL,
                created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_vouchers_company        FOREIGN KEY (company_id)        REFERENCES companies(id)       ON DELETE SET NULL,
                CONSTRAINT fk_vouchers_party          FOREIGN KEY (party_ledger_id)   REFERENCES ledgers(id)         ON DELETE SET NULL,
                CONSTRAINT fk_vouchers_user           FOREIGN KEY (created_by)        REFERENCES users(id)           ON DELETE SET NULL,
                CONSTRAINT fk_vouchers_financial_year FOREIGN KEY (financial_year_id) REFERENCES financial_years(id) ON DELETE SET NULL,
                UNIQUE KEY uq_vouchers (voucher_type, voucher_no, company_id),
                INDEX idx_vouchers_company        (company_id),
                INDEX idx_vouchers_type           (voucher_type),
                INDEX idx_vouchers_no             (voucher_no),
                INDEX idx_vouchers_date           (voucher_date),
                INDEX idx_vouchers_party          (party_ledger_id),
                INDEX idx_vouchers_financial_year (financial_year),
                INDEX idx_vouchers_status         (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS vouchers");
    }
}
