<?php

class Migration_14_CreateItems {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS items (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                company_id      INT           NULL,
                item_group_id   INT           NULL,
                name            VARCHAR(200)  NOT NULL,
                alias           VARCHAR(200)  NULL,
                description     TEXT          NULL,
                item_code       VARCHAR(50)   UNIQUE,
                lot_no          VARCHAR(50)   NULL,
                hsn_code        VARCHAR(20)   NULL,
                colour          VARCHAR(100)  NULL,
                cones           INT           NULL,
                grams           DECIMAL(15,3) NULL,
                gross_weight    DECIMAL(15,3) NULL,
                net_weight      DECIMAL(15,3) NULL,
                variant_of      INT           NULL,
                unit_id         INT           NULL,
                opening_stock   DECIMAL(15,3) DEFAULT 0.000,
                opening_value   DECIMAL(15,2) DEFAULT 0.00,
                opening_rate    DECIMAL(15,2) DEFAULT 0.00,
                minimum_level   DECIMAL(15,3) DEFAULT 0.000,
                maximum_level   DECIMAL(15,3) DEFAULT 0.000,
                reorder_level   DECIMAL(15,3) DEFAULT 0.000,
                standard_cost   DECIMAL(15,2) DEFAULT 0.00,
                standard_price  DECIMAL(15,2) DEFAULT 0.00,
                tax_id          INT           NULL,
                is_service      TINYINT(1)    DEFAULT 0,
                track_inventory TINYINT(1)    DEFAULT 1,
                status          ENUM('active','inactive','discontinued') DEFAULT 'active',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_items_company   FOREIGN KEY (company_id)    REFERENCES companies(id)    ON DELETE SET NULL,
                CONSTRAINT fk_items_group     FOREIGN KEY (item_group_id) REFERENCES item_groups(id)  ON DELETE SET NULL,
                CONSTRAINT fk_items_unit      FOREIGN KEY (unit_id)       REFERENCES units(id)        ON DELETE SET NULL,
                CONSTRAINT fk_items_tax       FOREIGN KEY (tax_id)        REFERENCES taxes(id)        ON DELETE SET NULL,
                CONSTRAINT fk_items_variant   FOREIGN KEY (variant_of)    REFERENCES items(id)        ON DELETE SET NULL,
                INDEX idx_items_company         (company_id),
                INDEX idx_items_group           (item_group_id),
                INDEX idx_items_item_code       (item_code),
                INDEX idx_items_hsn             (hsn_code),
                INDEX idx_items_lot_no          (lot_no),
                INDEX idx_items_status          (status),
                INDEX idx_items_track_inventory (track_inventory),
                INDEX idx_items_name            (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS items");
    }
}
