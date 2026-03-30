<?php

class Migration_10_CreateUnits {
    private PDO $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    public function up(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS units (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                name           VARCHAR(50) NOT NULL UNIQUE,
                symbol         VARCHAR(20) NOT NULL,
                unit_type      ENUM('Quantity','Weight','Length','Area','Volume','Time','Other') DEFAULT 'Quantity',
                decimal_places INT         DEFAULT 2,
                description    TEXT        NULL,
                status         ENUM('active','inactive') DEFAULT 'active',
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_units_type   (unit_type),
                INDEX idx_units_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->pdo->exec("
            INSERT INTO units (name, symbol, unit_type, decimal_places, description) VALUES
            ('Pieces',       'Pcs',  'Quantity', 0, 'Count of items'),
            ('Box',          'Box',  'Quantity', 0, 'Box packaging'),
            ('Dozen',        'Dzn',  'Quantity', 0, '12 pieces'),
            ('Kilogram',     'Kg',   'Weight',   3, 'Weight in kilograms'),
            ('Gram',         'g',    'Weight',   2, 'Weight in grams'),
            ('Meter',        'm',    'Length',   2, 'Length in meters'),
            ('Centimeter',   'cm',   'Length',   2, 'Length in centimeters'),
            ('Liter',        'L',    'Volume',   2, 'Volume in liters'),
            ('Square Meter', 'sq.m', 'Area',     2, 'Area in square meters'),
            ('Bundle',       'Bdl',  'Quantity', 0, 'Bundle of items')
            ON DUPLICATE KEY UPDATE symbol = VALUES(symbol)
        ");
    }

    public function down(): void {
        $this->pdo->exec("DROP TABLE IF EXISTS units");
    }
}
