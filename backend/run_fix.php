<?php
// Temporary migration executor
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/migrations/vouchers/031_add_voucher_links.php';

try {
    $pdo = getDBConnection();
    $migration = new Migration_31_AddVoucherLinks($pdo);
    $migration->up();
    echo "Migration 031 (Voucher Links) executed successfully.";
} catch (Exception $e) {
    echo "Migration Failed: " . $e->getMessage();
}
