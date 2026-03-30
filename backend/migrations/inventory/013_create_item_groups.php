<?php

class Migration_13_CreateItemGroups {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS item_groups (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(100) NOT NULL UNIQUE,
                parent_id   INT          NULL,
                group_type  ENUM('Raw Material','Finished Goods','Work in Progress','Consumables','Services','Other') DEFAULT 'Other',
                description TEXT         NULL,
                status      ENUM('active','inactive') DEFAULT 'active',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_item_groups_parent FOREIGN KEY (parent_id) REFERENCES item_groups(id) ON DELETE SET NULL,
                INDEX idx_item_groups_parent     (parent_id),
                INDEX idx_item_groups_group_type (group_type),
                INDEX idx_item_groups_status     (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->pdo->exec("
            INSERT INTO item_groups (name, group_type, description) VALUES
            ('Cotton Fabrics',      'Raw Material',   'Various types of cotton fabrics'),
            ('Silk Fabrics',        'Raw Material',   'Premium silk fabrics'),
            ('Synthetic Fabrics',   'Raw Material',   'Synthetic and blended fabrics'),
            ('Finished Garments',   'Finished Goods', 'Ready to wear garments'),
            ('Accessories',         'Consumables',    'Textile accessories and trims'),
            ('Threads & Yarns',     'Raw Material',   'Threads and yarns for weaving'),
            ('Packaging Materials', 'Consumables',    'Boxes, bags, and packaging'),
            ('Tailoring Services',  'Services',       'Stitching and alteration services')
            ON DUPLICATE KEY UPDATE group_type = VALUES(group_type)
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS item_groups");
    }
}
