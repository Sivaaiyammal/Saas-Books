<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id, X-Financial-Year-Id');
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
    $companyId = TenantHelper::getCompanyId($user);
    $currentFyId = TenantHelper::getFinancialYearId($user, $_GET['financial_year_id'] ?? null);

    if (!$currentFyId) {
        ApiResponse::validationError(['financial_year_id' => ['Current financial year ID is required in headers or query']]);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $newFyCode = $input['new_fy_code'] ?? '';
    $startDate = $input['start_date'] ?? '';
    $endDate = $input['end_date'] ?? '';

    if (!$newFyCode || !$startDate || !$endDate) {
        ApiResponse::validationError(['fields' => ['New FY Code, Start Date, and End Date are required']]);
    }

    $newFyId = FinancialYearHelper::performSplit($pdo, $companyId, $currentFyId, $newFyCode, $startDate, $endDate);

    ApiResponse::success([
        'new_financial_year_id' => $newFyId
    ], 'Financial Year split completed successfully. Opening balances carried forward.');

} catch (Exception $e) {
    error_log("Financial year split error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
