<?php

class Migration_25_AddFyToTransactions {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $tables = ['voucher_entries', 'voucher_items', 'stock_movement', 'bill_allocations'];

        foreach ($tables as $table) {
            if (!$this->hasColumn($table, 'financial_year_id')) {
                $this->pdo->exec("ALTER TABLE `$table` ADD COLUMN financial_year_id INT NULL AFTER created_at");
            }

            if (!$this->hasIndex($table, 'idx_company_fy')) {
                // Ensure company_id exists before indexing
                if ($this->hasColumn($table, 'company_id')) {
                    $this->pdo->exec("ALTER TABLE `$table` ADD INDEX idx_company_fy (company_id, financial_year_id)");
                } else {
                    $this->pdo->exec("ALTER TABLE `$table` ADD INDEX idx_fy (financial_year_id)");
                }
            }
        }
    }

    public function down(): void {
        $tables = ['voucher_entries', 'voucher_items', 'stock_movement', 'bill_allocations'];
        foreach ($tables as $table) {
            if ($this->hasIndex($table, 'idx_company_fy')) {
                $this->pdo->exec("ALTER TABLE `$table` DROP INDEX idx_company_fy");
            }
            if ($this->hasIndex($table, 'idx_fy')) {
                $this->pdo->exec("ALTER TABLE `$table` DROP INDEX idx_fy");
            }
            if ($this->hasColumn($table, 'financial_year_id')) {
                $this->pdo->exec("ALTER TABLE `$table` DROP COLUMN financial_year_id");
            }
        }
    }

    private function hasColumn(string $table, string $column): bool {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return ((int)$stmt->fetchColumn()) > 0;
    }

    private function hasIndex(string $table, string $indexName): bool {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
        $stmt->execute([$table, $indexName]);
        return ((int)$stmt->fetchColumn()) > 0;
    }
}
