<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT id, code, name, amount, currency, validity_days FROM plans WHERE status = 'active' ORDER BY amount ASC");
    $stmt->execute();
    $plans = $stmt->fetchAll();

    ApiResponse::success([
        'plans' => array_map(function ($plan) {
            return [
                'id' => (int)$plan['id'],
                'code' => $plan['code'],
                'name' => $plan['name'],
                'amount' => (float)$plan['amount'],
                'currency' => $plan['currency'],
                'validity_days' => (int)$plan['validity_days']
            ];
        }, $plans)
    ], 'Plans retrieved successfully');
} catch (Exception $e) {
    error_log("Billing plans API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to fetch plans');
}
