<?php
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
require_once __DIR__ . '/../../../helpers/validator.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $rules = [
        'email' => 'required|email',
        'company_code' => 'required|max:20',
        'payment_reference' => 'required|max:100',
        'amount_paid' => 'required|numeric'
    ];

    $errors = Validator::validate($input, $rules);
    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $email = strtolower(trim($input['email']));
    $companyCode = strtoupper(trim($input['company_code']));
    $paymentReference = trim($input['payment_reference']);
    $amountPaid = (float)$input['amount_paid'];

    if ($amountPaid <= 0) {
        ApiResponse::validationError([
            'amount_paid' => ['Amount must be greater than 0']
        ]);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$email]);
    $userId = (int)$stmt->fetchColumn();

    if ($userId <= 0) {
        ApiResponse::error('User not found', 404);
    }

    $stmt = $pdo->prepare("SELECT id, name FROM companies WHERE code = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$companyCode]);
    $company = $stmt->fetch();

    if (!$company) {
        ApiResponse::error('Company not found', 404);
    }

    $companyId = (int)$company['id'];

    $stmt = $pdo->prepare("SELECT id FROM company_users WHERE company_id = ? AND user_id = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$companyId, $userId]);
    if (!$stmt->fetch()) {
        ApiResponse::error('User is not associated with this company', 403);
    }

    $stmt = $pdo->prepare("
        SELECT s.id, s.plan_id, p.code as plan_code, p.name as plan_name, p.amount, p.currency, p.validity_days
        FROM subscriptions s
        INNER JOIN plans p ON s.plan_id = p.id
        WHERE s.company_id = ?
          AND s.user_id = ?
          AND s.status IN ('pending', 'expired', 'cancelled')
        ORDER BY s.id DESC
        LIMIT 1
    ");
    $stmt->execute([$companyId, $userId]);
    $subscription = $stmt->fetch();

    if (!$subscription) {
        ApiResponse::error('No pending subscription found', 404);
    }

    if ($amountPaid < (float)$subscription['amount']) {
        ApiResponse::validationError([
            'amount_paid' => ['Paid amount is less than plan amount']
        ]);
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("UPDATE subscriptions SET status = 'expired' WHERE company_id = ? AND user_id = ? AND status = 'active'");
    $stmt->execute([$companyId, $userId]);

    $stmt = $pdo->prepare("
        UPDATE subscriptions
        SET status = 'active',
            payment_status = 'paid',
            amount_paid = ?,
            payment_reference = ?,
            start_date = CURDATE(),
            end_date = DATE_ADD(CURDATE(), INTERVAL ? DAY),
            paid_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$amountPaid, $paymentReference, (int)$subscription['validity_days'], (int)$subscription['id']]);

    $pdo->commit();

    ApiResponse::success([
        'subscription_id' => (int)$subscription['id'],
        'company_id' => $companyId,
        'company_name' => $company['name'],
        'plan_code' => $subscription['plan_code'],
        'plan_name' => $subscription['plan_name'],
        'amount_paid' => $amountPaid,
        'currency' => $subscription['currency'],
        'access_enabled' => true
    ], 'Payment confirmed. You can now login and access the product.');
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Confirm payment API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to confirm payment');
}
