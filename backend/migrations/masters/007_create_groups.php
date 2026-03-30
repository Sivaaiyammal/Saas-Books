<?php

class Migration_7_CreateGroups {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS `groups` (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                company_id          INT  NULL,
                name                VARCHAR(100) NOT NULL,
                parent_id           INT  NULL,
                nature              ENUM('Asset','Liability','Income','Expense') NOT NULL,
                affects_gross_profit TINYINT(1) DEFAULT 0,
                is_system           TINYINT(1) DEFAULT 0,
                status              ENUM('active','inactive') DEFAULT 'active',
                created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_groups_parent  FOREIGN KEY (parent_id)  REFERENCES `groups`(id)    ON DELETE SET NULL,
                CONSTRAINT fk_groups_company FOREIGN KEY (company_id) REFERENCES companies(id)   ON DELETE SET NULL,
                INDEX idx_groups_company (company_id),
                INDEX idx_groups_nature  (nature),
                INDEX idx_groups_system  (is_system),
                INDEX idx_groups_status  (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Seed Tally-style system groups (company_id = NULL = shared)
        $this->pdo->exec("
            INSERT INTO `groups` (name, nature, is_system, affects_gross_profit) VALUES
            ('Capital Account',    'Liability', 1, 0),
            ('Sundry Debtors',     'Asset',     1, 0),
            ('Sundry Creditors',   'Liability', 1, 0),
            ('Cash-in-Hand',       'Asset',     1, 0),
            ('Bank Accounts',      'Asset',     1, 0),
            ('Sales Accounts',     'Income',    1, 1),
            ('Purchase Accounts',  'Expense',   1, 1),
            ('Duties & Taxes',     'Liability', 1, 0),
            ('Indirect Expenses',  'Expense',   1, 0),
            ('Indirect Income',    'Income',    1, 0)
            ON DUPLICATE KEY UPDATE is_system = 1
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS `groups`");
    }
}
