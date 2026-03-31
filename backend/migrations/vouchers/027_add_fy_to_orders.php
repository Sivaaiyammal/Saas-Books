<?php

class Migration_27_AddFyToOrders {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        // 1. Add financial_year_id column if missing
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'financial_year_id'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $this->pdo->exec("ALTER TABLE orders ADD COLUMN financial_year_id INT NULL AFTER order_date");
        }
        
        // 2. Update existing records with appropriate FY IDs based on date if possible
        // (This is a simplified backfill; in production, you'd match dates against financial_years table)
        $this->pdo->exec("
            UPDATE orders o
            SET o.financial_year_id = (
                SELECT fy.id FROM financial_years fy
                WHERE fy.company_id = o.company_id 
                  AND o.order_date BETWEEN fy.start_date AND fy.end_date
                LIMIT 1
            )
            WHERE o.financial_year_id IS NULL
        ");

        // 3. Update Unique Key
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'uq_orders'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() > 0) {
            $this->pdo->exec("ALTER TABLE orders DROP INDEX uq_orders");
        }
        $this->pdo->exec("ALTER TABLE orders ADD UNIQUE KEY uq_orders (order_type, order_no, company_id, financial_year_id)");

        // 4. Add index for better filtering
        $this->pdo->exec("ALTER TABLE orders ADD INDEX idx_orders_fy (financial_year_id)");
    }

    public function down(): void {
        $this->pdo->exec("ALTER TABLE orders DROP INDEX uq_orders");
        $this->pdo->exec("ALTER TABLE orders ADD UNIQUE KEY uq_orders (order_type, order_no, company_id)");
        $this->pdo->exec("ALTER TABLE orders DROP INDEX idx_orders_fy");
        $this->pdo->exec("ALTER TABLE orders DROP COLUMN financial_year_id");
    }
}
