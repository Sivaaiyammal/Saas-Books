<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';

function tableHasColumn(PDO $pdo, string $tableName, string $columnName): bool {
    $stmt = $pdo->prepare('SHOW COLUMNS FROM `' . $tableName . '` LIKE ?');
    $stmt->execute([$columnName]);
    return (bool)$stmt->fetch();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    $selectFields = ['id', 'code', 'name', 'amount', 'currency', 'validity_days', 'status'];
    if (tableHasColumn($pdo, 'plans', 'max_users')) {
        $selectFields[] = 'max_users';
    }
    if (tableHasColumn($pdo, 'plans', 'max_companies')) {
        $selectFields[] = 'max_companies';
    }
    if (tableHasColumn($pdo, 'plans', 'features')) {
        $selectFields[] = 'features';
    }

    $query = sprintf(
        'SELECT %s FROM plans WHERE status = \'active\' ORDER BY amount ASC',
        implode(', ', $selectFields)
    );

    $stmt = $pdo->query($query);
    $plans = $stmt->fetchAll();

    // Decode features JSON only when the column is present
    foreach ($plans as &$plan) {
        if (isset($plan['features'])) {
            $plan['features'] = json_decode($plan['features'] ?? '[]', true);
        }
    }

    ApiResponse::success(['plans' => $plans], 'Plans retrieved successfully');

} catch (PDOException $e) {
    error_log("Plans error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to retrieve plans');
}
