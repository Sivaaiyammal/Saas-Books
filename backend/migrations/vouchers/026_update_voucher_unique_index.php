<?php

class Migration_26_UpdateVoucherUniqueIndex {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        // Drop the old unique key
        $this->pdo->exec("ALTER TABLE vouchers DROP INDEX uq_vouchers");
        
        // Add the new unique key including financial_year_id to allow numbering reset per year
        $this->pdo->exec("ALTER TABLE vouchers ADD UNIQUE KEY uq_vouchers (voucher_type, voucher_no, company_id, financial_year_id)");
    }

    public function down(): void {
        // Revert to old unique key
        $this->pdo->exec("ALTER TABLE vouchers DROP INDEX uq_vouchers");
        $this->pdo->exec("ALTER TABLE vouchers ADD UNIQUE KEY uq_vouchers (voucher_type, voucher_no, company_id)");
    }
}
