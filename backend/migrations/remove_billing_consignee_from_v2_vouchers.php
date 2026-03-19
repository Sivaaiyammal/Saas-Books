<?php
/**
 * Migration: Remove billing/consignee columns from V2 vouchers table
 * Run once via CLI: php backend/migrations/remove_billing_consignee_from_v2_vouchers.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    $stmt = $pdo->query("SHOW COLUMNS FROM vouchers");
    $columns = [];
    while ($row = $stmt->fetch()) {
        $columns[] = $row['Field'];
    }

    $columnsToDrop = [
        'billing_name',
        'billing_address',
        'billing_city',
        'billing_state',
        'billing_pincode',
        'billing_gstin',
        'billing_phone',
        'consignee_same_as_billing',
        'consignee_name',
        'consignee_address',
        'consignee_city',
        'consignee_state',
        'consignee_pincode',
        'consignee_gstin',
        'consignee_phone',
        'place_of_supply'
    ];

    $dropped = [];
    $skipped = [];

    foreach ($columnsToDrop as $column) {
        if (in_array($column, $columns, true)) {
            $pdo->exec("ALTER TABLE vouchers DROP COLUMN `$column`");
            $dropped[] = $column;
        } else {
            $skipped[] = $column;
        }
    }

    echo "=== Migration Completed ===\n\n";

    if (!empty($dropped)) {
        echo "Columns DROPPED:\n";
        foreach ($dropped as $col) {
            echo "  ✓ $col\n";
        }
    }

    if (!empty($skipped)) {
        echo "\nColumns SKIPPED (not found):\n";
        foreach ($skipped as $col) {
            echo "  - $col\n";
        }
    }

    echo "\n✓ V2 vouchers table cleaned successfully.\n";
} catch (Throwable $e) {
    echo "Migration FAILED: " . $e->getMessage() . "\n";
    exit(1);
}
