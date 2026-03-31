<?php

class Migration_28_FixItemCodeUnique {
    private PDO $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function up(): void {
        try {
            // Drop the global unique index on item_code which prevents the same item_code across different companies.
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND INDEX_NAME = 'item_code'");
            $stmt->execute();
            if ((int)$stmt->fetchColumn() > 0) {
                $this->pdo->exec("ALTER TABLE items DROP INDEX item_code");
            }
            
            // Add a composite unique index so item_code is unique per company
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND INDEX_NAME = 'idx_company_item_code'");
            $stmt->execute();
            if ((int)$stmt->fetchColumn() === 0) {
                $this->pdo->exec("ALTER TABLE items ADD UNIQUE INDEX idx_company_item_code (company_id, item_code)");
            }
        } catch (PDOException $e) {
            error_log("Migration 28 up error: " . $e->getMessage());
            throw $e;
        }
    }

    public function down(): void {
        try {
            // Revert back to global unique constraint
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND INDEX_NAME = 'idx_company_item_code'");
            $stmt->execute();
            if ((int)$stmt->fetchColumn() > 0) {
                $this->pdo->exec("ALTER TABLE items DROP INDEX idx_company_item_code");
            }

            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND INDEX_NAME = 'item_code'");
            $stmt->execute();
            if ((int)$stmt->fetchColumn() === 0) {
                $this->pdo->exec("ALTER TABLE items ADD UNIQUE INDEX item_code (item_code)");
            }
        } catch (PDOException $e) {
            error_log("Migration 28 down error: " . $e->getMessage());
            throw $e;
        }
    }
}
