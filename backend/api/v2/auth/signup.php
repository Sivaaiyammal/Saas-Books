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
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../helpers/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $rules = [
        'name' => 'required|min:2|max:100',
        'email' => 'required|email',
        'password' => 'required|min:8',
        'confirm_password' => 'required|min:8',
        'company_name' => 'required|min:2|max:150',
        'address' => 'required|max:1000',
        'gstin' => 'required|max:20',
        'city' => 'required|max:100',
        'state' => 'required|max:100',
        'pincode' => 'required|max:10',
        'country' => 'required|max:100',
        'plan_code' => 'required|max:30',
        'phone' => 'phone'
    ];

    $errors = Validator::validate($input, $rules);

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    // Check if password and confirm_password match
    if ($input['password'] !== $input['confirm_password']) {
        ApiResponse::validationError([
            'confirm_password' => ['Password and confirm password do not match']
        ]);
    }

    $name = Validator::sanitize($input['name']);
    $email = AuthHelper::sanitizeEmail($input['email']);
    $password = $input['password'];
    $phone = Validator::sanitize($input['phone'] ?? '');
    $companyName = Validator::sanitize($input['company_name']);
    $address = Validator::sanitize($input['address']);
    $gstin = strtoupper(trim((string)$input['gstin']));
    $city = Validator::sanitize($input['city']);
    $state = Validator::sanitize($input['state']);
    $pincode = Validator::sanitize($input['pincode']);
    $country = Validator::sanitize($input['country']);
    $planCode = strtoupper(trim($input['plan_code']));

    if (!AuthHelper::isStrongPassword($password)) {
        ApiResponse::validationError([
            'password' => ['Password must be at least 8 characters and contain uppercase, lowercase, and numbers']
        ]);
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        ApiResponse::error('Email already registered', 409);
    }

    $hashedPassword = AuthHelper::hashPassword($password);

    $pdo->beginTransaction();

    try {

    $stmt = $pdo->prepare("SELECT id, code, name, amount, currency, validity_days FROM plans WHERE code = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$planCode]);
    $plan = $stmt->fetch();

    if (!$plan) {
        ApiResponse::validationError([
            'plan_code' => ['Invalid or inactive plan']
        ]);
    }

    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, password, phone, role, status, created_at)
        VALUES (?, ?, ?, ?, 'user', 'active', NOW())
    ");

    $stmt->execute([$name, $email, $hashedPassword, $phone]);

    $userId = $pdo->lastInsertId();

    $companyCode = 'CMP' . strtoupper(substr(md5($companyName . $email . microtime(true)), 0, 6));
    $stmt = $pdo->prepare("INSERT INTO companies (code, name, email, phone, gstin, address, city, state, pincode, country, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')");
    $stmt->execute([$companyCode, $companyName, $email, $phone ?: null, $gstin, $address, $city, $state, $pincode, $country]);
    $companyId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare("INSERT INTO company_users (company_id, user_id, role, is_default, status) VALUES (?, ?, 'owner', 1, 'active')");
    $stmt->execute([$companyId, $userId]);

    $stmt = $pdo->prepare("INSERT INTO `groups` (company_id, name, nature, is_system, affects_gross_profit, status) VALUES (?, 'Sundry Debtors', 'Asset', 1, 0, 'active')");
    $stmt->execute([$companyId]);

    $stmt = $pdo->prepare("INSERT INTO financial_years (company_id, code, name, start_date, end_date, is_current, status)
        VALUES (?, '2025-26', 'FY 2025-26', '2025-04-01', '2026-03-31', 1, 'active')");
    $stmt->execute([$companyId]);

    $stmt = $pdo->prepare("INSERT INTO subscriptions (company_id, user_id, plan_id, status, payment_status, amount_paid, start_date, end_date)
        VALUES (?, ?, ?, 'pending', 'pending', 0.00, NULL, NULL)");
    $stmt->execute([$companyId, $userId, (int)$plan['id']]);

    $subscriptionId = (int)$pdo->lastInsertId();

    $pdo->commit();

    ApiResponse::created([
        'user' => [
            'id' => (int)$userId,
            'name' => $name,
            'email' => $email,
            'phone' => $phone
        ],
        'company' => [
            'id' => $companyId,
            'code' => $companyCode,
            'name' => $companyName,
            'address' => $address,
            'gstin' => $gstin,
            'city' => $city,
            'state' => $state,
            'pincode' => $pincode,
            'country' => $country
        ],
        'subscription' => [
            'id' => $subscriptionId,
            'status' => 'pending',
            'payment_status' => 'pending',
            'plan_code' => $plan['code'],
            'plan_name' => $plan['name'],
            'amount_due' => (float)$plan['amount'],
            'currency' => $plan['currency'],
            'validity_days' => (int)$plan['validity_days']
        ],
        'payment_required' => true,
        'next_step' => 'Complete payment using /api/v2/billing/confirm-payment.php, then login.'
    ], 'Signup successful. Payment required to activate access.');

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

} catch (PDOException $e) {
    error_log("Signup error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Registration failed. Please try again.');
} catch (Exception $e) {
    error_log("Signup exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
