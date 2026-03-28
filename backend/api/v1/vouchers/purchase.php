<?php
/**
 * Purchase Voucher API - WITH STOCK EFFECT
 *
 * This creates purchase invoices from vendors that:
 * - Increase stock in inventory (stock IN)
 * - Create accounting entries (double-entry)
 * - Handle GST Input Credit (CGST/SGST or IGST)
 * - Support bill-by-bill tracking for vendor payables
 * - Can link to Purchase Orders (update pending_qty)
 *
 * GST Logic (Input Credit):
 * - Same State: CGST Input + SGST Input
 * - Different State: IGST Input
 *
 * Accounting:
 * - Dr: Purchase Account (taxable value)
 * - Dr: CGST Input / SGST Input / IGST Input (tax amounts)
 * - Cr: Vendor (Sundry Creditor) - total amount
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
require_once __DIR__ . '/../../../helpers/financialYear.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    ModuleAccessHelper::requireModule($pdo, $user, 'purchase', 'Purchase');
    $companyId = TenantHelper::getCompanyId($user);
    FinancialYearHelper::bootstrap($pdo);
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List purchase invoices or get single
    if ($method === 'GET') {
        if (isset($_GET['next_voucher_no']) && $_GET['next_voucher_no'] === 'true') {
            $nextVoucherNo = VoucherHelper::generateVoucherNo($pdo, 'Purchase', $companyId, 1);
            ApiResponse::success([
                'next_voucher_no' => $nextVoucherNo
            ], 'Next voucher number retrieved successfully');
        }

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            // Get voucher with party details
            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name as vendor_name,
                       l.gst_number as vendor_gstin,
                       l.address as vendor_address,
                       l.phone as vendor_phone,
                       l.email as vendor_email,
                       u.name as created_by_name
                FROM vouchers v
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                LEFT JOIN users u ON v.created_by = u.id
                WHERE v.id = ? AND v.voucher_type = 'Purchase'
            ");
            $stmt->execute([$id]);
            $voucher = $stmt->fetch();

            if (!$voucher) {
                ApiResponse::error('Purchase invoice not found', 404);
            }

            // Get items
            $stmt = $pdo->prepare("
                SELECT vi.*,
                       i.item_code, i.hsn_code,
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
            $voucher['items'] = $stmt->fetchAll();

            // Get accounting entries
            $stmt = $pdo->prepare("
                SELECT ve.*, l.name as ledger_name, g.name as group_name
                FROM voucher_entries ve
                INNER JOIN ledgers l ON ve.ledger_id = l.id
                LEFT JOIN `groups` g ON l.group_id = g.id
                WHERE ve.voucher_id = ?
                ORDER BY ve.dr_cr DESC, ve.amount DESC
            ");
            $stmt->execute([$id]);
            $voucher['entries'] = $stmt->fetchAll();

            // Get bill allocation
            $stmt = $pdo->prepare("
                SELECT ba.* FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);
            $voucher['bill_allocation'] = $stmt->fetch();

            ApiResponse::success($voucher, 'Purchase invoice retrieved successfully');
        }

        // List all purchase invoices
        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $vendor_id = $_GET['vendor_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $financial_year_id = isset($_GET['financial_year_id']) ? (int)$_GET['financial_year_id'] : 0;
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = 'Purchase'"];
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

        if ($vendor_id) {
            $where[] = "v.party_ledger_id = ?";
            $params[] = (int)$vendor_id;
        }

        if ($from_date) {
            $where[] = "v.voucher_date >= ?";
            $params[] = $from_date;
        }

        if ($to_date) {
            $where[] = "v.voucher_date <= ?";
            $params[] = $to_date;
        }

        if ($financial_year_id > 0) {
            $where[] = "v.financial_year_id = ?";
            $params[] = $financial_year_id;
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

        // Get invoices
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as vendor_name,
                   l.gst_number as vendor_gstin,
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
        $invoices = $stmt->fetchAll();

        ApiResponse::success([
            'invoices' => $invoices,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Purchase invoices retrieved successfully');
    }

    // POST: Create purchase invoice
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Validation
        $rules = [
            'vendor_ledger_id' => 'required',
            'voucher_date' => 'required',
            'items' => 'required'
        ];

        // Allow party_ledger_id as alias for vendor_ledger_id
        if (!isset($input['vendor_ledger_id']) && isset($input['party_ledger_id'])) {
            $input['vendor_ledger_id'] = $input['party_ledger_id'];
        }

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

        // Validate vendor ledger exists (should be Sundry Creditor)
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name, g.nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['vendor_ledger_id']]);
        $vendorLedger = $stmt->fetch();

        if (!$vendorLedger) {
            ApiResponse::validationError(['vendor_ledger_id' => ['Vendor ledger not found or inactive']]);
        }

        // GST: Same State = CGST+SGST Input, Different State = IGST Input
        $companyState = $input['company_state'] ?? 'Karnataka';
        $vendorState = $input['vendor_state'] ?? $companyState;
        $isSameState = strtolower(trim($companyState)) === strtolower(trim($vendorState));

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // Generate invoice number
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : VoucherHelper::generateVoucherNo($pdo, 'Purchase', $companyId, 1, $input['voucher_date'] ?? null);

            // Calculate totals
            $subtotal = 0;
            $totalDiscount = 0;
            $totalCgst = 0;
            $totalSgst = 0;
            $totalIgst = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $productId = !empty($item['item_id']) ? (int)$item['item_id'] : (!empty($item['product_id']) ? (int)$item['product_id'] : null);
                $itemName = trim((string)($item['item_name'] ?? ''));
                if ($itemName === '' && $productId) {
                    $stmtName = $pdo->prepare("SELECT name FROM items WHERE id = ? LIMIT 1");
                    $stmtName->execute([$productId]);
                    $itemName = (string)($stmtName->fetchColumn() ?: '');
                }
                if ($itemName === '') {
                    ApiResponse::validationError(['items' => ['Item name is required for all rows']]);
                }

                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $taxableValue = $lineTotal - $discountAmt;
                $taxPercent = floatval($item['tax_percent'] ?? 0);

                // Calculate GST split (Input Credit)
                if ($isSameState) {
                    $cgst = round($taxableValue * ($taxPercent / 2) / 100, 2);
                    $sgst = round($taxableValue * ($taxPercent / 2) / 100, 2);
                    $igst = 0;
                } else {
                    $cgst = 0;
                    $sgst = 0;
                    $igst = round($taxableValue * $taxPercent / 100, 2);
                }

                $taxAmount = $cgst + $sgst + $igst;
                $amount = $taxableValue + $taxAmount;

                $subtotal += $lineTotal;
                $totalDiscount += $discountAmt;
                $totalCgst += $cgst;
                $totalSgst += $sgst;
                $totalIgst += $igst;
                $grandTotal += $amount;

                $processedItems[] = [
                    'product_id' => $productId,
                    'item_name' => $itemName,
                    'colour' => $item['colour'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => !empty($item['unit_id']) ? $item['unit_id'] : null,
                    'rate' => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount' => $discountAmt,
                    'tax_id' => !empty($item['tax_id']) ? $item['tax_id'] : null,
                    'tax_percent' => $taxPercent,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'description' => $item['description'] ?? null,
                    'order_item_id' => $item['order_item_id'] ?? null
                ];
            }

            // Round Off Calculation
            $exactTotal = $grandTotal;
            $grandTotal = round($exactTotal);
            $roundOff = $grandTotal - $exactTotal;
            $roundOffLedgerId = null;

            if (abs($roundOff) > 0) {
                $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE name = 'Round Off' AND status = 'active' LIMIT 1");
                $stmt->execute();
                $roLedger = $stmt->fetch();
                if ($roLedger) {
                    $roundOffLedgerId = $roLedger['id'];
                } else {
                    // Ledger not found, revert to exact total to avoid imbalance
                    $grandTotal = $exactTotal;
                    $roundOff = 0;
                }
            }

            // Create voucher
            $resolvedFy = FinancialYearHelper::ensureYear($pdo, $companyId, $input['voucher_date']);
            if (($resolvedFy['status'] ?? 'open') === 'closed') {
                ApiResponse::error('Selected financial year is closed', 400);
            }

            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    financial_year_id, financial_year,
                    party_ledger_id, total_amount, narration, status, created_by
                ) VALUES (?, 'Purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $companyId,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                (int)$resolvedFy['id'],
                $resolvedFy['code'],
                $input['vendor_ledger_id'],
                $grandTotal,
                $input['narration'] ?? null,
                $input['status'] ?? 'posted',
                $user['id']
            ]);

            $voucherId = $pdo->lastInsertId();

            // Insert items
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour,
                    quantity, unit_id, rate, discount_percent, discount_amount,
                    tax_id, tax_percent, tax_amount, amount, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $voucherId,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['discount_percent'],
                    $item['discount_amount'],
                    $item['tax_id'],
                    $item['tax_percent'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['description']
                ]);

                // Update stock (increase) - STOCK EFFECT (Stock IN)
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    // Add to stock_movement table
                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'purchase', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Purchase from ' . $vendorLedger['name']
                    ]);
                }

                // Update order pending qty if linked to Purchase Order
                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = billed_qty + ?,
                            pending_qty = GREATEST(0, ordered_qty - billed_qty - ?),
                            status = CASE
                                WHEN ordered_qty <= billed_qty + ? THEN 'Completed'
                                WHEN billed_qty + ? > 0 THEN 'Partial'
                                ELSE status
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'],
                        $item['quantity'],
                        $item['quantity'],
                        $item['quantity'],
                        $item['order_item_id']
                    ]);
                }
            }

            // Create accounting entries (double-entry)
            $stmtEntry = $pdo->prepare("
                INSERT INTO voucher_entries (voucher_id, ledger_id, amount, dr_cr, description)
                VALUES (?, ?, ?, ?, ?)
            ");

            // Get Purchase ledger
            $stmt = $pdo->prepare("
                SELECT l.id FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE g.name = 'Purchase Accounts' AND l.status = 'active'
                LIMIT 1
            ");
            $stmt->execute();
            $purchaseLedger = $stmt->fetch();

            if ($purchaseLedger) {
                // 1. Debit: Purchase Account - Taxable value
                $taxableTotal = $subtotal - $totalDiscount;
                $stmtEntry->execute([
                    $voucherId,
                    $purchaseLedger['id'],
                    $taxableTotal,
                    'Dr',
                    'Purchase from vendor'
                ]);
            }

            // 2. Debit: GST Input Ledgers
            if ($totalCgst > 0 || $totalSgst > 0 || $totalIgst > 0) {
                $stmt = $pdo->prepare("
                    SELECT l.id, l.name FROM ledgers l
                    INNER JOIN `groups` g ON l.group_id = g.id
                    WHERE g.name = 'Duties & Taxes' AND l.status = 'active'
                ");
                $stmt->execute();
                $taxLedgers = $stmt->fetchAll();

                foreach ($taxLedgers as $tl) {
                    $name = strtoupper($tl['name']);
                    // Look for Input GST ledgers
                    if ($totalCgst > 0 && (strpos($name, 'CGST INPUT') !== false || strpos($name, 'CGST') !== false)) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalCgst, 'Dr', 'CGST Input Credit']);
                        $totalCgst = 0; // Prevent duplicate entry
                    }
                    if ($totalSgst > 0 && (strpos($name, 'SGST INPUT') !== false || strpos($name, 'SGST') !== false)) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalSgst, 'Dr', 'SGST Input Credit']);
                        $totalSgst = 0;
                    }
                    if ($totalIgst > 0 && (strpos($name, 'IGST INPUT') !== false || strpos($name, 'IGST') !== false)) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalIgst, 'Dr', 'IGST Input Credit']);
                        $totalIgst = 0;
                    }
                }
            }

            // 3. Round Off Entry
            if ($roundOffLedgerId && abs($roundOff) > 0) {
                $stmtEntry->execute([
                    $voucherId,
                    $roundOffLedgerId,
                    abs($roundOff),
                    $roundOff > 0 ? 'Dr' : 'Cr',
                    'Round Off'
                ]);
            }

            // 3. Credit: Vendor (Sundry Creditor) - Full amount
            $stmtEntry->execute([
                $voucherId,
                $input['vendor_ledger_id'],
                $grandTotal,
                'Cr',
                'Purchase from vendor - payable'
            ]);

            // Create bill allocation if vendor has bill-by-bill
            if ($vendorLedger['bill_by_bill']) {
                $stmt = $pdo->prepare("
                    SELECT id FROM voucher_entries
                    WHERE voucher_id = ? AND ledger_id = ? AND dr_cr = 'Cr'
                    LIMIT 1
                ");
                $stmt->execute([$voucherId, $input['vendor_ledger_id']]);
                $vendorEntry = $stmt->fetch();

                if ($vendorEntry) {
                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['vendor_ledger_id'],
                        'voucher_entry_id' => $vendorEntry['id'],
                        'bill_no' => $input['reference_no'] ?? $voucherNo, // Use vendor invoice no if provided
                        'bill_date' => $input['voucher_date'],
                        'amount' => $grandTotal,
                        'type' => 'New',
                        'pending_amount' => $grandTotal
                    ]);
                }
            }

            // Update linked order status
            if (!empty($input['order_id'])) {
                updatePurchaseOrderStatus($pdo, $input['order_id']);
            }

            $pdo->commit();

            // Return response
            $invoice = [
                'id' => $voucherId,
                'voucher_no' => $voucherNo,
                'voucher_date' => $input['voucher_date'],
                'vendor_name' => $vendorLedger['name'],
                'subtotal' => round($subtotal, 2),
                'discount' => round($totalDiscount, 2),
                'taxable_value' => round($subtotal - $totalDiscount, 2),
                'cgst_input' => round($processedItems[0]['cgst'] ?? 0, 2),
                'sgst_input' => round($processedItems[0]['sgst'] ?? 0, 2),
                'igst_input' => round($processedItems[0]['igst'] ?? 0, 2),
                'total_tax' => round(array_sum(array_column($processedItems, 'tax_amount')), 2),
                'grand_total' => round($grandTotal, 2),
                'round_off' => round($roundOff, 2),
                'gst_type' => $isSameState ? 'CGST+SGST Input' : 'IGST Input',
                'status' => $input['status'] ?? 'posted',
                'item_count' => count($processedItems),
                'stock_effect' => 'Stock increased for ' . count($processedItems) . ' item(s)'
            ];

            ApiResponse::success($invoice, 'Purchase invoice created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update (only draft invoices)
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id'])) {
            ApiResponse::error('Invoice ID is required');
        }

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Purchase'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Purchase invoice not found', 404);
        }

        if ($existing['status'] === 'cancelled') {
            ApiResponse::error('Cancelled invoices cannot be edited', 400);
        }

        if (FinancialYearHelper::isVoucherYearClosed($pdo, $id)) {
            ApiResponse::error('Closed financial year vouchers cannot be edited', 400);
        }

        // Validation
        $rules = [
            'vendor_ledger_id' => 'required',
            'voucher_date' => 'required',
            'items' => 'required'
        ];

        // Allow party_ledger_id as alias
        if (!isset($input['vendor_ledger_id']) && isset($input['party_ledger_id'])) {
            $input['vendor_ledger_id'] = $input['party_ledger_id'];
        }

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Validate vendor ledger
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name, g.nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['vendor_ledger_id']]);
        $vendorLedger = $stmt->fetch();

        if (!$vendorLedger) {
            ApiResponse::validationError(['vendor_ledger_id' => ['Vendor ledger not found or inactive']]);
        }

        // GST Logic
        $companyState = $input['company_state'] ?? 'Karnataka';
        $vendorState = $input['vendor_state'] ?? $companyState;
        $isSameState = strtolower(trim($companyState)) === strtolower(trim($vendorState));

        $pdo->beginTransaction();

        try {
            // 1. REVERSE OLD EFFECTS
            // Delete old stock_movement entries for this voucher
            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ?");
            $stmt->execute([$existing['voucher_no']]);

            // Get old items to reverse stock and order links
            $stmt = $pdo->prepare("SELECT product_id, quantity, order_item_id FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $oldItems = $stmt->fetchAll();

            foreach ($oldItems as $item) {
                // Reverse Stock (Purchase adds stock, so we subtract to reverse)
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }

                // Reverse Order Link (Restore pending qty)
                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = GREATEST(0, billed_qty - ?),
                            pending_qty = ordered_qty - GREATEST(0, billed_qty - ?),
                            status = CASE
                                WHEN GREATEST(0, billed_qty - ?) = 0 THEN 'Pending'
                                ELSE 'Partial'
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'],
                        $item['quantity'],
                        $item['quantity'],
                        $item['order_item_id']
                    ]);
                }
            }

            // 2. DELETE OLD DATA
            // Delete bill allocations
            $stmt = $pdo->prepare("
                DELETE ba FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);

            // Delete entries
            $stmt = $pdo->prepare("DELETE FROM voucher_entries WHERE voucher_id = ?");
            $stmt->execute([$id]);

            // Delete items
            $stmt = $pdo->prepare("DELETE FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);

            // 3. CALCULATE NEW TOTALS
            $subtotal = 0;
            $totalDiscount = 0;
            $totalCgst = 0;
            $totalSgst = 0;
            $totalIgst = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $productId = !empty($item['item_id']) ? (int)$item['item_id'] : (!empty($item['product_id']) ? (int)$item['product_id'] : null);
                $itemName = trim((string)($item['item_name'] ?? ''));
                if ($itemName === '' && $productId) {
                    $stmtName = $pdo->prepare("SELECT name FROM items WHERE id = ? LIMIT 1");
                    $stmtName->execute([$productId]);
                    $itemName = (string)($stmtName->fetchColumn() ?: '');
                }
                if ($itemName === '') {
                    ApiResponse::validationError(['items' => ['Item name is required for all rows']]);
                }

                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $taxableValue = $lineTotal - $discountAmt;
                $taxPercent = floatval($item['tax_percent'] ?? 0);

                if ($isSameState) {
                    $cgst = round($taxableValue * ($taxPercent / 2) / 100, 2);
                    $sgst = round($taxableValue * ($taxPercent / 2) / 100, 2);
                    $igst = 0;
                } else {
                    $cgst = 0;
                    $sgst = 0;
                    $igst = round($taxableValue * $taxPercent / 100, 2);
                }

                $taxAmount = $cgst + $sgst + $igst;
                $amount = $taxableValue + $taxAmount;

                $subtotal += $lineTotal;
                $totalDiscount += $discountAmt;
                $totalCgst += $cgst;
                $totalSgst += $sgst;
                $totalIgst += $igst;
                $grandTotal += $amount;

                $processedItems[] = [
                    'product_id' => $productId,
                    'item_name' => $itemName,
                    'colour' => $item['colour'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => !empty($item['unit_id']) ? $item['unit_id'] : null,
                    'rate' => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount' => $discountAmt,
                    'tax_id' => !empty($item['tax_id']) ? $item['tax_id'] : null,
                    'tax_percent' => $taxPercent,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'description' => $item['description'] ?? null,
                    'order_item_id' => $item['order_item_id'] ?? null
                ];
            }

            // Round Off Calculation
            $exactTotal = $grandTotal;
            $grandTotal = round($exactTotal);
            $roundOff = $grandTotal - $exactTotal;
            $roundOffLedgerId = null;

            if (abs($roundOff) > 0) {
                $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE name = 'Round Off' AND status = 'active' LIMIT 1");
                $stmt->execute();
                $roLedger = $stmt->fetch();
                if ($roLedger) {
                    $roundOffLedgerId = $roLedger['id'];
                } else {
                    // Ledger not found, revert to exact total
                    $grandTotal = $exactTotal;
                    $roundOff = 0;
                }
            }

            // 4. UPDATE VOUCHER HEADER
            $resolvedFy = FinancialYearHelper::ensureYear($pdo, $companyId, $input['voucher_date']);
            if (($resolvedFy['status'] ?? 'open') === 'closed') {
                ApiResponse::error('Selected financial year is closed', 400);
            }

            $stmt = $pdo->prepare("
                UPDATE vouchers SET
                    voucher_date = ?,
                    reference_no = ?,
                    financial_year_id = ?,
                    financial_year = ?,
                    party_ledger_id = ?,
                    total_amount = ?,
                    narration = ?,
                    status = ?
                WHERE id = ?
            ");

            $stmt->execute([
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                (int)$resolvedFy['id'],
                $resolvedFy['code'],
                $input['vendor_ledger_id'],
                $grandTotal,
                $input['narration'] ?? null,
                $input['status'] ?? 'posted',
                $id
            ]);

            // 5. INSERT NEW ITEMS & UPDATE STOCK
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour,
                    quantity, unit_id, rate, discount_percent, discount_amount,
                    tax_id, tax_percent, tax_amount, amount, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($processedItems as $item) {
                $stmtItem->execute([
                    $id,
                    $item['product_id'],
                    $item['item_name'],
                    $item['colour'],
                    $item['quantity'],
                    $item['unit_id'],
                    $item['rate'],
                    $item['discount_percent'],
                    $item['discount_amount'],
                    $item['tax_id'],
                    $item['tax_percent'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['description']
                ]);

                // Update stock (increase)
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    // Add to stock_movement table
                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'purchase', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $existing['voucher_no'],
                        $user['id'],
                        'Purchase from ' . $vendorLedger['name']
                    ]);
                }

                // Update order pending qty
                if (!empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = billed_qty + ?,
                            pending_qty = GREATEST(0, ordered_qty - billed_qty - ?),
                            status = CASE
                                WHEN ordered_qty <= billed_qty + ? THEN 'Completed'
                                WHEN billed_qty + ? > 0 THEN 'Partial'
                                ELSE status
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'],
                        $item['quantity'],
                        $item['quantity'],
                        $item['quantity'],
                        $item['order_item_id']
                    ]);
                }
            }

            // 6. CREATE ACCOUNTING ENTRIES
            $stmtEntry = $pdo->prepare("
                INSERT INTO voucher_entries (voucher_id, ledger_id, amount, dr_cr, description)
                VALUES (?, ?, ?, ?, ?)
            ");

            // Get Purchase ledger
            $stmt = $pdo->prepare("
                SELECT l.id FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE g.name = 'Purchase Accounts' AND l.status = 'active'
                LIMIT 1
            ");
            $stmt->execute();
            $purchaseLedger = $stmt->fetch();

            if ($purchaseLedger) {
                // Debit: Purchase Account
                $taxableTotal = $subtotal - $totalDiscount;
                $stmtEntry->execute([
                    $id,
                    $purchaseLedger['id'],
                    $taxableTotal,
                    'Dr',
                    'Purchase from vendor'
                ]);
            }

            // Debit: GST Input
            if ($totalCgst > 0 || $totalSgst > 0 || $totalIgst > 0) {
                $stmt = $pdo->prepare("
                    SELECT l.id, l.name FROM ledgers l
                    INNER JOIN `groups` g ON l.group_id = g.id
                    WHERE g.name = 'Duties & Taxes' AND l.status = 'active'
                ");
                $stmt->execute();
                $taxLedgers = $stmt->fetchAll();

                foreach ($taxLedgers as $tl) {
                    $name = strtoupper($tl['name']);
                    if ($totalCgst > 0 && (strpos($name, 'CGST INPUT') !== false || strpos($name, 'CGST') !== false)) {
                        $stmtEntry->execute([$id, $tl['id'], $totalCgst, 'Dr', 'CGST Input Credit']);
                        $totalCgst = 0;
                    }
                    if ($totalSgst > 0 && (strpos($name, 'SGST INPUT') !== false || strpos($name, 'SGST') !== false)) {
                        $stmtEntry->execute([$id, $tl['id'], $totalSgst, 'Dr', 'SGST Input Credit']);
                        $totalSgst = 0;
                    }
                    if ($totalIgst > 0 && (strpos($name, 'IGST INPUT') !== false || strpos($name, 'IGST') !== false)) {
                        $stmtEntry->execute([$id, $tl['id'], $totalIgst, 'Dr', 'IGST Input Credit']);
                        $totalIgst = 0;
                    }
                }
            }

            // Round Off Entry
            if ($roundOffLedgerId && abs($roundOff) > 0) {
                $stmtEntry->execute([
                    $id,
                    $roundOffLedgerId,
                    abs($roundOff),
                    $roundOff > 0 ? 'Dr' : 'Cr',
                    'Round Off'
                ]);
            }

            // Credit: Vendor
            $stmtEntry->execute([
                $id,
                $input['vendor_ledger_id'],
                $grandTotal,
                'Cr',
                'Purchase from vendor - payable'
            ]);

            // 7. BILL ALLOCATION
            if ($vendorLedger['bill_by_bill']) {
                $stmt = $pdo->prepare("
                    SELECT id FROM voucher_entries
                    WHERE voucher_id = ? AND ledger_id = ? AND dr_cr = 'Cr'
                    LIMIT 1
                ");
                $stmt->execute([$id, $input['vendor_ledger_id']]);
                $vendorEntry = $stmt->fetch();

                if ($vendorEntry) {
                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['vendor_ledger_id'],
                        'voucher_entry_id' => $vendorEntry['id'],
                        'bill_no' => $input['reference_no'] ?? $existing['voucher_no'],
                        'bill_date' => $input['voucher_date'],
                        'amount' => $grandTotal,
                        'type' => 'New',
                        'pending_amount' => $grandTotal
                    ]);
                }
            }

            // Update linked order status
            if (!empty($input['order_id'])) {
                updatePurchaseOrderStatus($pdo, $input['order_id']);
            }

            $pdo->commit();
            ApiResponse::success(['id' => $id], 'Purchase invoice updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel invoice (reverse stock)
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Invoice ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Purchase'");
        $stmt->execute([$id]);
        $voucher = $stmt->fetch();

        if (!$voucher) {
            ApiResponse::error('Purchase invoice not found', 404);
        }

        if ($voucher['status'] === 'cancelled') {
            ApiResponse::error('Invoice is already cancelled', 400);
        }

        if (FinancialYearHelper::isVoucherYearClosed($pdo, $id)) {
            ApiResponse::error('Closed financial year vouchers cannot be cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Reverse stock - subtract (stock was added during purchase)
            $stmt = $pdo->prepare("
                SELECT product_id, quantity FROM voucher_items
                WHERE voucher_id = ? AND product_id IS NOT NULL
            ");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll();

            foreach ($items as $item) {
                $stmt = $pdo->prepare("
                    UPDATE items SET opening_stock = opening_stock - ?
                    WHERE id = ? AND track_inventory = 1
                ");
                $stmt->execute([$item['quantity'], $item['product_id']]);
            }

            // Cancel voucher
            $stmt = $pdo->prepare("UPDATE vouchers SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$id]);

            // Zero out bill allocation
            $stmt = $pdo->prepare("
                UPDATE bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                SET ba.pending_amount = 0
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Purchase invoice cancelled and stock reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Purchase API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Purchase API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Update purchase order status based on item fulfillment
 */
function updatePurchaseOrderStatus($pdo, $orderId) {
    $stmt = $pdo->prepare("
        SELECT
            SUM(ordered_qty) as total_ordered,
            SUM(billed_qty) as total_billed,
            SUM(pending_qty) as total_pending
        FROM order_items WHERE order_id = ?
    ");
    $stmt->execute([$orderId]);
    $totals = $stmt->fetch();

    $status = 'Open';
    if ($totals['total_billed'] > 0 && $totals['total_pending'] > 0) {
        $status = 'Partial';
    } elseif ($totals['total_pending'] <= 0 && $totals['total_billed'] > 0) {
        $status = 'Completed';
    }

    $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$status, $orderId]);
}
