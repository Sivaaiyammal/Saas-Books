<?php
/**
 * Migration: Add billing and consignee address columns to vouchers table
 * Run this file once via browser or CLI: php add_billing_consignee_columns.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    // Get existing columns
    $stmt = $pdo->query("SHOW COLUMNS FROM vouchers");
    $existingColumns = [];
    while ($row = $stmt->fetch()) {
        $existingColumns[] = $row['Field'];
    }

    // Columns to add
    $columnsToAdd = [
        'billing_name' => "VARCHAR(200) NULL",
        'billing_address' => "TEXT NULL",
        'billing_city' => "VARCHAR(100) NULL",
        'billing_state' => "VARCHAR(100) NULL",
        'billing_pincode' => "VARCHAR(10) NULL",
        'billing_gstin' => "VARCHAR(20) NULL",
        'billing_phone' => "VARCHAR(20) NULL",
        'consignee_same_as_billing' => "TINYINT(1) DEFAULT 1",
        'consignee_name' => "VARCHAR(200) NULL",
        'consignee_address' => "TEXT NULL",
        'consignee_city' => "VARCHAR(100) NULL",
        'consignee_state' => "VARCHAR(100) NULL",
        'consignee_pincode' => "VARCHAR(10) NULL",
        'consignee_gstin' => "VARCHAR(20) NULL",
        'consignee_phone' => "VARCHAR(20) NULL",
        'place_of_supply' => "VARCHAR(100) NULL"
    ];

    $added = [];
    $skipped = [];

    foreach ($columnsToAdd as $column => $definition) {
        if (in_array($column, $existingColumns)) {
            $skipped[] = $column;
        } else {
            $sql = "ALTER TABLE vouchers ADD COLUMN `$column` $definition";
            $pdo->exec($sql);
            $added[] = $column;
        }
    }

    echo "=== Migration Completed ===\n\n";

    if (!empty($added)) {
        echo "Columns ADDED:\n";
        foreach ($added as $col) {
            echo "  ✓ $col\n";
        }
    }

    if (!empty($skipped)) {
        echo "\nColumns SKIPPED (already exist):\n";
        foreach ($skipped as $col) {
            echo "  - $col\n";
        }
    }

    echo "\n✓ Migration successful!\n";

} catch (Exception $e) {
    echo "Migration FAILED: " . $e->getMessage() . "\n";
    exit(1);
}
