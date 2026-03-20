<?php
/**
 * E-Invoice Cancellation API
 *
 * Cancel a previously generated E-Invoice within 24 hours
 * Requires: IRN and Cancel Reason
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        ApiResponse::error('Method not allowed', 405);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['voucher_id'])) {
        ApiResponse::error('Voucher ID is required');
    }

    if (!isset($input['cancel_reason']) || empty($input['cancel_reason'])) {
        ApiResponse::error('Cancel reason is required');
    }

    $voucherId = (int)$input['voucher_id'];
    $cancelReason = trim($input['cancel_reason']);

    // Get existing E-Invoice
    $stmt = $pdo->prepare("
        SELECT el.*, v.voucher_no
        FROM einvoice_log el
        INNER JOIN vouchers v ON el.voucher_id = v.id
        WHERE el.voucher_id = ? AND el.status = 'generated'
        ORDER BY el.id DESC LIMIT 1
    ");
    $stmt->execute([$voucherId]);
    $einvoice = $stmt->fetch();

    if (!$einvoice) {
        ApiResponse::error('No active E-Invoice found for this voucher', 404);
    }

    // Check if within 24 hours
    $ackTime = strtotime($einvoice['ack_date']);
    $hoursDiff = (time() - $ackTime) / 3600;

    if ($hoursDiff > 24) {
        ApiResponse::error('E-Invoice can only be cancelled within 24 hours of generation. Current: ' . round($hoursDiff, 1) . ' hours', 400);
    }

    // Valid cancel reasons as per GST portal
    $validReasons = [
        '1' => 'Duplicate',
        '2' => 'Data Entry Mistake',
        '3' => 'Order Cancelled',
        '4' => 'Others'
    ];

    // In production: Send cancel request to IRP API
    // $irpResponse = cancelOnIRP($einvoice['irn'], $cancelReason);

    // Update database
    $stmt = $pdo->prepare("
        UPDATE einvoice_log
        SET status = 'cancelled',
            cancel_reason = ?,
            cancel_date = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$cancelReason, $einvoice['id']]);

    ApiResponse::success([
        'voucher_id' => $voucherId,
        'voucher_no' => $einvoice['voucher_no'],
        'irn' => $einvoice['irn'],
        'cancel_reason' => $cancelReason,
        'cancel_date' => date('Y-m-d H:i:s'),
        'status' => 'cancelled',
        'message' => 'E-Invoice cancelled successfully (Demo Mode)'
    ], 'E-Invoice cancelled successfully');

} catch (PDOException $e) {
    error_log("E-Invoice Cancel API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("E-Invoice Cancel API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
