<?php
/**
 * Quotation API - WITHOUT GST/E-INVOICE/E-WAYBILL
 *
 * This creates quotations that:
 * - Simple tax calculation (no GST split)
 * - No accounting entries (does not affect ledger balance)
 * - No bill-by-bill tracking (not a financial transaction)
 * - No stock effect (quotations only)
 * - No E-Invoice generation
 * - No E-Waybill generation
 *
 * Purpose: For quotations/estimates without complex GST requirements
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../helpers/moduleAccess.php';
require_once __DIR__ . '/../../../helpers/voucher.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

// Allow next_voucher_no endpoint without authentication
if (!isset($_GET['next_voucher_no'])) {
    $user = AuthMiddleware::authenticate();
    ModuleAccessHelper::requireModule($pdo, $user, 'quotation', 'Quotation');
}

try {
    $pdo = getDBConnection();
    $companyId = isset($user) ? TenantHelper::getCompanyId($user) : null;
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List quotations or get single
    if ($method === 'GET') {
        // Get next quotation number
        if (isset($_GET['next_voucher_no']) && $_GET['next_voucher_no'] === 'true') {
            $nextVoucherNo = VoucherHelper::generateVoucherNo($pdo, 'Quotation', $_GET['company_id'] ?? null, 1);
            ApiResponse::success([
                'next_voucher_no' => $nextVoucherNo
            ], 'Next quotation number retrieved successfully');
        }

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            // Get quotation with party details
            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name as party_name,
                       l.address as party_address,
                       l.city as party_city,
                       l.state as party_state,
                       l.pincode as party_pincode,
                       l.phone as party_phone,
                       l.email as party_email,
                       u.name as created_by_name
                FROM vouchers v
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                LEFT JOIN users u ON v.created_by = u.id
                WHERE v.id = ? AND v.voucher_type = 'Quotation'
            ");
            $stmt->execute([$id]);
            $quotation = $stmt->fetch();

            if (!$quotation) {
                ApiResponse::error('Quotation not found', 404);
            }

            // Get items
            $stmt = $pdo->prepare("
                SELECT vi.*,
                       i.item_code,
                       un.name as unit_name, un.symbol as unit_symbol,
                       t.name as tax_name, t.rate as tax_rate
                FROM voucher_items vi
                LEFT JOIN items i ON vi.product_id = i.id
                LEFT JOIN units un ON vi.unit_id = un.id
                LEFT JOIN taxes t ON vi.tax_id = t.id
                WHERE vi.voucher_id = ?
                ORDER BY vi.id ASC
            ");
            $stmt->execute([$id]);
            $quotation['items'] = $stmt->fetchAll();

            // Get additional charges
            $stmt = $pdo->prepare("
                SELECT id, charge_name, amount
                FROM voucher_charges
                WHERE voucher_id = ?
                ORDER BY id ASC
            ");
            $stmt->execute([$id]);
            $quotation['charges'] = $stmt->fetchAll();

            ApiResponse::success($quotation, 'Quotation retrieved successfully');
        }

        // List all quotations
        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $party_id = $_GET['party_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = 'Quotation'"];
        $params = [];
        TenantHelper::appendCompanyFilter($where, $params, $companyId, 'v.company_id');

        if ($search) {
            $where[] = "(v.voucher_no LIKE ? OR v.reference_no LIKE ? OR l.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($status && in_array($status, ['draft', 'posted', 'cancelled'])) {
            $where[] = "v.status = ?";
            $params[] = $status;
        }

        if ($party_id) {
            $where[] = "v.party_ledger_id = ?";
            $params[] = (int)$party_id;
        }

        if ($from_date) {
            $where[] = "v.voucher_date >= ?";
            $params[] = $from_date;
        }

        if ($to_date) {
            $where[] = "v.voucher_date <= ?";
            $params[] = $to_date;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get quotations
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as party_name,
                   (SELECT COUNT(*) FROM voucher_items vi WHERE vi.voucher_id = v.id) as item_count
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $quotations = $stmt->fetchAll();

        ApiResponse::success([
            'quotations' => $quotations,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Quotations retrieved successfully');
    }

    // POST: Create quotation
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Validation
        $rules = [
            'party_ledger_id' => 'required',
            'voucher_date' => 'required',
            'items' => 'required'
        ];

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Validate date
        if (!VoucherHelper::isValidVoucherDate($input['voucher_date'])) {
            ApiResponse::validationError(['voucher_date' => ['Invalid date format (use Y-m-d)']]);
        }

        // Validate items
        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        // Validate party ledger exists
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name, g.nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['party_ledger_id']]);
        $partyLedger = $stmt->fetch();

        if (!$partyLedger) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // Generate quotation number
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : VoucherHelper::generateVoucherNo($pdo, 'Quotation', $companyId, 1, $input['voucher_date'] ?? null);

            // Calculate totals (Simple calculation without GST)
            $subtotal = 0;
            $totalDiscount = 0;
            $itemsTotal = 0;
            $chargesTotal = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $amount = $lineTotal - $discountAmt;

                $subtotal += $lineTotal;
                $totalDiscount += $discountAmt;
                $itemsTotal += $amount;

                $processedItems[] = [
                    'product_id' => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name' => $item['item_name'],
                    'colour' => $item['colour'] ?? null,
                    'gsm' => $item['gsm'] ?? null,
                    'dia' => $item['dia'] ?? null,
                    'count' => $item['count'] ?? null,
                    'roll' => $item['roll'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'] ?? null,
                    'rate' => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount' => $discountAmt,
                    'amount' => $amount,
                    'description' => $item['description'] ?? null
                ];
            }

            // Process additional charges (transport, packing, etc.)
            $processedCharges = [];
            if (!empty($input['charges']) && is_array($input['charges'])) {
                foreach ($input['charges'] as $charge) {
                    $chargeName = trim($charge['charge_name'] ?? '');
                    $chargeAmt  = floatval($charge['amount'] ?? 0);
                    if ($chargeName !== '' && $chargeAmt != 0) {
                        $processedCharges[] = [
                            'charge_name' => $chargeName,
                            'amount'      => $chargeAmt
                        ];
                        $chargesTotal += $chargeAmt;
                    }
                }
            }

            $grandTotal = $itemsTotal + $chargesTotal;

            // Billing details (from party ledger or input)
            $billingName = $input['billing_name'] ?? $partyLedger['name'];
            $billingAddress = $input['billing_address'] ?? $partyLedger['address'];
            $billingCity = $input['billing_city'] ?? $partyLedger['city'] ?? null;
            $billingState = $input['billing_state'] ?? $partyLedger['state'] ?? null;
            $billingPincode = $input['billing_pincode'] ?? $partyLedger['pincode'] ?? null;
            $billingPhone = $input['billing_phone'] ?? $partyLedger['phone'] ?? null;

            // Create voucher (Quotation)
            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    party_ledger_id,
                    billing_name, billing_address, billing_city, billing_state, billing_pincode, billing_phone,
                    total_amount, narration, status, created_by
                ) VALUES (?, 'Quotation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $companyId,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                $billingName,
                $billingAddress,
                $billingCity,
                $billingState,
                $billingPincode,
                $billingPhone,
                $grandTotal,
                $input['narration'] ?? null,
                $input['status'] ?? 'posted',
                $user['id']
            ]);

            $voucherId = $pdo->lastInsertId();

            // Insert items
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, discount_percent, discount_amount, amount, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $voucherId,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['gsm'],
                    $item['dia'],
                    $item['count'],
                    $item['roll'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['discount_percent'],
                    $item['discount_amount'],
                    $item['amount'],
                    $item['description']
                ]);

                // Reduce stock - STOCK EFFECT
                if ($item['product_id']) {
                    $stmtStock = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmtStock->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'quotation', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Quotation to ' . $partyLedger['name']
                    ]);
                }
            }

            // Insert additional charges
            if (!empty($processedCharges)) {
                $stmtCharge = $pdo->prepare("
                    INSERT INTO voucher_charges (voucher_id, charge_name, amount)
                    VALUES (?, ?, ?)
                ");
                foreach ($processedCharges as $charge) {
                    $stmtCharge->execute([$voucherId, $charge['charge_name'], $charge['amount']]);
                }
            }

            $pdo->commit();

            // Return response
            $quotation = [
                'id' => $voucherId,
                'voucher_no' => $voucherNo,
                'voucher_date' => $input['voucher_date'],
                'party_name' => $partyLedger['name'],
                'billing' => [
                    'name' => $billingName,
                    'address' => $billingAddress,
                    'city' => $billingCity,
                    'state' => $billingState,
                    'pincode' => $billingPincode,
                    'phone' => $billingPhone
                ],
                'subtotal'       => round($subtotal, 2),
                'discount'       => round($totalDiscount, 2),
                'items_total'    => round($itemsTotal, 2),
                'charges_total'  => round($chargesTotal, 2),
                'grand_total'    => round($grandTotal, 2),
                'charges'        => $processedCharges,
                'status'         => $input['status'] ?? 'posted',
                'item_count'     => count($processedItems)
            ];

            ApiResponse::success($quotation, 'Quotation created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update quotation (reverse old stock, re-apply new stock, allow voucher_no edit)
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id'])) {
            ApiResponse::error('Quotation ID is required');
        }

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Quotation'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Quotation not found', 404);
        }

        if ($existing['status'] === 'cancelled') {
            ApiResponse::error('Cancelled quotations cannot be edited', 400);
        }

        // Validate required fields
        $rules = [
            'party_ledger_id' => 'required',
            'voucher_date'     => 'required',
            'items'            => 'required'
        ];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        if (!VoucherHelper::isValidVoucherDate($input['voucher_date'])) {
            ApiResponse::validationError(['voucher_date' => ['Invalid date format (use Y-m-d)']]);
        }

        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        // Validate party ledger
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name, g.nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['party_ledger_id']]);
        $partyLedger = $stmt->fetch();

        if (!$partyLedger) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        $pdo->beginTransaction();

        try {
            // 1. REVERSE OLD STOCK
            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ?");
            $stmt->execute([$existing['voucher_no']]);

            $stmt = $pdo->prepare("SELECT product_id, quantity FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $oldItems = $stmt->fetchAll();

            foreach ($oldItems as $oldItem) {
                if ($oldItem['product_id']) {
                    $stmtStock = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmtStock->execute([$oldItem['quantity'], $oldItem['product_id']]);
                }
            }

            // 2. DELETE OLD ITEMS AND CHARGES
            $stmt = $pdo->prepare("DELETE FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);

            $stmt = $pdo->prepare("DELETE FROM voucher_charges WHERE voucher_id = ?");
            $stmt->execute([$id]);

            // 3. RECALCULATE TOTALS
            $subtotal       = 0;
            $totalDiscount  = 0;
            $itemsTotal     = 0;
            $chargesTotal   = 0;
            $grandTotal     = 0;
            $processedItems = [];

            foreach ($input['items'] as $item) {
                $qty         = floatval($item['quantity']);
                $rate        = floatval($item['rate']);
                $lineTotal   = $qty * $rate;
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $amount      = $lineTotal - $discountAmt;

                $subtotal      += $lineTotal;
                $totalDiscount += $discountAmt;
                $itemsTotal    += $amount;

                $processedItems[] = [
                    'product_id'       => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name'        => $item['item_name'],
                    'colour'           => $item['colour'] ?? null,
                    'gsm'              => $item['gsm'] ?? null,
                    'dia'              => $item['dia'] ?? null,
                    'count'            => $item['count'] ?? null,
                    'roll'             => $item['roll'] ?? null,
                    'quantity'         => $qty,
                    'unit_id'          => $item['unit_id'] ?? null,
                    'rate'             => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount'  => $discountAmt,
                    'amount'           => $amount,
                    'description'      => $item['description'] ?? null
                ];
            }

            // Process updated charges
            $processedCharges = [];
            if (!empty($input['charges']) && is_array($input['charges'])) {
                foreach ($input['charges'] as $charge) {
                    $chargeName = trim($charge['charge_name'] ?? '');
                    $chargeAmt  = floatval($charge['amount'] ?? 0);
                    if ($chargeName !== '' && $chargeAmt != 0) {
                        $processedCharges[] = [
                            'charge_name' => $chargeName,
                            'amount'      => $chargeAmt
                        ];
                        $chargesTotal += $chargeAmt;
                    }
                }
            }

            $grandTotal = $itemsTotal + $chargesTotal;

            // 4. Voucher number: use input if provided, else keep existing
            $voucherNo = isset($input['voucher_no']) && trim((string)$input['voucher_no']) !== ''
                ? trim((string)$input['voucher_no'])
                : $existing['voucher_no'];

            // 5. Billing details
            $billingName    = $input['billing_name']    ?? $partyLedger['name'];
            $billingAddress = $input['billing_address'] ?? $partyLedger['address'];
            $billingCity    = $input['billing_city']    ?? $partyLedger['city']    ?? null;
            $billingState   = $input['billing_state']   ?? $partyLedger['state']   ?? null;
            $billingPincode = $input['billing_pincode'] ?? $partyLedger['pincode'] ?? null;
            $billingPhone   = $input['billing_phone']   ?? $partyLedger['phone']   ?? null;

            // 6. UPDATE VOUCHER HEADER
            $stmt = $pdo->prepare("
                UPDATE vouchers SET
                    voucher_no      = ?,
                    voucher_date    = ?,
                    reference_no    = ?,
                    party_ledger_id = ?,
                    billing_name    = ?,
                    billing_address = ?,
                    billing_city    = ?,
                    billing_state   = ?,
                    billing_pincode = ?,
                    billing_phone   = ?,
                    total_amount    = ?,
                    narration       = ?,
                    status          = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? $existing['reference_no'],
                $input['party_ledger_id'],
                $billingName,
                $billingAddress,
                $billingCity,
                $billingState,
                $billingPincode,
                $billingPhone,
                $grandTotal,
                $input['narration'] ?? $existing['narration'],
                $input['status'] ?? $existing['status'],
                $id
            ]);

            // 7. INSERT NEW ITEMS + REDUCE STOCK
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, discount_percent, discount_amount, amount, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $id,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['gsm'],
                    $item['dia'],
                    $item['count'],
                    $item['roll'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['discount_percent'],
                    $item['discount_amount'],
                    $item['amount'],
                    $item['description']
                ]);

                if ($item['product_id']) {
                    $stmtStock = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmtStock->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'quotation', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Quotation to ' . $partyLedger['name']
                    ]);
                }
            }

            // Insert updated charges
            if (!empty($processedCharges)) {
                $stmtCharge = $pdo->prepare("
                    INSERT INTO voucher_charges (voucher_id, charge_name, amount)
                    VALUES (?, ?, ?)
                ");
                foreach ($processedCharges as $charge) {
                    $stmtCharge->execute([$id, $charge['charge_name'], $charge['amount']]);
                }
            }

            $pdo->commit();

            ApiResponse::success([
                'id'            => $id,
                'voucher_no'    => $voucherNo,
                'items_total'   => round($itemsTotal, 2),
                'charges_total' => round($chargesTotal, 2),
                'grand_total'   => round($grandTotal, 2),
                'charges'       => $processedCharges
            ], 'Quotation updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel quotation
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Quotation ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Quotation'");
        $stmt->execute([$id]);
        $quotation = $stmt->fetch();

        if (!$quotation) {
            ApiResponse::error('Quotation not found', 404);
        }

        if ($quotation['status'] === 'cancelled') {
            ApiResponse::error('Quotation is already cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Reverse stock - add back
            $stmt = $pdo->prepare("
                SELECT product_id, quantity FROM voucher_items
                WHERE voucher_id = ? AND product_id IS NOT NULL
            ");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll();

            foreach ($items as $item) {
                $stmtStock = $pdo->prepare("
                    UPDATE items SET opening_stock = opening_stock + ?
                    WHERE id = ? AND track_inventory = 1
                ");
                $stmtStock->execute([$item['quantity'], $item['product_id']]);
            }

            // Cancel quotation
            $stmt = $pdo->prepare("UPDATE vouchers SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Quotation cancelled and stock reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Quotation API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Quotation API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
?>
