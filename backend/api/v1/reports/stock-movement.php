<?php
/**
 * Stock Movement Analysis API
 *
 * Provides detailed stock movement history with:
 * - Opening Stock (type = 'Opening')
 * - Inward/Purchase (type = 'purchase')
 * - Outward/Sales (type = 'sales')
 * - Running balance tracking
 * - Voucher details (voucher_no, date, party name)
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
        // Filter parameters
        $item_id = $_GET['item_id'] ?? null;
        $item_group_id = $_GET['item_group_id'] ?? null;
        $from_date = $_GET['from_date'] ?? null;
        $to_date = $_GET['to_date'] ?? null;
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // If specific item requested
        if ($item_id) {
            $stockSummary = getItemStockSummary($pdo, $item_id, $from_date, $to_date);
            ApiResponse::success($stockSummary, 'Movement analysis retrieved successfully');
        }

        // Build WHERE clause for items
        $where = ["i.status = 'active'", "i.track_inventory = 1"];
        $params = [];

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

        // Get total count
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items i WHERE $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get items with stock summary
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

        // Calculate stock movements for each item using stock_movement table
        $stockSummaries = [];
        foreach ($items as $item) {
            $summary = calculateStockFromMovement($pdo, $item, $from_date, $to_date);
            $stockSummaries[] = $summary;
        }

        // Calculate totals
        $totals = [
            'total_opening_qty' => 0,
            'total_opening_value' => 0,
            'total_purchase_qty' => 0,
            'total_purchase_value' => 0,
            'total_sales_qty' => 0,
            'total_sales_value' => 0,
            'total_closing_qty' => 0,
            'total_closing_value' => 0
        ];

        foreach ($stockSummaries as $summary) {
            $totals['total_opening_qty'] += $summary['opening_qty'];
            $totals['total_opening_value'] += $summary['opening_value'];
            $totals['total_purchase_qty'] += $summary['purchase_qty'];
            $totals['total_purchase_value'] += $summary['purchase_value'];
            $totals['total_sales_qty'] += $summary['sales_qty'];
            $totals['total_sales_value'] += $summary['sales_value'];
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
                'from_date' => $from_date,
                'to_date' => $to_date,
                'item_group_id' => $item_group_id
            ]
        ], 'Movement analysis retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Movement Analysis API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Movement Analysis API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Calculate stock from stock_movement table
 */
