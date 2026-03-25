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
require_once __DIR__ . '/../../helpers/tenant.php';
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
        $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
        $itemsHasCompanyId = tableHasColumn($pdo, 'items', 'company_id');

        $today = new DateTime('today');
        $currentYear = (int)$today->format('Y');
        $currentMonth = (int)$today->format('n');

        $fyStartYear = ($currentMonth >= 4) ? $currentYear : ($currentYear - 1);
        $defaultFrom = sprintf('%04d-04-01', $fyStartYear);
        $defaultTo = sprintf('%04d-03-31', $fyStartYear + 1);

        $fromDateRaw = $_GET['from_date'] ?? $defaultFrom;
        $toDateRaw = $_GET['to_date'] ?? $defaultTo;

        $fromDate = DateTime::createFromFormat('Y-m-d', $fromDateRaw);
        $toDate = DateTime::createFromFormat('Y-m-d', $toDateRaw);
        if (!$fromDate || !$toDate) {
            ApiResponse::validationError([
                'date' => ['Invalid date format. Use YYYY-MM-DD for from_date and to_date']
            ]);
        }
        if ($fromDate > $toDate) {
            ApiResponse::validationError([
                'date' => ['from_date cannot be greater than to_date']
            ]);
        }

        $fromDateSql = $fromDate->format('Y-m-d');
        $toDateSql = $toDate->format('Y-m-d');

        $periodDays = (int)$fromDate->diff($toDate)->format('%a') + 1;
        $prevToDate = (clone $fromDate)->modify('-1 day');
        $prevFromDate = (clone $prevToDate)->modify('-' . ($periodDays - 1) . ' days');
        $prevFromDateSql = $prevFromDate->format('Y-m-d');
        $prevToDateSql = $prevToDate->format('Y-m-d');

        $growthPercent = function ($currentValue, $previousValue) {
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

        $amountDueStmt = $pdo->prepare("SELECT COALESCE(SUM(ba.pending_amount), 0)
            FROM bill_allocations ba
            INNER JOIN ledgers l ON l.id = ba.ledger_id
            INNER JOIN `groups` g ON g.id = l.group_id
            WHERE COALESCE(l.company_id, 0) = ?
              AND l.status = 'active'
              AND ba.pending_amount > 0
              AND (g.name = 'Sundry Debtors' OR g.name LIKE 'Sundry Debtors%')");
        $amountDueStmt->execute([$companyId]);
        $amountDueValue = (float)$amountDueStmt->fetchColumn();

        $amountDueTrendStmt = $pdo->prepare("SELECT COALESCE(SUM(v.total_amount), 0)
            FROM vouchers v
            WHERE COALESCE(v.company_id, 0) = ?
              AND v.voucher_type = 'Sales'
              AND v.status = 'posted'
              AND v.voucher_date BETWEEN ? AND ?");
        $amountDueTrendStmt->execute([$companyId, $fromDateSql, $toDateSql]);
        $amountDueCurrent = (float)$amountDueTrendStmt->fetchColumn();
        $amountDueTrendStmt->execute([$companyId, $prevFromDateSql, $prevToDateSql]);
        $amountDuePrevious = (float)$amountDueTrendStmt->fetchColumn();
        $amountDueGrowth = $growthPercent($amountDueCurrent, $amountDuePrevious);

        $ledgerTotalStmt = $pdo->prepare("SELECT COUNT(*) FROM ledgers WHERE COALESCE(company_id, 0) = ? AND status = 'active'");
        $ledgerTotalStmt->execute([$companyId]);
        $ledgerTotal = (int)$ledgerTotalStmt->fetchColumn();

        $ledgerAddsStmt = $pdo->prepare("SELECT COUNT(*)
            FROM ledgers
            WHERE COALESCE(company_id, 0) = ?
              AND status = 'active'
              AND DATE(created_at) BETWEEN ? AND ?");
        $ledgerAddsStmt->execute([$companyId, $fromDateSql, $toDateSql]);
        $ledgerAddsCurrent = (int)$ledgerAddsStmt->fetchColumn();
        $ledgerAddsStmt->execute([$companyId, $prevFromDateSql, $prevToDateSql]);
        $ledgerAddsPrevious = (int)$ledgerAddsStmt->fetchColumn();
        $ledgerGrowth = $growthPercent($ledgerAddsCurrent, $ledgerAddsPrevious);

        $invoiceStmt = $pdo->prepare("SELECT COALESCE(SUM(total_amount), 0)
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
              AND voucher_type = 'Sales'
              AND status = 'posted'
              AND voucher_date BETWEEN ? AND ?");
        $invoiceStmt->execute([$companyId, $fromDateSql, $toDateSql]);
        $invoiceValue = (float)$invoiceStmt->fetchColumn();
        $invoiceStmt->execute([$companyId, $prevFromDateSql, $prevToDateSql]);
        $invoicePrevious = (float)$invoiceStmt->fetchColumn();
        $invoiceGrowth = $growthPercent($invoiceValue, $invoicePrevious);

        if ($itemsHasCompanyId) {
            $stockCountStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE COALESCE(company_id, 0) = ?
                  AND status = 'active'
                  AND track_inventory = 1");
            $stockCountStmt->execute([$companyId]);
        } else {
            $stockCountStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE status = 'active'
                  AND track_inventory = 1");
            $stockCountStmt->execute();
        }
        $overallStockValue = (int)$stockCountStmt->fetchColumn();

        if ($itemsHasCompanyId) {
            $stockGrowthStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE COALESCE(company_id, 0) = ?
                  AND status = 'active'
                  AND track_inventory = 1
                  AND DATE(created_at) BETWEEN ? AND ?");
            $stockGrowthStmt->execute([$companyId, $fromDateSql, $toDateSql]);
        } else {
            $stockGrowthStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE status = 'active'
                  AND track_inventory = 1
                  AND DATE(created_at) BETWEEN ? AND ?");
            $stockGrowthStmt->execute([$fromDateSql, $toDateSql]);
        }
        $stockCurrentAdds = (int)$stockGrowthStmt->fetchColumn();
        if ($itemsHasCompanyId) {
            $stockGrowthStmt->execute([$companyId, $prevFromDateSql, $prevToDateSql]);
        } else {
            $stockGrowthStmt->execute([$prevFromDateSql, $prevToDateSql]);
        }
        $stockPreviousAdds = (int)$stockGrowthStmt->fetchColumn();
        $stockGrowth = $growthPercent($stockCurrentAdds, $stockPreviousAdds);

        $monthlyTrendStmt = $pdo->prepare("SELECT
                DATE_FORMAT(voucher_date, '%Y-%m') AS month_key,
                SUM(CASE WHEN voucher_type = 'Sales' THEN total_amount ELSE 0 END) AS sales_total,
                SUM(CASE WHEN voucher_type = 'Purchase' THEN total_amount ELSE 0 END) AS purchase_total
            FROM vouchers
            WHERE COALESCE(company_id, 0) = ?
              AND status = 'posted'
              AND voucher_type IN ('Sales', 'Purchase')
              AND voucher_date BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(voucher_date, '%Y-%m')
            ORDER BY month_key ASC");
        $monthlyTrendStmt->execute([$companyId, $fromDateSql, $toDateSql]);

        $salesMap = [];
        $purchaseMap = [];
        foreach ($monthlyTrendStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $monthKey = $row['month_key'];
            $salesMap[$monthKey] = round((float)$row['sales_total'], 2);
            $purchaseMap[$monthKey] = round((float)$row['purchase_total'], 2);
        }

        $monthLabels = [];
        $salesSeries = [];
        $purchaseSeries = [];
        $monthAxis = [];
        $cursor = new DateTime($fromDate->format('Y-m-01'));
        $lastMonth = new DateTime($toDate->format('Y-m-01'));
        while ($cursor <= $lastMonth) {
            $key = $cursor->format('Y-m');
            $label = $cursor->format('M');

            $monthLabels[] = $label;
            $salesSeries[] = isset($salesMap[$key]) ? $salesMap[$key] : 0.0;
            $purchaseSeries[] = isset($purchaseMap[$key]) ? $purchaseMap[$key] : 0.0;
            $monthAxis[] = [
                'key' => $key,
                'label' => $label
            ];

            $cursor->modify('+1 month');
        }

                if ($itemsHasCompanyId) {
                        $distributionStmt = $pdo->prepare("SELECT
                                        COALESCE(ig.name, 'Uncategorized') AS category_name,
                                        ROUND(COALESCE(SUM(i.opening_stock * CASE WHEN i.standard_cost > 0 THEN i.standard_cost ELSE i.standard_price END), 0), 2) AS asset_value
                                FROM items i
                                LEFT JOIN item_groups ig ON ig.id = i.item_group_id
                                WHERE COALESCE(i.company_id, 0) = ?
                                    AND i.status = 'active'
                                    AND i.track_inventory = 1
                                GROUP BY category_name
                                ORDER BY asset_value DESC
                                LIMIT 4");
                        $distributionStmt->execute([$companyId]);
                } else {
                        $distributionStmt = $pdo->prepare("SELECT
                                        COALESCE(ig.name, 'Uncategorized') AS category_name,
                                        ROUND(COALESCE(SUM(i.opening_stock * CASE WHEN i.standard_cost > 0 THEN i.standard_cost ELSE i.standard_price END), 0), 2) AS asset_value
                                FROM items i
                                LEFT JOIN item_groups ig ON ig.id = i.item_group_id
                                WHERE i.status = 'active'
                                    AND i.track_inventory = 1
                                GROUP BY category_name
                                ORDER BY asset_value DESC
                                LIMIT 4");
                        $distributionStmt->execute();
                }

        $stockByCategory = [];
        foreach ($distributionStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $stockByCategory[] = [
                'category' => $row['category_name'],
                'asset_value' => (float)$row['asset_value']
            ];
        }

        $fastMovingStmt = $pdo->prepare("SELECT
                COALESCE(i.name, vi.item_name) AS item_name,
                ROUND(COALESCE(SUM(vi.quantity), 0), 3) AS sold_qty
            FROM voucher_items vi
            INNER JOIN vouchers v ON v.id = vi.voucher_id
            LEFT JOIN items i ON i.id = vi.product_id
            WHERE COALESCE(v.company_id, 0) = ?
              AND v.voucher_type = 'Sales'
              AND v.status = 'posted'
              AND v.voucher_date BETWEEN ? AND ?
            GROUP BY COALESCE(i.name, vi.item_name)
            ORDER BY sold_qty DESC
            LIMIT 1");
        $fastMovingStmt->execute([$companyId, $fromDateSql, $toDateSql]);
        $fastMovingRow = $fastMovingStmt->fetch(PDO::FETCH_ASSOC);

        if ($itemsHasCompanyId) {
            $lowStockStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE COALESCE(company_id, 0) = ?
                  AND status = 'active'
                  AND track_inventory = 1
                  AND reorder_level > 0
                  AND opening_stock <= reorder_level");
            $lowStockStmt->execute([$companyId]);
        } else {
            $lowStockStmt = $pdo->prepare("SELECT COUNT(*)
                FROM items
                WHERE status = 'active'
                  AND track_inventory = 1
                  AND reorder_level > 0
                  AND opening_stock <= reorder_level");
            $lowStockStmt->execute();
        }
        $lowStockAlertCount = (int)$lowStockStmt->fetchColumn();

        ApiResponse::success([
            'summary' => [
                'amount_due' => [
                    'value' => round($amountDueValue, 2),
                    'growth_percent' => $amountDueGrowth
                ],
                'ledgers' => [
                    'value' => $ledgerTotal,
                    'growth_percent' => $ledgerGrowth
                ],
                'invoices' => [
                    'value' => round($invoiceValue, 2),
                    'growth_percent' => $invoiceGrowth
                ],
                'overall_stock' => [
                    'value' => $overallStockValue,
                    'growth_percent' => $stockGrowth
                ]
            ],
            'charts' => [
                'revenue_overview' => [
                    'labels' => $monthLabels,
                    'sales' => $salesSeries,
                    'purchase' => $purchaseSeries
                ]
            ],
            'stock_distribution' => [
                'categories' => $stockByCategory,
                'fast_moving_item' => [
                    'name' => $fastMovingRow['item_name'] ?? null,
                    'quantity' => isset($fastMovingRow['sold_qty']) ? (float)$fastMovingRow['sold_qty'] : 0.0
                ],
                'low_stock_alert' => [
                    'count' => $lowStockAlertCount
                ]
            ],
            'period' => [
                'from' => $fromDateSql,
                'to' => $toDateSql,
                'previous_from' => $prevFromDateSql,
                'previous_to' => $prevToDateSql,
                'display' => $fromDate->format('M Y') . ' - ' . $toDate->format('M Y')
            ],
            'months' => $monthAxis,
            'kpis' => [
                'revenue' => [
                    'value' => round($invoiceValue, 2),
                    'growth_percent' => $invoiceGrowth
                ],
                'ledgers' => [
                    'value' => $ledgerTotal,
                    'growth_percent' => $ledgerGrowth
                ],
                'stock_units' => [
                    'value' => $overallStockValue,
                    'growth_percent' => $stockGrowth
                ],
                'estimates' => [
                    'value' => 0,
                    'growth_percent' => 0
                ]
            ]
        ], 'Dashboard data retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Dashboard V1 API error: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Dashboard V1 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
