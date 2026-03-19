<?php
/**
 * Stock Ageing Report API
 *
 * Shows how long stock has been in inventory:
 * - 0-30 days
 * - 31-60 days
 * - 61-90 days
 * - 90+ days
 *
 * Helps identify slow-moving and dead stock
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
        $item_group_id = $_GET['item_group_id'] ?? null;
        $item_id = $_GET['item_id'] ?? null;
        $as_of_date = $_GET['as_of_date'] ?? date('Y-m-d');
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build WHERE clause for items
        $where = ["i.status = 'active'", "i.track_inventory = 1"];
        $params = [];

        if ($item_id) {
            $where[] = "i.id = ?";
            $params[] = (int)$item_id;
        }

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

        // Get items
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
                i.opening_rate,
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

        // Calculate ageing for each item
        $ageingData = [];
        $totals = [
            '0_30_days' => ['qty' => 0, 'value' => 0],
            '31_60_days' => ['qty' => 0, 'value' => 0],
            '61_90_days' => ['qty' => 0, 'value' => 0],
            'over_90_days' => ['qty' => 0, 'value' => 0],
            'total' => ['qty' => 0, 'value' => 0]
        ];

        foreach ($items as $item) {
            $ageing = calculateStockAgeing($pdo, $item, $as_of_date);
            $ageingData[] = $ageing;

            // Accumulate totals
            $totals['0_30_days']['qty'] += $ageing['ageing']['0_30_days']['qty'];
            $totals['0_30_days']['value'] += $ageing['ageing']['0_30_days']['value'];
            $totals['31_60_days']['qty'] += $ageing['ageing']['31_60_days']['qty'];
            $totals['31_60_days']['value'] += $ageing['ageing']['31_60_days']['value'];
            $totals['61_90_days']['qty'] += $ageing['ageing']['61_90_days']['qty'];
            $totals['61_90_days']['value'] += $ageing['ageing']['61_90_days']['value'];
            $totals['over_90_days']['qty'] += $ageing['ageing']['over_90_days']['qty'];
            $totals['over_90_days']['value'] += $ageing['ageing']['over_90_days']['value'];
            $totals['total']['qty'] += $ageing['closing_qty'];
            $totals['total']['value'] += $ageing['closing_value'];
        }

        ApiResponse::success([
            'items' => $ageingData,
            'totals' => $totals,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ],
            'filters' => [
                'as_of_date' => $as_of_date,
                'item_group_id' => $item_group_id,
                'item_id' => $item_id
            ]
        ], 'Stock ageing report retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Stock Ageing API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Stock Ageing API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Calculate stock ageing using FIFO method
 *
 * Logic:
 * 1. Get all inward movements (Opening, purchase, convert_in) sorted by date ASC
 * 2. Get total outward (sales, convert_out) quantity
 * 3. Apply FIFO: deduct sales from oldest stock first
 * 4. Remaining stock is categorized by age
 */
