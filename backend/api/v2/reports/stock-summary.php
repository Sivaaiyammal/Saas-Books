<?php
/**
 * Stock Summary Report API (V2)
 */

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
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        if ($company_id <= 0) {
            ApiResponse::error('Company ID is required', 400);
        }

        $item_group_id = $_GET['item_group_id'] ?? null;
        $from_date = $_GET['from_date'] ?? null;
        $to_date = $_GET['to_date'] ?? null;
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["i.status = 'active'", "i.track_inventory = 1", "i.company_id = ?"];
        $params = [$company_id];

        if ($item_group_id) {
            $where[] = "i.item_group_id = ?";
            $params[] = (int)$item_group_id;
        }

        if ($search) {
            $where[] = "(i.name LIKE ? OR i.item_code LIKE ? OR i.alias LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items i WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $params[] = $limit;
        $params[] = $offset;

        $stmt = $pdo->prepare("
            SELECT
                i.id,
                i.item_code,
                i.name,
                i.alias,
                i.colour,
                i.gsm,
                i.dia,
                i.count,
                i.opening_stock as current_stock,
                i.opening_rate,
                i.opening_value,
                i.variant_of,
                ig.name as item_group_name,
                u.name as unit_name,
                u.symbol as unit_symbol
            FROM items i
            LEFT JOIN item_groups ig ON i.item_group_id = ig.id
            LEFT JOIN units u ON i.unit_id = u.id
            WHERE $whereClause
            ORDER BY i.name ASC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        $stockSummaries = [];
        foreach ($items as $item) {
            $summary = calculateStockSummary($pdo, $item, $company_id, $from_date, $to_date);
            $stockSummaries[] = $summary;
        }

        $totals = [
            'total_opening_qty' => 0,
            'total_opening_value' => 0,
            'total_purchase_qty' => 0,   // inwardQty in UI
            'total_purchase_value' => 0,
            'total_sales_qty' => 0,      // outwardQty in UI (sales + estimates)
            'total_sales_value' => 0,
            'total_estimate_qty' => 0,
            'total_closing_qty' => 0,    // balanceQty in UI
            'total_closing_value' => 0
        ];

        foreach ($stockSummaries as $summary) {
            $totals['total_opening_qty'] += $summary['opening_qty'];
            $totals['total_opening_value'] += $summary['opening_value'];
            $totals['total_purchase_qty'] += $summary['purchase_qty'];
            $totals['total_purchase_value'] += $summary['purchase_value'];
            $totals['total_sales_qty'] += $summary['sales_qty'];
            $totals['total_sales_value'] += $summary['sales_value'];
            $totals['total_estimate_qty'] += $summary['estimate_qty'];
            $totals['total_closing_qty'] += $summary['closing_qty'];
            $totals['total_closing_value'] += $summary['closing_value'];
        }

        ApiResponse::success([
            'items' => $stockSummaries,
            'totals' => $totals,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ],
            'filters' => [
                'company_id' => $company_id,
                'from_date' => $from_date,
                'to_date' => $to_date,
                'item_group_id' => $item_group_id
            ]
        ], 'Stock summary retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Stock Summary V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Stock Summary V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}

function calculateStockSummary($pdo, $item, $companyId, $fromDate = null, $toDate = null) {
    $itemId = $item['id'];
    $openingRate = floatval($item['opening_rate']);
    $currentStockQty = floatval($item['current_stock'] ?? 0);

    $dateFilter = "";
    $dateParams = [$itemId];

    if ($fromDate && $toDate) {
        $dateFilter = "AND DATE(created_at) BETWEEN ? AND ?";
        $dateParams[] = $fromDate;
        $dateParams[] = $toDate;
    } elseif ($fromDate) {
        $dateFilter = "AND DATE(created_at) >= ?";
        $dateParams[] = $fromDate;
    } elseif ($toDate) {
        $dateFilter = "AND DATE(created_at) <= ?";
        $dateParams[] = $toDate;
    }

    // All outward movements from stock_movement (sales + quotations)
    // Stock is added via item creation (opening_stock field), not Purchase vouchers
    $outwardStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN type = 'sales'     THEN quantity ELSE 0 END), 0) as sales_qty,
            COALESCE(SUM(CASE WHEN type = 'quotation' THEN quantity ELSE 0 END), 0) as estimate_qty,
            COALESCE(SUM(quantity), 0) as total_outward
        FROM stock_movement
        WHERE product_id = ? $dateFilter
    ");
    $outwardStmt->execute($dateParams);
    $outwardResult  = $outwardStmt->fetch();
    $salesOnlyQty   = floatval($outwardResult['sales_qty']);
    $estimateQty    = floatval($outwardResult['estimate_qty']);
    $totalOutward   = floatval($outwardResult['total_outward']);

    // sales_qty sent to frontend = sales + estimates (all outward) → UI "Outward Log"
    $salesQty = $salesOnlyQty + $estimateQty;

    // Closing = live stock from items table
    $closingQty   = $currentStockQty;
    $closingValue = $closingQty * $openingRate;

    // Inward = closing + all outward (reverse-calculate original stock set at item creation)
    $purchaseQty  = $closingQty + $totalOutward;
    $purchaseValue = $purchaseQty * $openingRate;
    $openingQty   = $purchaseQty; // alias for opening_qty field
    $openingValue = $openingQty * $openingRate;

    // Sales value from vouchers
    $outValueParams = [$itemId, $companyId];
    $outValueDateFilter = "";
    if ($fromDate && $toDate) {
        $outValueDateFilter = "AND v.voucher_date BETWEEN ? AND ?";
        $outValueParams[] = $fromDate;
        $outValueParams[] = $toDate;
    } elseif ($fromDate) {
        $outValueDateFilter = "AND v.voucher_date >= ?";
        $outValueParams[] = $fromDate;
    } elseif ($toDate) {
        $outValueDateFilter = "AND v.voucher_date <= ?";
        $outValueParams[] = $toDate;
    }

    $salesValueStmt = $pdo->prepare("
        SELECT COALESCE(SUM(vi.amount), 0) as total_value
        FROM voucher_items vi
        INNER JOIN vouchers v ON vi.voucher_id = v.id
        WHERE vi.product_id = ?
        AND v.company_id = ?
        AND v.voucher_type IN ('Sales', 'Quotation')
        AND v.status != 'cancelled'
        $outValueDateFilter
    ");
    $salesValueStmt->execute($outValueParams);
    $salesValue = floatval($salesValueStmt->fetch()['total_value']);

    return [
        'id' => $itemId,
        'item_code' => $item['item_code'],
        'name' => $item['name'],
        'alias' => $item['alias'],
        'colour' => $item['colour'],
        'gsm' => $item['gsm'],
        'dia' => $item['dia'],
        'count' => $item['count'],
        'item_group_name' => $item['item_group_name'],
        'unit_name' => $item['unit_name'],
        'unit_symbol' => $item['unit_symbol'],
        'opening_qty' => round($openingQty, 3),
        'opening_value' => round($openingValue, 2),
        // purchase_qty = opening + purchases (all inward) → maps to UI "Inward Log"
        'purchase_qty' => round($purchaseQty, 3),
        'purchase_value' => round($purchaseValue, 2),
        // sales_qty = sales + estimates (all outward) → maps to UI "Outward Log"
        'sales_qty' => round($salesQty, 3),
        'sales_value' => round($salesValue, 2),
        'estimate_qty' => round($estimateQty, 3),
        'closing_qty' => round($closingQty, 3),
        'closing_value' => round($closingValue, 2)
    ];
}
