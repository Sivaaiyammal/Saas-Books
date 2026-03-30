<?php

class Migration_9_CreateTaxes {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS taxes (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(100) NOT NULL,
                tax_type    ENUM('GST','CGST','SGST','IGST','VAT','Cess','Other') NOT NULL,
                rate        DECIMAL(5,2) NOT NULL,
                is_default  TINYINT(1)   DEFAULT 0,
                description TEXT         NULL,
                status      ENUM('active','inactive') DEFAULT 'active',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_taxes_type       (tax_type),
                INDEX idx_taxes_status     (status),
                INDEX idx_taxes_is_default (is_default)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Seed standard Indian GST rates
        $this->pdo->exec("
            INSERT INTO taxes (name, tax_type, rate, is_default, description) VALUES
            ('GST 0%',   'GST',  0.00, 0, 'Zero rated GST'),
            ('GST 5%',   'GST',  5.00, 0, 'GST at 5%'),
            ('GST 12%',  'GST', 12.00, 0, 'GST at 12%'),
            ('GST 18%',  'GST', 18.00, 1, 'GST at 18% (Default)'),
            ('GST 28%',  'GST', 28.00, 0, 'GST at 28%'),
            ('CGST 9%',  'CGST', 9.00, 0, 'Central GST at 9%'),
            ('SGST 9%',  'SGST', 9.00, 0, 'State GST at 9%'),
            ('IGST 18%', 'IGST',18.00, 0, 'Integrated GST at 18%')
            ON DUPLICATE KEY UPDATE rate = VALUES(rate)
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS taxes");
    }
}