function calculateStockFromMovement($pdo, $item, $fromDate = null, $toDate = null) {
    $itemId = $item['id'];
    $openingRate = floatval($item['opening_rate']);

    // Date filter
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

    // Get Opening stock from stock_movement
    $openingParams = [$itemId];
    $openingDateFilter = "";
    if ($fromDate && $toDate) {
        $openingDateFilter = "AND DATE(created_at) BETWEEN ? AND ?";
        $openingParams[] = $fromDate;
        $openingParams[] = $toDate;
    } elseif ($fromDate) {
        $openingDateFilter = "AND DATE(created_at) >= ?";
        $openingParams[] = $fromDate;
    } elseif ($toDate) {
        $openingDateFilter = "AND DATE(created_at) <= ?";
        $openingParams[] = $toDate;
    }

    $openingStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_qty
        FROM stock_movement
        WHERE product_id = ? AND type = 'Opening' $openingDateFilter
    ");
    $openingStmt->execute($openingParams);
    $openingResult = $openingStmt->fetch();
    $openingQty = floatval($openingResult['total_qty']);
    $openingValue = $openingQty * $openingRate;

    // Get Purchase quantities from stock_movement
    $purchaseStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_qty
        FROM stock_movement
        WHERE product_id = ? AND type = 'purchase' $dateFilter
    ");
    $purchaseStmt->execute($dateParams);
    $purchaseResult = $purchaseStmt->fetch();
    $purchaseQty = floatval($purchaseResult['total_qty']);

    // Get purchase value from voucher_items
    $purchaseValueParams = [$itemId];
    $purchaseDateFilter = "";
    if ($fromDate && $toDate) {
        $purchaseDateFilter = "AND v.voucher_date BETWEEN ? AND ?";
        $purchaseValueParams[] = $fromDate;
        $purchaseValueParams[] = $toDate;
    } elseif ($fromDate) {
        $purchaseDateFilter = "AND v.voucher_date >= ?";
        $purchaseValueParams[] = $fromDate;
    } elseif ($toDate) {
        $purchaseDateFilter = "AND v.voucher_date <= ?";
        $purchaseValueParams[] = $toDate;
    }

    $purchaseValueStmt = $pdo->prepare("
        SELECT COALESCE(SUM(vi.amount), 0) as total_value
        FROM voucher_items vi
        INNER JOIN vouchers v ON vi.voucher_id = v.id
        WHERE vi.product_id = ?
        AND v.voucher_type = 'Purchase'
        AND v.status = 'posted'
        $purchaseDateFilter
    ");
    $purchaseValueStmt->execute($purchaseValueParams);
    $purchaseValueResult = $purchaseValueStmt->fetch();
    $purchaseValue = floatval($purchaseValueResult['total_value']);

    // Get Sales quantities from stock_movement
    $salesStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_qty
        FROM stock_movement
        WHERE product_id = ? AND type = 'sales' $dateFilter
    ");
    $salesStmt->execute($dateParams);
    $salesResult = $salesStmt->fetch();
    $salesQty = floatval($salesResult['total_qty']);

    // Get Convert In quantities from stock_movement
    $convertInStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_qty
        FROM stock_movement
        WHERE product_id = ? AND type = 'convert_in' $dateFilter
    ");
    $convertInStmt->execute($dateParams);
    $convertInResult = $convertInStmt->fetch();
    $convertInQty = floatval($convertInResult['total_qty']);

    // Get Convert Out quantities from stock_movement
    $convertOutStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_qty
        FROM stock_movement
        WHERE product_id = ? AND type = 'convert_out' $dateFilter
    ");
    $convertOutStmt->execute($dateParams);
    $convertOutResult = $convertOutStmt->fetch();
    $convertOutQty = floatval($convertOutResult['total_qty']);

    // Get sales value from voucher_items
    $salesValueParams = [$itemId];
    $salesDateFilter = "";
    if ($fromDate && $toDate) {
        $salesDateFilter = "AND v.voucher_date BETWEEN ? AND ?";
        $salesValueParams[] = $fromDate;
        $salesValueParams[] = $toDate;
    } elseif ($fromDate) {
        $salesDateFilter = "AND v.voucher_date >= ?";
        $salesValueParams[] = $fromDate;
    } elseif ($toDate) {
        $salesDateFilter = "AND v.voucher_date <= ?";
        $salesValueParams[] = $toDate;
    }

    $salesValueStmt = $pdo->prepare("
        SELECT COALESCE(SUM(vi.amount), 0) as total_value
        FROM voucher_items vi
        INNER JOIN vouchers v ON vi.voucher_id = v.id
        WHERE vi.product_id = ?
        AND v.voucher_type = 'Sales'
        AND v.status = 'posted'
        $salesDateFilter
    ");
    $salesValueStmt->execute($salesValueParams);
    $salesValueResult = $salesValueStmt->fetch();
    $salesValue = floatval($salesValueResult['total_value']);

    // Calculate closing stock: Opening + Purchase + ConvertIn - Sales - ConvertOut
    $closingQty = $openingQty + $purchaseQty + $convertInQty - $salesQty - $convertOutQty;

    // Calculate closing value (weighted average)
    $avgRate = ($purchaseQty > 0) ? ($purchaseValue / $purchaseQty) : $openingRate;
    $closingValue = $closingQty * $avgRate;

    return [
        'id' => $item['id'],
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
        'variant_of' => $item['variant_of'],
        'current_stock_in_items_table' => floatval($item['current_stock'] ?? $item['opening_stock'] ?? 0),

        // Movement Analysis from stock_movement
        'opening_qty' => round($openingQty, 3),
        'opening_rate' => round($openingRate, 2),
        'opening_value' => round($openingValue, 2),

        'purchase_qty' => round($purchaseQty, 3),
        'purchase_value' => round($purchaseValue, 2),
        'purchase_rate' => $purchaseQty > 0 ? round($purchaseValue / $purchaseQty, 2) : 0,

        'sales_qty' => round($salesQty, 3),
        'sales_value' => round($salesValue, 2),
        'sales_rate' => $salesQty > 0 ? round($salesValue / $salesQty, 2) : 0,

        'convert_in_qty' => round($convertInQty, 3),
        'convert_out_qty' => round($convertOutQty, 3),

        'closing_qty' => round($closingQty, 3),
        'closing_value' => round($closingValue, 2),
        'closing_rate' => $closingQty > 0 ? round($closingValue / $closingQty, 2) : 0
    ];
}

/**
 * Get detailed stock summary for a single item with transaction history
 */
function getItemStockSummary($pdo, $itemId, $fromDate = null, $toDate = null) {
    // Get item details
    $stmt = $pdo->prepare("
        SELECT
            i.*,
            ig.name as item_group_name,
            u.name as unit_name,
            u.symbol as unit_symbol
        FROM items i
        LEFT JOIN item_groups ig ON i.item_group_id = ig.id
        LEFT JOIN units u ON i.unit_id = u.id
        WHERE i.id = ?
    ");
    $stmt->execute([$itemId]);
    $item = $stmt->fetch();

    if (!$item) {
        ApiResponse::error('Item not found', 404);
    }

    // Calculate stock from movement table
    $summary = calculateStockFromMovement($pdo, $item, $fromDate, $toDate);

    // Date filter for transactions
    $dateFilter = "";
    $dateParams = [$itemId];

    if ($fromDate && $toDate) {
        $dateFilter = "AND DATE(sm.created_at) BETWEEN ? AND ?";
        $dateParams[] = $fromDate;
        $dateParams[] = $toDate;
    } elseif ($fromDate) {
        $dateFilter = "AND DATE(sm.created_at) >= ?";
        $dateParams[] = $fromDate;
    } elseif ($toDate) {
        $dateFilter = "AND DATE(sm.created_at) <= ?";
        $dateParams[] = $toDate;
    }

    // Get all stock movements for this item
    $transStmt = $pdo->prepare("
        SELECT
            sm.id,
            sm.quantity,
            sm.type,
            sm.reference,
            sm.notes,
            sm.created_at,
            COALESCE(v.voucher_no, sc.voucher_no) as voucher_no,
            COALESCE(v.voucher_date, sc.conversion_date) as voucher_date,
            l.name as party_name,
            sc.voucher_no as conversion_voucher_no,
            sc.conversion_date,
            CASE
                WHEN sm.type IN ('Opening', 'purchase', 'convert_in') THEN 'IN'
                WHEN sm.type IN ('sales', 'convert_out') THEN 'OUT'
                ELSE 'OTHER'
            END as stock_effect
        FROM stock_movement sm
        LEFT JOIN vouchers v ON sm.reference = v.voucher_no
        LEFT JOIN ledgers l ON v.party_ledger_id = l.id
        LEFT JOIN stock_conversions sc ON sm.reference = sc.voucher_no
        WHERE sm.product_id = ?
        $dateFilter
        ORDER BY sm.created_at ASC, sm.id ASC
    ");
    $transStmt->execute($dateParams);
    $transactions = $transStmt->fetchAll();

    // Calculate running balance
    $runningQty = 0;
    $transactionsWithBalance = [];

    foreach ($transactions as $trans) {
        if ($trans['stock_effect'] === 'IN') {
            $runningQty += floatval($trans['quantity']);
        } else {
            $runningQty -= floatval($trans['quantity']);
        }

        $trans['running_balance'] = round($runningQty, 3);
        $transactionsWithBalance[] = $trans;
    }

    $summary['movement_analysis'] = $transactionsWithBalance;

    return $summary;
}
