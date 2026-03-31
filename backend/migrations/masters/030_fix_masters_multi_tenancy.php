<?php

class Migration_30_FixMastersMultiTenancy {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $tables = [
            'item_groups' => 'name',
            'units'       => 'name',
            'taxes'       => 'name',
            'colors'      => 'name',
            'godowns'     => 'name'
        ];

        foreach ($tables as $table => $nameCol) {
            try {
                // 1. Add company_id if missing
                $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'company_id'");
                $stmt->execute([$table]);
                if ((int)$stmt->fetchColumn() === 0) {
                    $this->pdo->exec("ALTER TABLE `$table` ADD COLUMN company_id INT NULL AFTER id");
                    $this->pdo->exec("ALTER TABLE `$table` ADD CONSTRAINT `fk_{$table}_company` FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE");
                    $this->pdo->exec("ALTER TABLE `$table` ADD INDEX `idx_{$table}_company` (company_id)");
                }

                // 2. Fix Unique Index: Drop old global index and add tenant-scoped one
                // Some migrations used 'unique' keyword directly on column, which creates an index named after the column.
                // Others used 'UNIQUE KEY uq_...'. We check for various possible names.
                $possibleIndexNames = [$nameCol, "uq_{$table}_{$nameCol}", "uq_{$table}_name", "idx_{$table}_{$nameCol}"];
                
                foreach ($possibleIndexNames as $idxName) {
                    $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
                    $stmt->execute([$table, $idxName]);
                    if ((int)$stmt->fetchColumn() > 0) {
                        $this->pdo->exec("ALTER TABLE `$table` DROP INDEX `$idxName` ");
                    }
                }

                // 3. Add the proper multi-tenant unique index
                $newIndexName = "uq_{$table}_tenant_scoped";
                $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
                $stmt->execute([$table, $newIndexName]);
                if ((int)$stmt->fetchColumn() === 0) {
                    $this->pdo->exec("ALTER TABLE `$table` ADD UNIQUE INDEX `$newIndexName` (company_id, `$nameCol`)");
                }

            } catch (PDOException $e) {
                error_log("Error fixing multi-tenancy for table $table: " . $e->getMessage());
                // Continue to next table even if one fails
            }
        }
    }

    public function down(): void {
        // Rollback is complex here, but usually entails reverting to global keys.
        // For simplicity in this recovery migration, we omit full rollback logic 
        // to avoid accidentally breaking a working state.
    }
}
