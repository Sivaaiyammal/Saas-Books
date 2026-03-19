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
    $stmt = $pdo->query("
        SELECT id, code, name, amount, currency, validity_days, max_users, max_companies, features
        FROM plans
        WHERE status = 'active'
        ORDER BY amount ASC
    ");
    $plans = $stmt->fetchAll();

    // Decode features JSON for each plan
    foreach ($plans as &$plan) {
        $plan['features'] = json_decode($plan['features'] ?? '[]', true);
    }

    ApiResponse::success(['plans' => $plans], 'Plans retrieved successfully');

} catch (PDOException $e) {
    error_log("Plans error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to retrieve plans');
}
