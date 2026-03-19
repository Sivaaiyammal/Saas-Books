<?php
/**
 * Stock Ledger (Transaction History) API - V2
 *
 * Returns per-item stock movement log with running balance.
 * Called by the Stock Summary modal for detailed stock analysis.
 *
 * Response shape expected by frontend api.ts getStockTransactions():
 *   data.item_name, data.opening_qty, data.closing_qty,
 *   data.total_in, data.total_out,
 *   data.entries[] { id, voucher_date, voucher_no, voucher_type,
 *                    description, in_qty, out_qty, balance, user_name }
 *   data.pagination { total, page, limit, pages }
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

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        ApiResponse::error('Method not allowed', 405);
    }

    $itemId = isset($_GET['item_id']) ? (int)$_GET['item_id'] : 0;
    if (!$itemId) {
        ApiResponse::error('item_id is required', 400);
    }

    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
    if (!$companyId) {
        ApiResponse::error('company_id is required', 400);
    }

    $fromDate = $_GET['from_date'] ?? null;
    $toDate   = $_GET['to_date'] ?? null;
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $limit    = min(500, max(1, (int)($_GET['limit'] ?? 100)));
    $offset   = ($page - 1) * $limit;

    // Get item details
    $itemStmt = $pdo->prepare("
        SELECT i.id, i.name, i.item_code, i.opening_stock, i.opening_rate,
               i.created_at,
               u.name as unit_name, u.symbol as unit_symbol
        FROM items i
        LEFT JOIN units u ON i.unit_id = u.id
        WHERE i.id = ? AND i.company_id = ?
    ");
    $itemStmt->execute([$itemId, $companyId]);
    $item = $itemStmt->fetch();

    if (!$item) {
        ApiResponse::error('Item not found', 404);
    }

    // Build date filter
    $dateWhere = "";
    $dateParams = [];
    if ($fromDate && $toDate) {
        $dateWhere = "AND DATE(sm.created_at) BETWEEN ? AND ?";
        $dateParams = [$fromDate, $toDate];
    } elseif ($fromDate) {
        $dateWhere = "AND DATE(sm.created_at) >= ?";
        $dateParams = [$fromDate];
    } elseif ($toDate) {
        $dateWhere = "AND DATE(sm.created_at) <= ?";
        $dateParams = [$toDate];
    }

    // Stock is added via item creation (items.opening_stock), not Purchase vouchers.
    // Get total outward from stock_movement to back-calculate original opening stock.
    $totalOutwardStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_out
        FROM stock_movement
        WHERE product_id = ? AND type IN ('sales', 'quotation')
    ");
    $totalOutwardStmt->execute([$itemId]);
    $totalOutwardAll = floatval($totalOutwardStmt->fetchColumn());

    // Original stock set at item creation = current stock + all outward ever
    $originalStock = floatval($item['opening_stock']) + $totalOutwardAll;

    // For date-filtered opening: balance up to fromDate
    $openingQty = 0;
    if ($fromDate) {
        $preDateStmt = $pdo->prepare("
            SELECT COALESCE(SUM(quantity), 0) as out_before
            FROM stock_movement
            WHERE product_id = ? AND type IN ('sales', 'quotation')
            AND DATE(created_at) < ?
        ");
        $preDateStmt->execute([$itemId, $fromDate]);
        $outBefore  = floatval($preDateStmt->fetchColumn());
        $openingQty = $originalStock - $outBefore;
    } else {
        $openingQty = 0; // will show original stock as first "Item Creation" entry
    }

    // Total count for pagination (only outward movements shown as rows)
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) FROM stock_movement sm
        WHERE sm.product_id = ?
        AND sm.type IN ('sales', 'quotation') $dateWhere
    ");
    $countStmt->execute(array_merge([$itemId], $dateParams));
    $total = (int)$countStmt->fetchColumn();

    // Fetch all outward movements with voucher details
    $allStmt = $pdo->prepare("
        SELECT
            sm.id,
            sm.quantity,
            sm.type,
            sm.reference as voucher_no,
            sm.created_at,
            COALESCE(v.voucher_date, DATE(sm.created_at)) as voucher_date,
            COALESCE(v.voucher_type, CONCAT(UPPER(LEFT(sm.type,1)), LOWER(SUBSTRING(sm.type,2)))) as voucher_type,
            COALESCE(l.name, sm.notes, '') as description,
            u.name as user_name
        FROM stock_movement sm
        LEFT JOIN vouchers v ON v.voucher_no = sm.reference AND v.company_id = ?
        LEFT JOIN ledgers l ON v.party_ledger_id = l.id
        LEFT JOIN users u ON sm.user_id = u.id
        WHERE sm.product_id = ?
        AND sm.type IN ('sales', 'quotation') $dateWhere
        ORDER BY sm.created_at ASC, sm.id ASC
    ");
    $allStmt->execute(array_merge([$companyId, $itemId], $dateParams));
    $allRows = $allStmt->fetchAll();

    // Build entries with running balance
    // First entry = Item Creation (Opening Stock) — only when no fromDate filter
    $allEntries = [];
    $totalIn    = 0;
    $totalOut   = 0;

    if (!$fromDate) {
        // Synthetic first entry: item creation / opening stock
        $allEntries[] = [
            'id'           => 'open',
            'voucher_date' => $item['created_at'] ?? date('Y-m-d'),
            'voucher_no'   => 'OPENING',
            'voucher_type' => 'Item Creation',
            'description'  => 'Opening stock set at item creation',
            'in_qty'       => round($originalStock, 3),
            'out_qty'      => 0,
            'balance'      => round($originalStock, 3),
            'user_name'    => 'System'
        ];
        $totalIn      = $originalStock;
        $runningBalance = $originalStock;
    } else {
        $runningBalance = $openingQty;
    }

    foreach ($allRows as $row) {
        $qty    = floatval($row['quantity']);
        $runningBalance -= $qty;
        $totalOut += $qty;

        $allEntries[] = [
            'id'           => $row['id'],
            'voucher_date' => $row['voucher_date'],
            'voucher_no'   => $row['voucher_no'] ?? '',
            'voucher_type' => $row['voucher_type'],
            'description'  => $row['description'] ?? '',
            'in_qty'       => 0,
            'out_qty'      => round($qty, 3),
            'balance'      => round($runningBalance, 3),
            'user_name'    => $row['user_name'] ?? 'System'
        ];
    }

    $closingQty   = $runningBalance;
    $pagedEntries = array_slice($allEntries, $offset, $limit);

    ApiResponse::success([
        'item_name'   => $item['name'],
        'item_code'   => $item['item_code'],
        'unit_name'   => $item['unit_name'],
        'unit_symbol' => $item['unit_symbol'],
        'opening_qty' => round($openingQty, 3),
        'closing_qty' => round($closingQty, 3),
        'total_in'    => round($totalIn, 3),
        'total_out'   => round($totalOut, 3),
        'entries'     => $pagedEntries,
        'pagination'  => [
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
            'pages' => max(1, (int)ceil($total / $limit))
        ]
    ], 'Stock ledger retrieved successfully');

} catch (PDOException $e) {
    error_log("Stock Ledger V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Stock Ledger V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
