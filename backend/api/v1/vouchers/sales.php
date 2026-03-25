<?php
/**
 * Sales Voucher API - WITH STOCK EFFECT
 *
 * This creates actual sales invoices that:
 * - Reduce stock from inventory
 * - Create accounting entries (double-entry)
 * - Handle GST (CGST/SGST or IGST)
 * - Support bill-by-bill tracking
 * - Can link to Sales Orders (update pending_qty)
 * - Support E-Invoice generation
 *
 * GST Logic:
 * - Same State: CGST + SGST (each half of GST rate)
 * - Different State: IGST (full GST rate)
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

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    ModuleAccessHelper::requireModule($pdo, $user, 'sales', 'Sales');
    $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List sales invoices or get single
    if ($method === 'GET') {
        // Get next voucher number
        if (isset($_GET['next_voucher_no']) && $_GET['next_voucher_no'] === 'true') {
            $nextVoucherNo = VoucherHelper::generateVoucherNo($pdo, 'Sales', $companyId, 1);
            ApiResponse::success([
                'next_voucher_no' => $nextVoucherNo
            ], 'Next voucher number retrieved successfully');
        }

        // GET ?pending_delivery_notes_for_party=<ledger_id>
        // Returns posted Delivery Notes for a party that have NOT yet been converted to a Sales Invoice.
        // Use this to populate the "From Delivery Note" dropdown in the Sales form.
        if (isset($_GET['pending_delivery_notes_for_party'])) {
            $partyId = (int)$_GET['pending_delivery_notes_for_party'];

            $stmt = $pdo->prepare("
                SELECT
                    v.id, v.voucher_no, v.voucher_date, v.total_amount,
                    v.order_id, v.narration, v.vehicle_no,
                    o.order_no,
                    l.name as party_name
                FROM vouchers v
                LEFT JOIN orders  o ON v.order_id        = o.id
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                WHERE v.voucher_type     = 'Delivery Note'
                  AND v.status           = 'posted'
                  AND v.party_ledger_id  = ?
                  AND NOT EXISTS (
                      SELECT 1 FROM vouchers s
                      WHERE s.delivery_note_id = v.id
                        AND s.voucher_type     = 'Sales'
                        AND s.status          != 'cancelled'
                  )
                ORDER BY v.voucher_date DESC, v.id DESC
            ");
            $stmt->execute([$partyId]);
            $dns = $stmt->fetchAll();

            // Attach items for each DN so the frontend can auto-fill the Sales form
            $stmtItems = $pdo->prepare("
                SELECT
                    vi.id, vi.product_id, vi.item_name, vi.colour,
                    vi.quantity, vi.unit_id, vi.rate, vi.amount, vi.godown_id, vi.description,
                    vi.order_item_id,
                    i.item_code, i.hsn_code,
                    un.name as unit_name, un.symbol as unit_symbol
                FROM voucher_items vi
                LEFT JOIN items i  ON vi.product_id = i.id
                LEFT JOIN units un ON vi.unit_id     = un.id
                WHERE vi.voucher_id = ?
                ORDER BY vi.id ASC
            ");

            foreach ($dns as &$dn) {
                $stmtItems->execute([$dn['id']]);
                $dn['items'] = $stmtItems->fetchAll();
            }
            unset($dn);

            ApiResponse::success($dns, 'Pending Delivery Notes retrieved successfully');
        }

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            // Get voucher with party details
            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name as party_name,
                       l.gst_number as party_gstin,
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
                WHERE v.id = ? AND v.voucher_type = 'Sales'
            ");
            $stmt->execute([$id]);
            $voucher = $stmt->fetch();

            if (!$voucher) {
                ApiResponse::error('Sales invoice not found', 404);
            }

            // Get items
            $stmt = $pdo->prepare("
                SELECT vi.*,
                       i.item_code, i.hsn_code,
                       un.name as unit_name, un.symbol as unit_symbol,
                       t.name as tax_name, t.rate as tax_rate,
                       g.name as godown_name
                FROM voucher_items vi
                LEFT JOIN items i ON vi.product_id = i.id
                LEFT JOIN units un ON vi.unit_id = un.id
                LEFT JOIN taxes t ON vi.tax_id = t.id
                LEFT JOIN godowns g ON vi.godown_id = g.id
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

            // Get E-Invoice status
            $stmtEinvoice = $pdo->prepare("
                SELECT status, irn, ack_no, ack_date
                FROM einvoice_log
                WHERE voucher_id = ?
                ORDER BY id DESC LIMIT 1
            ");
            $stmtEinvoice->execute([$id]);
            $einvoiceLog = $stmtEinvoice->fetch();
            $voucher['einvoice'] = $einvoiceLog ? [
                'status' => $einvoiceLog['status'],
                'irn' => $einvoiceLog['irn'],
                'ack_no' => $einvoiceLog['ack_no'],
                'ack_date' => $einvoiceLog['ack_date']
            ] : [
                'status' => 'not_generated',
                'irn' => null,
                'ack_no' => null,
                'ack_date' => null
            ];

            // Get E-Waybill status
            $stmtEwaybill = $pdo->prepare("
                SELECT status, ewb_no, ewb_date
                FROM ewaybill_log
                WHERE voucher_id = ?
                ORDER BY id DESC LIMIT 1
            ");
            $stmtEwaybill->execute([$id]);
            $ewaybillLog = $stmtEwaybill->fetch();
            $voucher['ewaybill'] = $ewaybillLog ? [
                'status' => $ewaybillLog['status'],
                'ewb_no' => $ewaybillLog['ewb_no'],
                'ewb_date' => $ewaybillLog['ewb_date']
            ] : [
                'status' => 'not_generated',
                'ewb_no' => null,
                'ewb_date' => null
            ];

            ApiResponse::success($voucher, 'Sales invoice retrieved successfully');
        }

        // List all sales invoices
        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $party_id = $_GET['party_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = 'Sales'"];
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

        // Get invoices
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as party_name,
                   l.gst_number as party_gstin,
                   (SELECT COUNT(*) FROM voucher_items vi WHERE vi.voucher_id = v.id) as item_count,
                   COALESCE(el.status, 'not_generated') as einvoice_status,
                   el.irn,
                   COALESCE(ew.status, 'not_generated') as ewaybill_status,
                   ew.ewb_no
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            LEFT JOIN einvoice_log el ON v.id = el.voucher_id AND el.id = (
                SELECT MAX(id) FROM einvoice_log WHERE voucher_id = v.id
            )
            LEFT JOIN ewaybill_log ew ON v.id = ew.voucher_id AND ew.id = (
                SELECT MAX(id) FROM ewaybill_log WHERE voucher_id = v.id
            )
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
        ], 'Sales invoices retrieved successfully');
    }

    // POST: Create sales invoice
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

        // GST: Same State = CGST+SGST, Different State = IGST
        $companyState = $input['company_state'] ?? 'Karnataka';
        $partyState = $input['party_state'] ?? $companyState;
        $isSameState = strtolower(trim($companyState)) === strtolower(trim($partyState));

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // Generate invoice number
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : VoucherHelper::generateVoucherNo($pdo, 'Sales', $companyId, 1);

            // Calculate totals
            $subtotal = 0;
            $totalDiscount = 0;
            $totalCgst = 0;
            $totalSgst = 0;
            $totalIgst = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $discountAmt = floatval($item['discount_amount'] ?? 0);
                $taxableValue = $lineTotal - $discountAmt;
                $taxPercent = floatval($item['tax_percent'] ?? 0);

                // Calculate GST split
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
                    'product_id' => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name' => $item['item_name'],
                    'colour' => $item['colour'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'] ?? null,
                    'rate' => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount' => $discountAmt,
                    'tax_id' => $item['tax_id'] ?? null,
                    'tax_percent' => $taxPercent,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'godown_id' => $item['godown_id'] ?? null,
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

            // Billing details (from party ledger or input)
            $billingName = $input['billing_name'] ?? $partyLedger['name'];
            $billingAddress = $input['billing_address'] ?? $partyLedger['address'];
            $billingCity = $input['billing_city'] ?? $partyLedger['city'] ?? null;
            $billingState = $input['billing_state'] ?? $partyState;
            $billingPincode = $input['billing_pincode'] ?? $partyLedger['pincode'] ?? null;
            $billingGstin = $input['billing_gstin'] ?? $partyLedger['gst_number'];
            $billingPhone = $input['billing_phone'] ?? $partyLedger['phone'] ?? null;

            // Consignee details (Ship To) - can be same as billing or different
            $consigneeSameAsBilling = isset($input['consignee_same_as_billing'])
                ? (bool)$input['consignee_same_as_billing']
                : true;

            if ($consigneeSameAsBilling) {
                $consigneeName = $billingName;
                $consigneeAddress = $billingAddress;
                $consigneeCity = $billingCity;
                $consigneeState = $billingState;
                $consigneePincode = $billingPincode;
                $consigneeGstin = $billingGstin;
                $consigneePhone = $billingPhone;
            } else {
                $consigneeName = $input['consignee_name'] ?? null;
                $consigneeAddress = $input['consignee_address'] ?? null;
                $consigneeCity = $input['consignee_city'] ?? null;
                $consigneeState = $input['consignee_state'] ?? $billingState;
                $consigneePincode = $input['consignee_pincode'] ?? null;
                $consigneeGstin = $input['consignee_gstin'] ?? null;
                $consigneePhone = $input['consignee_phone'] ?? null;
            }

            // Place of supply determines GST type (consignee state for goods)
            $placeOfSupply = $input['place_of_supply'] ?? $consigneeState ?? $partyState;

            // If billing from a Delivery Note, skip SO pending_qty update (DN already reduced it)
            $deliveryNoteId = !empty($input['delivery_note_id']) ? (int)$input['delivery_note_id'] : null;
            $billingFromDN  = $deliveryNoteId !== null;

            // Create voucher
            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    party_ledger_id, order_id, delivery_note_id,
                    billing_name, billing_address, billing_city, billing_state, billing_pincode, billing_gstin, billing_phone,
                    consignee_same_as_billing,
                    consignee_name, consignee_address, consignee_city, consignee_state, consignee_pincode, consignee_gstin, consignee_phone,
                    place_of_supply,
                    vehicle_no, transporter_name, transporter_id,
                    total_amount, narration, status, created_by
                ) VALUES (?, 'Sales', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $companyId,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                !empty($input['order_id']) ? (int)$input['order_id'] : null,
                $deliveryNoteId,
                $billingName,
                $billingAddress,
                $billingCity,
                $billingState,
                $billingPincode,
                $billingGstin,
                $billingPhone,
                $consigneeSameAsBilling ? 1 : 0,
                $consigneeName,
                $consigneeAddress,
                $consigneeCity,
                $consigneeState,
                $consigneePincode,
                $consigneeGstin,
                $consigneePhone,
                $placeOfSupply,
                $input['vehicle_no'] ?? null,
                $input['transporter_name'] ?? null,
                $input['transporter_id'] ?? null,
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
                    tax_id, tax_percent, cgst, sgst, igst, tax_amount, amount, godown_id, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    $item['cgst'],
                    $item['sgst'],
                    $item['igst'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['godown_id'],
                    $item['description']
                ]);

                // Reduce stock only when NOT billing from a Delivery Note
                // (DN already reduced stock when it was created)
                if (!$billingFromDN && $item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'sales', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Sales to ' . $partyLedger['name']
                    ]);
                }

                // Update order pending qty if linked directly to SO (not via Delivery Note)
                // When billing FROM a Delivery Note, skip this — DN already reduced pending_qty
                if (!$billingFromDN && !empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = billed_qty + ?,
                            pending_qty = GREATEST(0, ordered_qty - delivered_qty - (billed_qty + ?)),
                            status = CASE
                                WHEN ordered_qty <= delivered_qty + billed_qty + ? THEN 'Completed'
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

            // 1. Debit: Party (Customer) - Full amount
            $stmtEntry->execute([
                $voucherId,
                $input['party_ledger_id'],
                $grandTotal,
                'Dr',
                'Sales to customer'
            ]);

            // Get Sales ledger
            $stmt = $pdo->prepare("
                SELECT l.id FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE g.name = 'Sales Accounts' AND l.status = 'active'
                LIMIT 1
            ");
            $stmt->execute();
            $salesLedger = $stmt->fetch();

            if ($salesLedger) {
                // 2. Credit: Sales - Taxable value
                $taxableTotal = $subtotal - $totalDiscount;
                $stmtEntry->execute([
                    $voucherId,
                    $salesLedger['id'],
                    $taxableTotal,
                    'Cr',
                    'Sales revenue'
                ]);
            }

            // 3. Credit: GST Ledgers
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
                    if ($totalCgst > 0 && strpos($name, 'CGST') !== false) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalCgst, 'Cr', 'CGST Output']);
                    }
                    if ($totalSgst > 0 && strpos($name, 'SGST') !== false) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalSgst, 'Cr', 'SGST Output']);
                    }
                    if ($totalIgst > 0 && strpos($name, 'IGST') !== false) {
                        $stmtEntry->execute([$voucherId, $tl['id'], $totalIgst, 'Cr', 'IGST Output']);
                    }
                }
            }

            // 4. Round Off Entry
            if ($roundOffLedgerId && abs($roundOff) > 0) {
                $stmtEntry->execute([
                    $voucherId,
                    $roundOffLedgerId,
                    abs($roundOff),
                    $roundOff > 0 ? 'Cr' : 'Dr',
                    'Round Off'
                ]);
            }

            // Create bill allocation if party has bill-by-bill
            if ($partyLedger['bill_by_bill']) {
                $stmt = $pdo->prepare("
                    SELECT id FROM voucher_entries
                    WHERE voucher_id = ? AND ledger_id = ? AND dr_cr = 'Dr'
                    LIMIT 1
                ");
                $stmt->execute([$voucherId, $input['party_ledger_id']]);
                $partyEntry = $stmt->fetch();

                if ($partyEntry) {
                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['party_ledger_id'],
                        'voucher_entry_id' => $partyEntry['id'],
                        'bill_no' => $voucherNo,
                        'bill_date' => $input['voucher_date'],
                        'amount' => $grandTotal,
                        'type' => 'New',
                        'pending_amount' => $grandTotal
                    ]);
                }
            }

            // Update linked order status
            if (!empty($input['order_id'])) {
                updateOrderStatus($pdo, $input['order_id']);
            }

            $pdo->commit();

            // Get E-Invoice status
            $einvoiceData = [
                'status' => 'not_generated',
                'irn' => null,
                'ack_no' => null,
                'ack_date' => null
            ];
            $stmtEinvoice = $pdo->prepare("
                SELECT status, irn, ack_no, ack_date
                FROM einvoice_log
                WHERE voucher_id = ?
                ORDER BY id DESC LIMIT 1
            ");
            $stmtEinvoice->execute([$voucherId]);
            $einvoiceLog = $stmtEinvoice->fetch();
            if ($einvoiceLog) {
                $einvoiceData = [
                    'status' => $einvoiceLog['status'],
                    'irn' => $einvoiceLog['irn'],
                    'ack_no' => $einvoiceLog['ack_no'],
                    'ack_date' => $einvoiceLog['ack_date']
                ];
            }

            // Get E-Waybill status
            $ewaybillData = [
                'status' => 'not_generated',
                'ewb_no' => null,
                'ewb_date' => null
            ];
            $stmtEwaybill = $pdo->prepare("
                SELECT status, ewb_no, ewb_date
                FROM ewaybill_log
                WHERE voucher_id = ?
                ORDER BY id DESC LIMIT 1
            ");
            $stmtEwaybill->execute([$voucherId]);
            $ewaybillLog = $stmtEwaybill->fetch();
            if ($ewaybillLog) {
                $ewaybillData = [
                    'status' => $ewaybillLog['status'],
                    'ewb_no' => $ewaybillLog['ewb_no'],
                    'ewb_date' => $ewaybillLog['ewb_date']
                ];
            }

            // Return response
            $invoice = [
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
                    'gstin' => $billingGstin,
                    'phone' => $billingPhone
                ],
                'consignee_same_as_billing' => $consigneeSameAsBilling,
                'consignee' => [
                    'name' => $consigneeName,
                    'address' => $consigneeAddress,
                    'city' => $consigneeCity,
                    'state' => $consigneeState,
                    'pincode' => $consigneePincode,
                    'gstin' => $consigneeGstin,
                    'phone' => $consigneePhone
                ],
                'place_of_supply' => $placeOfSupply,
                'subtotal' => round($subtotal, 2),
                'discount' => round($totalDiscount, 2),
                'taxable_value' => round($subtotal - $totalDiscount, 2),
                'cgst' => round($totalCgst, 2),
                'sgst' => round($totalSgst, 2),
                'igst' => round($totalIgst, 2),
                'total_tax' => round($totalCgst + $totalSgst + $totalIgst, 2),
                'grand_total' => round($grandTotal, 2),
                'round_off' => round($roundOff, 2),
                'gst_type' => $isSameState ? 'CGST+SGST' : 'IGST',
                'status' => $input['status'] ?? 'posted',
                'item_count' => count($processedItems),
                'einvoice' => $einvoiceData,
                'ewaybill' => $ewaybillData
            ];

            ApiResponse::success($invoice, 'Sales invoice created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update sales invoice
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id'])) {
            ApiResponse::error('Invoice ID is required');
        }

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Sales'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Sales invoice not found', 404);
        }

        if ($existing['status'] === 'cancelled') {
            ApiResponse::error('Cancelled invoices cannot be edited', 400);
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

        // GST Logic
        $companyState = $input['company_state'] ?? 'Karnataka';
        $partyState = $input['party_state'] ?? $companyState;
        $isSameState = strtolower(trim($companyState)) === strtolower(trim($partyState));

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
                // Reverse Stock (Sales reduces stock, so we add back to reverse)
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }

                // Reverse Order Link (Restore billed_qty) — only if original invoice was NOT from a DN
                $originalBilledFromDN = !empty($existing['delivery_note_id']);
                if (!$originalBilledFromDN && !empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = GREATEST(0, billed_qty - ?),
                            pending_qty = GREATEST(0, ordered_qty - delivered_qty - GREATEST(0, billed_qty - ?)),
                            status = CASE
                                WHEN GREATEST(0, billed_qty - ?) = 0 AND delivered_qty = 0 THEN 'Pending'
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
                    'product_id' => $item['item_id'] ?? $item['product_id'] ?? null,
                    'item_name' => $item['item_name'],
                    'colour' => $item['colour'] ?? null,
                    'quantity' => $qty,
                    'unit_id' => $item['unit_id'] ?? null,
                    'rate' => $rate,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount' => $discountAmt,
                    'tax_id' => $item['tax_id'] ?? null,
                    'tax_percent' => $taxPercent,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'godown_id' => $item['godown_id'] ?? null,
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
                    $grandTotal = $exactTotal;
                    $roundOff = 0;
                }
            }

            // Billing details
            $billingName = $input['billing_name'] ?? $partyLedger['name'];
            $billingAddress = $input['billing_address'] ?? $partyLedger['address'];
            $billingCity = $input['billing_city'] ?? $partyLedger['city'] ?? null;
            $billingState = $input['billing_state'] ?? $partyState;
            $billingPincode = $input['billing_pincode'] ?? $partyLedger['pincode'] ?? null;
            $billingGstin = $input['billing_gstin'] ?? $partyLedger['gst_number'];
            $billingPhone = $input['billing_phone'] ?? $partyLedger['phone'] ?? null;

            // Consignee details
            $consigneeSameAsBilling = isset($input['consignee_same_as_billing'])
                ? (bool)$input['consignee_same_as_billing']
                : true;

            if ($consigneeSameAsBilling) {
                $consigneeName = $billingName;
                $consigneeAddress = $billingAddress;
                $consigneeCity = $billingCity;
                $consigneeState = $billingState;
                $consigneePincode = $billingPincode;
                $consigneeGstin = $billingGstin;
                $consigneePhone = $billingPhone;
            } else {
                $consigneeName = $input['consignee_name'] ?? null;
                $consigneeAddress = $input['consignee_address'] ?? null;
                $consigneeCity = $input['consignee_city'] ?? null;
                $consigneeState = $input['consignee_state'] ?? $billingState;
                $consigneePincode = $input['consignee_pincode'] ?? null;
                $consigneeGstin = $input['consignee_gstin'] ?? null;
                $consigneePhone = $input['consignee_phone'] ?? null;
            }

            $placeOfSupply = $input['place_of_supply'] ?? $consigneeState ?? $partyState;

            // Get new voucher number (if provided) or keep existing
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : $existing['voucher_no'];

            // 4. UPDATE VOUCHER HEADER
            $stmt = $pdo->prepare("
                UPDATE vouchers SET
                    voucher_no = ?,
                    voucher_date = ?,
                    reference_no = ?,
                    party_ledger_id = ?,
                    billing_name = ?,
                    billing_address = ?,
                    billing_city = ?,
                    billing_state = ?,
                    billing_pincode = ?,
                    billing_gstin = ?,
                    billing_phone = ?,
                    consignee_same_as_billing = ?,
                    consignee_name = ?,
                    consignee_address = ?,
                    consignee_city = ?,
                    consignee_state = ?,
                    consignee_pincode = ?,
                    consignee_gstin = ?,
                    consignee_phone = ?,
                    place_of_supply = ?,
                    vehicle_no = ?,
                    transporter_name = ?,
                    transporter_id = ?,
                    total_amount = ?,
                    narration = ?,
                    status = ?,
                    order_id = ?,
                    delivery_note_id = ?
                WHERE id = ?
            ");

            $putDeliveryNoteId = !empty($input['delivery_note_id'])
                ? (int)$input['delivery_note_id']
                : ($existing['delivery_note_id'] ?? null);
            $putBillingFromDN = $putDeliveryNoteId !== null;

            $stmt->execute([
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                $billingName,
                $billingAddress,
                $billingCity,
                $billingState,
                $billingPincode,
                $billingGstin,
                $billingPhone,
                $consigneeSameAsBilling ? 1 : 0,
                $consigneeName,
                $consigneeAddress,
                $consigneeCity,
                $consigneeState,
                $consigneePincode,
                $consigneeGstin,
                $consigneePhone,
                $placeOfSupply,
                $input['vehicle_no'] ?? $existing['vehicle_no'] ?? null,
                $input['transporter_name'] ?? $existing['transporter_name'] ?? null,
                $input['transporter_id'] ?? $existing['transporter_id'] ?? null,
                $grandTotal,
                $input['narration'] ?? null,
                $input['status'] ?? 'posted',
                !empty($input['order_id']) ? (int)$input['order_id'] : null,
                $putDeliveryNoteId,
                $id
            ]);

            // 5. INSERT NEW ITEMS & UPDATE STOCK
            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour,
                    quantity, unit_id, rate, discount_percent, discount_amount,
                    tax_id, tax_percent, cgst, sgst, igst, tax_amount, amount, godown_id, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    $item['cgst'],
                    $item['sgst'],
                    $item['igst'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['godown_id'],
                    $item['description']
                ]);

                // Reduce stock only when NOT billing from a Delivery Note
                if (!$putBillingFromDN && $item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, 'sales', ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $voucherNo,
                        $user['id'],
                        'Sales to ' . $partyLedger['name']
                    ]);
                }

                // Update order pending qty only if linked directly to SO (not via Delivery Note)
                if (!$putBillingFromDN && !empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = billed_qty + ?,
                            pending_qty = GREATEST(0, ordered_qty - delivered_qty - (billed_qty + ?)),
                            status = CASE
                                WHEN ordered_qty <= delivered_qty + billed_qty + ? THEN 'Completed'
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

            // Debit: Party (Customer)
            $stmtEntry->execute([
                $id,
                $input['party_ledger_id'],
                $grandTotal,
                'Dr',
                'Sales to customer'
            ]);

            // Get Sales ledger
            $stmt = $pdo->prepare("
                SELECT l.id FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE g.name = 'Sales Accounts' AND l.status = 'active'
                LIMIT 1
            ");
            $stmt->execute();
            $salesLedger = $stmt->fetch();

            if ($salesLedger) {
                // Credit: Sales
                $taxableTotal = $subtotal - $totalDiscount;
                $stmtEntry->execute([
                    $id,
                    $salesLedger['id'],
                    $taxableTotal,
                    'Cr',
                    'Sales revenue'
                ]);
            }

            // Credit: GST Ledgers
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
                    if ($totalCgst > 0 && strpos($name, 'CGST') !== false) {
                        $stmtEntry->execute([$id, $tl['id'], $totalCgst, 'Cr', 'CGST Output']);
                        $totalCgst = 0;
                    }
                    if ($totalSgst > 0 && strpos($name, 'SGST') !== false) {
                        $stmtEntry->execute([$id, $tl['id'], $totalSgst, 'Cr', 'SGST Output']);
                        $totalSgst = 0;
                    }
                    if ($totalIgst > 0 && strpos($name, 'IGST') !== false) {
                        $stmtEntry->execute([$id, $tl['id'], $totalIgst, 'Cr', 'IGST Output']);
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
                    $roundOff > 0 ? 'Cr' : 'Dr',
                    'Round Off'
                ]);
            }

            // 7. BILL ALLOCATION
            if ($partyLedger['bill_by_bill']) {
                $stmt = $pdo->prepare("
                    SELECT id FROM voucher_entries
                    WHERE voucher_id = ? AND ledger_id = ? AND dr_cr = 'Dr'
                    LIMIT 1
                ");
                $stmt->execute([$id, $input['party_ledger_id']]);
                $partyEntry = $stmt->fetch();

                if ($partyEntry) {
                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['party_ledger_id'],
                        'voucher_entry_id' => $partyEntry['id'],
                        'bill_no' => $voucherNo,
                        'bill_date' => $input['voucher_date'],
                        'amount' => $grandTotal,
                        'type' => 'New',
                        'pending_amount' => $grandTotal
                    ]);
                }
            }

            // Update linked order status
            $linkedOrderId = !empty($input['order_id']) ? $input['order_id'] : ($existing['order_id'] ?? null);
            if ($linkedOrderId) {
                updateOrderStatus($pdo, $linkedOrderId);
            }

            $pdo->commit();
            ApiResponse::success([
                'id' => $id,
                'voucher_no' => $voucherNo,
                'grand_total' => round($grandTotal, 2),
                'round_off' => round($roundOff, 2)
            ], 'Sales invoice updated successfully');

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

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Sales'");
        $stmt->execute([$id]);
        $voucher = $stmt->fetch();

        if (!$voucher) {
            ApiResponse::error('Sales invoice not found', 404);
        }

        if ($voucher['status'] === 'cancelled') {
            ApiResponse::error('Invoice is already cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Determine if this invoice was billed from a Delivery Note
            $billedFromDN = !empty($voucher['delivery_note_id']);

            // Reverse stock and order links
            $stmt = $pdo->prepare("
                SELECT product_id, quantity, order_item_id FROM voucher_items
                WHERE voucher_id = ?
            ");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll();

            foreach ($items as $item) {
                // Reverse stock only if Sales originally reduced it (i.e., was NOT billed from a DN)
                if (!$billedFromDN && $item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }

                // Reverse order billed_qty only if Sales was linked directly to SO (not via DN)
                if (!$billedFromDN && !empty($item['order_item_id'])) {
                    $stmt = $pdo->prepare("
                        UPDATE order_items
                        SET billed_qty = GREATEST(0, billed_qty - ?),
                            pending_qty = GREATEST(0, ordered_qty - delivered_qty - GREATEST(0, billed_qty - ?)),
                            status = CASE
                                WHEN GREATEST(0, billed_qty - ?) = 0 AND delivered_qty = 0 THEN 'Pending'
                                WHEN GREATEST(0, billed_qty - ?) = 0 AND delivered_qty > 0 THEN 'Partial'
                                ELSE 'Partial'
                            END
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $item['quantity'], $item['quantity'],
                        $item['quantity'], $item['quantity'],
                        $item['order_item_id']
                    ]);
                }
            }

            // Update order status if linked
            if (!empty($voucher['order_id'])) {
                updateOrderStatus($pdo, $voucher['order_id']);
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

            ApiResponse::success(null, 'Sales invoice cancelled and stock reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Sales API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Sales API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Update order status based on item fulfillment
 */
function updateOrderStatus($pdo, $orderId) {
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
