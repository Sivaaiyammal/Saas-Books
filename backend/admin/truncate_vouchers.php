<?php
/**
 * TRUNCATE SCRIPT - Clear All Voucher Data
 *
 * This script will clear all voucher-related tables and reset their auto-increment counters.
 * Use this when you need to start fresh with new voucher entries.
 *
 * WARNING: This will DELETE ALL DATA in these tables:
 * - vouchers
 * - voucher_items
 * - voucher_entries
 * - bill_allocations
 *
 * Usage:
 * php truncate_vouchers.php
 *
 * Or via API:
 * POST /admin/truncate_vouchers.php
 * Body: { "confirm": true }
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/apiResponse.php';

try {
    $pdo = getDBConnection();

    // Get request method and input
    $method = $_SERVER['REQUEST_METHOD'];
    $input = [];

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
    } elseif ($method === 'GET') {
        $input = $_GET;
    }

    // Check if confirmation is provided
    $confirm = isset($input['confirm']) && ($input['confirm'] === true || $input['confirm'] === 'true');

    if (!$confirm) {
        ApiResponse::error(
            'Truncate operation requires confirmation. Send { "confirm": true } to proceed.',
            400
        );
    }

    // Start transaction
    $pdo->beginTransaction();

    try {
        // Disable foreign key checks
        $pdo->exec("SET FOREIGN_KEY_CHECKS=0");

        // Truncate tables (deletes all records and resets auto-increment)
        $tables = [
            'bill_allocations',
            'voucher_entries',
            'voucher_items',
            'vouchers'
        ];

        $truncatedTables = [];

        foreach ($tables as $table) {
            $pdo->exec("TRUNCATE TABLE $table");
            $truncatedTables[] = $table;
        }

        // Re-enable foreign key checks
        $pdo->exec("SET FOREIGN_KEY_CHECKS=1");

        // Verify truncation
        $verification = [];
        foreach ($tables as $table) {
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM $table");
            $result = $stmt->fetch();
            $verification[$table] = (int)$result['count'];
        }

        $pdo->commit();

        ApiResponse::success([
            'status' => 'success',
            'message' => 'All voucher tables truncated successfully',
            'truncated_tables' => $truncatedTables,
            'verification' => $verification,
            'timestamp' => date('Y-m-d H:i:s')
        ], 'Voucher tables cleared successfully', 200);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (PDOException $e) {
    error_log("Truncate Vouchers API error: " . $e->getMessage(), 3, __DIR__ . '/../logs/api_error.log');
    ApiResponse::serverError('Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Truncate Vouchers exception: " . $e->getMessage(), 3, __DIR__ . '/../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
?>