function calculateStockAgeing($pdo, $item, $asOfDate) {
    $itemId = $item['id'];
    $openingRate = floatval($item['opening_rate']);

    // Get all inward movements up to as_of_date (Opening + Purchase + ConvertIn)
    $inwardStmt = $pdo->prepare("
        SELECT
            sm.id,
            sm.quantity,
            sm.type,
            DATE(sm.created_at) as movement_date,
            DATEDIFF(?, DATE(sm.created_at)) as age_days,
            COALESCE(
                (SELECT vi.rate FROM voucher_items vi
                 INNER JOIN vouchers v ON vi.voucher_id = v.id
                 WHERE v.voucher_no = sm.reference AND vi.product_id = sm.product_id
                 LIMIT 1),
                ?
            ) as rate
        FROM stock_movement sm
        WHERE sm.product_id = ?
        AND sm.type IN ('Opening', 'purchase', 'convert_in')
        AND DATE(sm.created_at) <= ?
        ORDER BY sm.created_at ASC, sm.id ASC
    ");
    $inwardStmt->execute([$asOfDate, $openingRate, $itemId, $asOfDate]);
    $inwardMovements = $inwardStmt->fetchAll();

    // Get total outward (sales + convert_out) quantity up to as_of_date
    $outwardStmt = $pdo->prepare("
        SELECT COALESCE(SUM(quantity), 0) as total_out
        FROM stock_movement
        WHERE product_id = ?
        AND type IN ('sales', 'convert_out')
        AND DATE(created_at) <= ?
    ");
    $outwardStmt->execute([$itemId, $asOfDate]);
    $totalOutward = floatval($outwardStmt->fetch()['total_out']);

    // Apply FIFO to determine remaining stock age
    $remainingOut = $totalOutward;
    $ageingBuckets = [
        '0_30_days' => ['qty' => 0, 'value' => 0],
        '31_60_days' => ['qty' => 0, 'value' => 0],
        '61_90_days' => ['qty' => 0, 'value' => 0],
        'over_90_days' => ['qty' => 0, 'value' => 0]
    ];

    $closingQty = 0;
    $closingValue = 0;

    foreach ($inwardMovements as $movement) {
        $qty = floatval($movement['quantity']);
        $rate = floatval($movement['rate']);
        $ageDays = (int)$movement['age_days'];

        // Deduct from outward (FIFO)
        if ($remainingOut > 0) {
            if ($remainingOut >= $qty) {
                $remainingOut -= $qty;
                continue; // This batch is fully consumed
            } else {
                $qty -= $remainingOut;
                $remainingOut = 0;
            }
        }

        // Remaining qty goes into ageing buckets
        if ($qty > 0) {
            $value = $qty * $rate;
            $closingQty += $qty;
            $closingValue += $value;

            if ($ageDays <= 30) {
                $ageingBuckets['0_30_days']['qty'] += $qty;
                $ageingBuckets['0_30_days']['value'] += $value;
            } elseif ($ageDays <= 60) {
                $ageingBuckets['31_60_days']['qty'] += $qty;
                $ageingBuckets['31_60_days']['value'] += $value;
            } elseif ($ageDays <= 90) {
                $ageingBuckets['61_90_days']['qty'] += $qty;
                $ageingBuckets['61_90_days']['value'] += $value;
            } else {
                $ageingBuckets['over_90_days']['qty'] += $qty;
                $ageingBuckets['over_90_days']['value'] += $value;
            }
        }
    }

    // Calculate average age
    $totalWeightedAge = 0;
    foreach ($inwardMovements as $movement) {
        $qty = floatval($movement['quantity']);
        $ageDays = (int)$movement['age_days'];

        // Only count remaining stock (simplified - uses proportional)
        if ($closingQty > 0) {
            // This is approximate - actual would need batch tracking
        }
    }

    // Round values
    foreach ($ageingBuckets as &$bucket) {
        $bucket['qty'] = round($bucket['qty'], 3);
        $bucket['value'] = round($bucket['value'], 2);
    }

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

        'closing_qty' => round($closingQty, 3),
        'closing_value' => round($closingValue, 2),
        'avg_rate' => $closingQty > 0 ? round($closingValue / $closingQty, 2) : 0,

        'ageing' => $ageingBuckets,

        // Percentage breakdown
        'ageing_percent' => [
            '0_30_days' => $closingQty > 0 ? round(($ageingBuckets['0_30_days']['qty'] / $closingQty) * 100, 1) : 0,
            '31_60_days' => $closingQty > 0 ? round(($ageingBuckets['31_60_days']['qty'] / $closingQty) * 100, 1) : 0,
            '61_90_days' => $closingQty > 0 ? round(($ageingBuckets['61_90_days']['qty'] / $closingQty) * 100, 1) : 0,
            'over_90_days' => $closingQty > 0 ? round(($ageingBuckets['over_90_days']['qty'] / $closingQty) * 100, 1) : 0
        ]
    ];
}
