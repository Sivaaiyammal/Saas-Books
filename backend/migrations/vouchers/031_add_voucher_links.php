<?php

class Migration_31_AddVoucherLinks {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $table = 'vouchers';
        $columns = [
            'delivery_note_id' => 'INT NULL AFTER quotation_id',
            'sales_order_id' => 'INT NULL AFTER delivery_note_id',
            'quotation_id' => 'INT NULL AFTER reference_no',
            'purchase_order_id' => 'INT NULL AFTER quotation_id'
        ];

        foreach ($columns as $column => $definition) {
            if (!$this->hasColumn($table, $column)) {
                $this->pdo->exec("ALTER TABLE `$table` ADD COLUMN $column $definition");
            }
        }
    }

    public function down(): void {
        $table = 'vouchers';
        $columns = ['delivery_note_id', 'sales_order_id', 'quotation_id', 'purchase_order_id'];
        foreach ($columns as $column) {
            if ($this->hasColumn($table, $column)) {
                $this->pdo->exec("ALTER TABLE `$table` DROP COLUMN `$column` ");
            }
        }
    }

    private function hasColumn(string $table, string $column): bool {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return ((int)$stmt->fetchColumn()) > 0;
    }
}
