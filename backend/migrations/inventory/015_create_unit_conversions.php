<?php

class Migration_15_CreateUnitConversions {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS unit_conversions (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                from_unit_id    INT            NOT NULL,
                to_unit_id      INT            NOT NULL,
                conversion_rate DECIMAL(15,6)  NOT NULL COMMENT '1 from_unit = conversion_rate to_unit',
                item_id         INT            NULL     COMMENT 'NULL = global; set = item-specific',
                status          ENUM('active','inactive') DEFAULT 'active',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_uc_from_unit FOREIGN KEY (from_unit_id) REFERENCES units(id) ON DELETE RESTRICT,
                CONSTRAINT fk_uc_to_unit   FOREIGN KEY (to_unit_id)   REFERENCES units(id) ON DELETE RESTRICT,
                CONSTRAINT fk_uc_item      FOREIGN KEY (item_id)      REFERENCES items(id) ON DELETE CASCADE,
                INDEX idx_uc_from   (from_unit_id),
                INDEX idx_uc_to     (to_unit_id),
                INDEX idx_uc_item   (item_id),
                INDEX idx_uc_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS unit_conversions");
    }
}
