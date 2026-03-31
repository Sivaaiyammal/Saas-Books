<?php

class Migration_26_UpdateVoucherUniqueIndex {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        // Ensure financial_year_id exists in vouchers table before adding index
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND COLUMN_NAME = 'financial_year_id'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $this->pdo->exec("ALTER TABLE vouchers ADD COLUMN financial_year_id INT NULL AFTER voucher_date");
        }

        // Drop the old unique key if it exists
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND INDEX_NAME = 'uq_vouchers'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() > 0) {
            $this->pdo->exec("ALTER TABLE vouchers DROP INDEX uq_vouchers");
        }
        
        // Add the new unique key including financial_year_id to allow numbering reset per year
        $this->pdo->exec("ALTER TABLE vouchers ADD UNIQUE KEY uq_vouchers (voucher_type, voucher_no, company_id, financial_year_id)");
        
        // Ensure we also have a standalone index for filtering, if not present
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND INDEX_NAME = 'idx_vouchers_financial_year_id'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $this->pdo->exec("ALTER TABLE vouchers ADD INDEX idx_vouchers_financial_year_id (financial_year_id)");
        }
    }

    public function down(): void {
        // Revert to old unique key
        $this->pdo->exec("ALTER TABLE vouchers DROP INDEX uq_vouchers");
        $this->pdo->exec("ALTER TABLE vouchers ADD UNIQUE KEY uq_vouchers (voucher_type, voucher_no, company_id)");
    }
}
