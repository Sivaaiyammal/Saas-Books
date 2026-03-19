<?php
/**
 * Migration: Add GSTIN column to godowns table
 * Run this file once via browser or CLI: php add_gstin_to_godowns.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    // Get existing columns
    $stmt = $pdo->query("SHOW COLUMNS FROM godowns");
    $existingColumns = [];
    while ($row = $stmt->fetch()) {
        $existingColumns[] = $row['Field'];
    }

    // Column to add
    $column = 'gstin';
    $definition = "VARCHAR(20) NULL COMMENT 'GST Identification Number'";

    if (in_array($column, $existingColumns)) {
        echo "Column '$column' already exists. Skipping.\n";
    } else {
        $sql = "ALTER TABLE godowns ADD COLUMN `$column` $definition AFTER `description`";
        $pdo->exec($sql);
        echo "Column '$column' added successfully!\n";
    }

    echo "\nMigration successful!\n";

} catch (Exception $e) {
    echo "Migration FAILED: " . $e->getMessage() . "\n";
    exit(1);
}
