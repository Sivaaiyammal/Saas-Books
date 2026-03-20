<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../helpers/apiResponse.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

function tableHasColumn(PDO $pdo, string $tableName, string $columnName): bool {
    static $cache = [];
    $cacheKey = $tableName . '.' . $columnName;
    if (isset($cache[$cacheKey])) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?");
    $stmt->execute([$tableName, $columnName]);
    $cache[$cacheKey] = ((int)$stmt->fetchColumn()) > 0;

    return $cache[$cacheKey];
}

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        $itemsHasCompanyId = tableHasColumn($pdo, 'items', 'company_id');

        $months = isset($_GET['months']) ? (int)$_GET['months'] : 6;
        if ($months < 1) {
            $months = 1;
        }
        if ($months > 24) {
            $months = 24;
        }

        $today = new DateTime('today');
        $currentMonthStart = (clone $today)->modify('first day of this month')->setTime(0, 0, 0);
        $currentMonthEnd = (clone $today)->modify('last day of this month')->setTime(23, 59, 59);

        $previousMonthStart = (clone $currentMonthStart)->modify('-1 month');
        $previousMonthEnd = (clone $currentMonthStart)->modify('-1 second');

        $trendStart = (clone $currentMonthStart)->modify('-' . ($months - 1) . ' months');
        $trendEnd = (clone $currentMonthEnd);

        $formatGrowth = function ($currentValue, $previousValue) {
            $currentValue = (float)$currentValue;
            $previousValue = (float)$previousValue;

            if (abs($previousValue) < 0.000001) {
                if (abs($currentValue) < 0.000001) {
                    return 0.0;
                }
                return 100.0;
            }

            return round((($currentValue - $previousValue) / abs($previousValue)) * 100, 2);
        };

        // Revenue KPI (Sales vouchers)
        $revenueStmt = $pdo->prepare("SELECT COALESCE(SUM(total_amount), 0) AS total
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
              AND voucher_type = 'Sales'
              AND status = 'posted'
              AND voucher_date BETWEEN ? AND ?");

        $revenueStmt->execute([$companyId, $currentMonthStart->format('Y-m-d'), $currentMonthEnd->format('Y-m-d')]);
        $currentRevenue = (float)$revenueStmt->fetchColumn();

        $revenueStmt->execute([$companyId, $previousMonthStart->format('Y-m-d'), $previousMonthEnd->format('Y-m-d')]);
        $previousRevenue = (float)$revenueStmt->fetchColumn();

        $revenueGrowth = $formatGrowth($currentRevenue, $previousRevenue);

        // Ledgers KPI (new active ledgers created in month)
        $ledgerStmt = $pdo->prepare("SELECT COUNT(*)
            FROM ledgers
            WHERE COALESCE(company_id, 0) = ?
              AND status = 'active'
              AND created_at BETWEEN ? AND ?");

        $ledgerStmt->execute([$companyId, $currentMonthStart->format('Y-m-d H:i:s'), $currentMonthEnd->format('Y-m-d H:i:s')]);
        $currentLedgerAdds = (int)$ledgerStmt->fetchColumn();

        $ledgerStmt->execute([$companyId, $previousMonthStart->format('Y-m-d H:i:s'), $previousMonthEnd->format('Y-m-d H:i:s')]);
        $previousLedgerAdds = (int)$ledgerStmt->fetchColumn();

        $ledgerGrowth = $formatGrowth($currentLedgerAdds, $previousLedgerAdds);

        $ledgerTotalStmt = $pdo->prepare("SELECT COUNT(*) FROM ledgers WHERE COALESCE(company_id, 0) = ? AND status = 'active'");
        $ledgerTotalStmt->execute([$companyId]);
        $ledgerTotal = (int)$ledgerTotalStmt->fetchColumn();

        // Stock Units KPI (current stock) + growth from purchase inward by month
        if ($itemsHasCompanyId) {
            $stockUnitsStmt = $pdo->prepare("SELECT COALESCE(SUM(opening_stock), 0)
                FROM items
                WHERE COALESCE(company_id, 0) = ?
                  AND status = 'active'
                  AND track_inventory = 1");
            $stockUnitsStmt->execute([$companyId]);
        } else {
            $stockUnitsStmt = $pdo->prepare("SELECT COALESCE(SUM(opening_stock), 0)
                FROM items
                WHERE status = 'active'
                  AND track_inventory = 1");
            $stockUnitsStmt->execute();
        }
        $stockUnitsTotal = (float)$stockUnitsStmt->fetchColumn();

        $stockInwardStmt = $pdo->prepare("SELECT COALESCE(SUM(vi.quantity), 0) AS qty
            FROM voucher_items vi
            INNER JOIN vouchers v ON v.id = vi.voucher_id
            WHERE COALESCE(v.company_id, 0) = ?
              AND v.voucher_type = 'Purchase'
              AND v.status = 'posted'
              AND v.voucher_date BETWEEN ? AND ?");

        $stockInwardStmt->execute([$companyId, $currentMonthStart->format('Y-m-d'), $currentMonthEnd->format('Y-m-d')]);
        $currentStockInward = (float)$stockInwardStmt->fetchColumn();

        $stockInwardStmt->execute([$companyId, $previousMonthStart->format('Y-m-d'), $previousMonthEnd->format('Y-m-d')]);
        $previousStockInward = (float)$stockInwardStmt->fetchColumn();

        $stockGrowth = $formatGrowth($currentStockInward, $previousStockInward);

        // Estimates KPI (quotation count in month)
        $estimateStmt = $pdo->prepare("SELECT COUNT(*)
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
              AND voucher_type = 'Quotation'
              AND status != 'cancelled'
              AND voucher_date BETWEEN ? AND ?");

        $estimateStmt->execute([$companyId, $currentMonthStart->format('Y-m-d'), $currentMonthEnd->format('Y-m-d')]);
        $currentEstimateCount = (int)$estimateStmt->fetchColumn();

        $estimateStmt->execute([$companyId, $previousMonthStart->format('Y-m-d'), $previousMonthEnd->format('Y-m-d')]);
        $previousEstimateCount = (int)$estimateStmt->fetchColumn();

        $estimateGrowth = $formatGrowth($currentEstimateCount, $previousEstimateCount);

        $estimateTotalStmt = $pdo->prepare("SELECT COUNT(*)
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
              AND voucher_type = 'Quotation'
              AND status != 'cancelled'");
        $estimateTotalStmt->execute([$companyId]);
        $estimateTotal = (int)$estimateTotalStmt->fetchColumn();

                // Sales analytics (monthly trend - based on estimates/quotation value)
        $salesTrendStmt = $pdo->prepare("SELECT DATE_FORMAT(voucher_date, '%Y-%m') AS month_key,
                   COALESCE(SUM(total_amount), 0) AS total
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
                            AND voucher_type = 'Quotation'
                            AND status != 'cancelled'
              AND voucher_date BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(voucher_date, '%Y-%m')
            ORDER BY month_key ASC");
        $salesTrendStmt->execute([
            $companyId,
            $trendStart->format('Y-m-d'),
            $trendEnd->format('Y-m-d')
        ]);

        $salesMap = [];
        foreach ($salesTrendStmt->fetchAll() as $row) {
            $salesMap[$row['month_key']] = (float)$row['total'];
        }

        // Recent activity (latest estimate vouchers)
        $recentActivityStmt = $pdo->prepare("SELECT
                v.id,
                v.voucher_type,
                v.voucher_no,
                v.voucher_date,
                v.total_amount,
                v.status,
                v.created_at,
                l.name AS party_name
            FROM vouchers v
            LEFT JOIN ledgers l ON l.id = v.party_ledger_id
            WHERE COALESCE(v.company_id, 0) = ?
              AND v.voucher_type = 'Quotation'
              AND v.status != 'cancelled'
            ORDER BY v.created_at DESC, v.id DESC
            LIMIT 8");
        $recentActivityStmt->execute([$companyId]);

        $recentActivity = [];
        foreach ($recentActivityStmt->fetchAll() as $row) {
            $recentActivity[] = [
                'id' => (int)$row['id'],
                'type' => $row['voucher_type'],
                'voucher_no' => $row['voucher_no'],
                'voucher_date' => $row['voucher_date'],
                'party_name' => $row['party_name'],
                'amount' => round((float)$row['total_amount'], 2),
                'status' => $row['status'],
                'created_at' => $row['created_at']
            ];
        }

        $monthsData = [];
        $salesAnalytics = [];

        $cursor = clone $trendStart;
        for ($i = 0; $i < $months; $i++) {
            $monthKey = $cursor->format('Y-m');
            $monthLabel = $cursor->format('M');

            $salesValue = isset($salesMap[$monthKey]) ? $salesMap[$monthKey] : 0.0;

            $monthsData[] = [
                'key' => $monthKey,
                'label' => $monthLabel
            ];

            $salesAnalytics[] = [
                'month' => $monthLabel,
                'month_key' => $monthKey,
                'value' => round($salesValue, 2)
            ];

            $cursor->modify('+1 month');
        }

        ApiResponse::success([
            'kpis' => [
                'revenue' => [
                    'value' => round($currentRevenue, 2),
                    'growth_percent' => $revenueGrowth,
                    'current_period_value' => round($currentRevenue, 2),
                    'previous_period_value' => round($previousRevenue, 2)
                ],
                'ledgers' => [
                    'value' => $ledgerTotal,
                    'growth_percent' => $ledgerGrowth,
                    'current_period_additions' => $currentLedgerAdds,
                    'previous_period_additions' => $previousLedgerAdds
                ],
                'stock_units' => [
                    'value' => round($stockUnitsTotal, 3),
                    'growth_percent' => $stockGrowth,
                    'current_period_inward_qty' => round($currentStockInward, 3),
                    'previous_period_inward_qty' => round($previousStockInward, 3)
                ],
                'estimates' => [
                    'value' => $estimateTotal,
                    'growth_percent' => $estimateGrowth,
                    'current_period_count' => $currentEstimateCount,
                    'previous_period_count' => $previousEstimateCount
                ]
            ],
            'charts' => [
                'sales_analytics' => $salesAnalytics
            ],
            'recent_activity' => $recentActivity,
            'period' => [
                'months' => $months,
                'from' => $trendStart->format('Y-m-d'),
                'to' => $trendEnd->format('Y-m-d'),
                'current_month_from' => $currentMonthStart->format('Y-m-d'),
                'current_month_to' => $currentMonthEnd->format('Y-m-d'),
                'previous_month_from' => $previousMonthStart->format('Y-m-d'),
                'previous_month_to' => $previousMonthEnd->format('Y-m-d')
            ],
            'months' => $monthsData
        ], 'Dashboard data retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Dashboard V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Dashboard V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
