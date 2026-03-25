<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../helpers/financialYear.php';
require_once __DIR__ . '/../../../middleware/auth.php';

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $years = FinancialYearHelper::listYears($pdo, $companyId);

        if (empty($years)) {
            $today = (new DateTime())->format('Y-m-d');
            FinancialYearHelper::ensureYear($pdo, $companyId, $today);
            $years = FinancialYearHelper::listYears($pdo, $companyId);
        }

        ApiResponse::success([
            'financial_years' => $years
        ], 'Financial years retrieved successfully');
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['financial_year_id'] ?? 0);

        if (!$id) {
            ApiResponse::validationError(['financial_year_id' => ['Financial year id is required']]);
        }

        $fy = FinancialYearHelper::setCurrent($pdo, $companyId, $id);
        ApiResponse::success(['financial_year' => $fy], 'Financial year selected successfully');
    }

    ApiResponse::error('Method not allowed', 405);
} catch (Exception $e) {
    error_log("Financial years API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
