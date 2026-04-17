<?php
/**
 * Payment Voucher API
 *
 * Used to record money paid to vendors/suppliers (Sundry Creditors)
 *
 * Accounting Entry:
 * - Dr: Vendor Account (creditor balance reduced)
 * - Cr: Cash/Bank Account (money paid out)
 *
 * Features:
 * - Bill-by-bill adjustment (settle specific purchase invoices)
 * - Partial payment support
 * - Multiple payment modes (Cash, Bank, UPI, etc.)
 * - On Account payment (advance without specific bill)
 * - TDS deduction support
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
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

$user = AuthMiddleware::authenticate();
ModuleAccessHelper::requireModule($pdo, $user, 'payment', 'Payment');

try {
    $pdo = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method = $_SERVER['REQUEST_METHOD'];

    // Ensure payment_mode column exists for classifying payment behavior.
    $hasPaymentModeColumnStmt = $pdo->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND COLUMN_NAME = 'payment_mode'");
    $hasPaymentModeColumnStmt->execute();
    if ((int)$hasPaymentModeColumnStmt->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE vouchers ADD COLUMN payment_mode ENUM('Adjustable','On Account','Advance') NULL AFTER receipt_mode");
    }

    $normalizePaymentMode = function ($mode) {
        $raw = strtolower(trim((string)$mode));
        if ($raw === 'adjustable') {
            return 'Adjustable';
        }
        if ($raw === 'advance') {
            return 'Advance';
        }
        return 'On Account';
    };

    // GET: List payments or get single or get outstanding bills
    if ($method === 'GET') {
        // Get outstanding bills for a vendor
        if (isset($_GET['outstanding_for'])) {
            $vendorId = (int)$_GET['outstanding_for'];

            $stmt = $pdo->prepare("
                SELECT
                    ba.id as allocation_id,
                    ba.bill_no,
                    ba.bill_date,
                    ba.amount as bill_amount,
                    ba.pending_amount,
                    v.voucher_no,
                    v.voucher_date,
                    v.id as voucher_id,
                    DATEDIFF(CURDATE(), ba.bill_date) as age_days
                FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                INNER JOIN vouchers v ON ve.voucher_id = v.id
                WHERE ba.ledger_id = ?
                AND ba.type IN ('New', 'Opening')
                AND ba.pending_amount > 0
                AND v.status = 'posted'
                AND (v.voucher_type = 'Purchase' OR ba.type = 'Opening')
                AND v.company_id = ?
                ORDER BY ba.bill_date ASC
            ");
            $stmt->execute([$vendorId, $companyId]);
            $bills = $stmt->fetchAll();

            $totalOutstanding = array_sum(array_column($bills, 'pending_amount'));

            ApiResponse::success([
                'vendor_id' => $vendorId,
                'total_outstanding' => round($totalOutstanding, 2),
                'bills' => $bills
            ], 'Outstanding bills retrieved');
        }

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            // Get voucher with party details
            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name as party_name,
                       l.gst_number as party_gstin,
                       l.address as party_address,
                       l.phone as party_phone,
                       u.name as created_by_name
                FROM vouchers v
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                LEFT JOIN users u ON v.created_by = u.id
                WHERE v.id = ? AND v.voucher_type = 'Payment'
            ");
            $stmt->execute([$id]);
            $voucher = $stmt->fetch();

            if (!$voucher) {
                ApiResponse::error('Payment not found', 404);
            }

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

            // Get bill adjustments
            $stmt = $pdo->prepare("
                SELECT ba.*, v2.voucher_no as original_bill_voucher_no
                FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                LEFT JOIN vouchers v2 ON ba.reference_voucher_id = v2.id
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);
            $voucher['bill_adjustments'] = $stmt->fetchAll();

            if (empty($voucher['payment_mode'])) {
                $hasAgainst = false;
                foreach ($voucher['bill_adjustments'] as $adjustment) {
                    if (strtolower((string)($adjustment['type'] ?? '')) === 'against') {
                        $hasAgainst = true;
                        break;
                    }
                }
                $voucher['payment_mode'] = $hasAgainst ? 'Adjustable' : 'On Account';
            }

            ApiResponse::success($voucher, 'Payment retrieved successfully');
        }

        // List all payments
        $search = $_GET['search'] ?? '';
        $vendor_id = $_GET['vendor_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $status = $_GET['status'] ?? '';
        $show_cancelled = isset($_GET['show_cancelled']) && $_GET['show_cancelled'] == '1';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = 'Payment'"];
        $params = [];
        TenantHelper::appendCompanyFilter($where, $params, $companyId, 'v.company_id');

        // Hide cancelled by default unless show_cancelled=1 or status=cancelled
        if ($status) {
            $where[] = "v.status = ?";
            $params[] = $status;
        } elseif (!$show_cancelled) {
            $where[] = "v.status != 'cancelled'";
        }

        if ($search) {
            $where[] = "(v.voucher_no LIKE ? OR v.reference_no LIKE ? OR l.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
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

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get payments
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as party_name,
                   COALESCE(
                       v.payment_mode,
                       CASE
                           WHEN EXISTS(
                               SELECT 1
                               FROM bill_allocations ba2
                               INNER JOIN voucher_entries ve2 ON ba2.voucher_entry_id = ve2.id
                               WHERE ve2.voucher_id = v.id AND ba2.type = 'Against'
                           ) THEN 'Adjustable'
                           ELSE 'On Account'
                       END
                   ) as payment_mode
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $payments = $stmt->fetchAll();

        ApiResponse::success([
            'payments' => $payments,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Payments retrieved successfully');
    }

    // POST: Create new payment
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        // Validation
        $errors = [];

        if (empty($input['party_ledger_id'])) {
            $errors['party_ledger_id'] = ['Vendor ledger is required'];
        }

        if (empty($input['amount']) || $input['amount'] <= 0) {
            $errors['amount'] = ['Valid amount is required'];
        }

        if (empty($input['paid_from'])) {
            $errors['paid_from'] = ['Cash/Bank ledger is required'];
        }

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Validate party ledger (Sundry Creditor or Sundry Debtor)
        $stmt = $pdo->prepare("
            SELECT l.id, l.name, g.name as group_name
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ?
            AND (
                g.name = 'Sundry Creditors' OR g.name LIKE 'Sundry Creditors%'
                OR g.name = 'Sundry Debtors' OR g.name LIKE 'Sundry Debtors%'
            )
        ");
        $stmt->execute([$input['party_ledger_id']]);
        $partyLedger = $stmt->fetch();

        if (!$partyLedger) {
            ApiResponse::validationError(['party_ledger_id' => ['Invalid ledger (must be Sundry Creditor or Sundry Debtor)']]);
        }

        // Validate paid_from ledger (Cash or Bank)
        $stmt = $pdo->prepare("
            SELECT l.id, l.name, g.name as group_name
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND g.name IN ('Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c')
        ");
        $stmt->execute([$input['paid_from']]);
        $cashBankLedger = $stmt->fetch();

        if (!$cashBankLedger) {
            ApiResponse::validationError(['paid_from' => ['Invalid Cash/Bank ledger']]);
        }

        $amount = (float)$input['amount'];
        $tdsAmount = isset($input['tds_amount']) ? (float)$input['tds_amount'] : 0;
        $discountAmount = isset($input['discount_amount']) ? (float)$input['discount_amount'] : 0;
        $voucherDate = $input['voucher_date'] ?? date('Y-m-d');
        $paymentMode = $normalizePaymentMode($input['payment_mode'] ?? 'on_account');
        $billAdjustments = $input['bill_adjustments'] ?? [];

        if ($paymentMode === 'Adjustable' && empty($billAdjustments)) {
            ApiResponse::validationError(['bill_adjustments' => ['Select at least one bill in Adjustable mode']]);
        }

        if (($paymentMode === 'On Account' || $paymentMode === 'Advance') && !empty($billAdjustments)) {
            ApiResponse::validationError(['bill_adjustments' => ['Bill adjustments are allowed only in Adjustable mode']]);
        }

        // Total settlement = amount paid + TDS deducted + discount received
        $totalSettled = $amount + $tdsAmount + $discountAmount;

        // Validate TDS ledger if TDS amount provided
        $tdsLedgerId = null;
        if ($tdsAmount > 0) {
            if (empty($input['tds_ledger_id'])) {
                ApiResponse::validationError(['tds_ledger_id' => ['TDS ledger is required when TDS amount is provided']]);
            }
            $tdsLedgerId = (int)$input['tds_ledger_id'];
        }

        // Validate discount ledger if discount amount provided
        $discountLedgerId = null;
        if ($discountAmount > 0) {
            if (empty($input['discount_ledger_id'])) {
                ApiResponse::validationError(['discount_ledger_id' => ['Discount ledger is required when discount amount is provided']]);
            }
            $discountLedgerId = (int)$input['discount_ledger_id'];
        }

        // Validate bill adjustments
        if (!empty($billAdjustments)) {
            $adjTotal = array_sum(array_column($billAdjustments, 'amount'));
            if ($adjTotal > $totalSettled + 0.01) {
                ApiResponse::validationError(['bill_adjustments' => ['Adjustment total exceeds payment amount']]);
            }

            foreach ($billAdjustments as $idx => $adj) {
                if (empty($adj['allocation_id']) || empty($adj['amount'])) {
                    ApiResponse::validationError(["bill_adjustments.$idx" => ['allocation_id and amount required']]);
                }

                // Verify allocation exists
                $stmt = $pdo->prepare("
                    SELECT ba.*, v.voucher_no
                    FROM bill_allocations ba
                    INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ba.id = ?
                    AND ba.ledger_id = ?
                    AND ba.type IN ('New', 'Opening')
                    AND (v.voucher_type = 'Purchase' OR ba.type = 'Opening')
                    AND v.company_id = ?
                ");
                $stmt->execute([$adj['allocation_id'], $input['party_ledger_id'], $companyId]);
                $allocation = $stmt->fetch();

                if (!$allocation) {
                    ApiResponse::validationError(["bill_adjustments.$idx" => ['Invalid bill allocation']]);
                }

                if ($adj['amount'] > $allocation['pending_amount'] + 0.01) {
                    ApiResponse::validationError(["bill_adjustments.$idx" => ["Amount exceeds pending ({$allocation['pending_amount']})"]]);
                }
            }
        }

        $pdo->beginTransaction();

        try {
            // Generate voucher number
            $voucherNo = VoucherHelper::generateVoucherNo($pdo, 'Payment', $companyId, 1, $voucherDate);

            // Get Financial Year
            $resolvedFy = FinancialYearHelper::ensureYear($pdo, $companyId, $voucherDate);
            $fyId = (int)$resolvedFy['id'];
            $fyCode = $resolvedFy['code'];

            // Create voucher
            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date,
                    financial_year_id, financial_year,
                    party_ledger_id, total_amount,
                    reference_no, narration, payment_mode, status, created_by
                ) VALUES (
                    ?, 'Payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?
                )
            ");
            $stmt->execute([
                $companyId,
                $voucherNo,
                $voucherDate,
                $fyId,
                $fyCode,
                $input['party_ledger_id'],
                $totalSettled,
                $input['reference_no'] ?? null,
                $input['narration'] ?? null,
                $paymentMode,
                $user['id']
            ]);
            $voucherId = $pdo->lastInsertId();

            // Create accounting entries
            // Dr: Vendor Account (reduces payable)
            $stmt = $pdo->prepare("
                INSERT INTO voucher_entries (voucher_id, ledger_id, dr_cr, amount, financial_year_id)
                VALUES (?, ?, 'Dr', ?, ?)
            ");
            $stmt->execute([$voucherId, $input['party_ledger_id'], $totalSettled, $fyId]);
            $vendorEntryId = $pdo->lastInsertId();

            // Cr: Cash/Bank Account (money going out)
            $stmt = $pdo->prepare("
                INSERT INTO voucher_entries (voucher_id, ledger_id, dr_cr, amount, financial_year_id)
                VALUES (?, ?, 'Cr', ?, ?)
            ");
            $stmt->execute([$voucherId, $input['paid_from'], $amount, $fyId]);

            // Cr: TDS Payable (if TDS deducted)
            if ($tdsAmount > 0) {
                $stmt = $pdo->prepare("
                    INSERT INTO voucher_entries (voucher_id, ledger_id, dr_cr, amount, financial_year_id)
                    VALUES (?, ?, 'Cr', ?, ?)
                ");
                $stmt->execute([$voucherId, $tdsLedgerId, $tdsAmount, $fyId]);
            }

            // Cr: Discount Received (if discount received)
            if ($discountAmount > 0) {
                $stmt = $pdo->prepare("
                    INSERT INTO voucher_entries (voucher_id, ledger_id, dr_cr, amount, financial_year_id)
                    VALUES (?, ?, 'Cr', ?, ?)
                ");
                $stmt->execute([$voucherId, $discountLedgerId, $discountAmount, $fyId]);
            }

            // Process bill adjustments
            if (!empty($billAdjustments)) {
                foreach ($billAdjustments as $adj) {
                    $adjAmount = (float)$adj['amount'];

                    // Get original bill info
                    $stmt = $pdo->prepare("
                        SELECT ve.voucher_id as original_voucher_id, ba.bill_no
                        FROM bill_allocations ba
                        INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                        WHERE ba.id = ?
                    ");
                    $stmt->execute([$adj['allocation_id']]);
                    $originalBill = $stmt->fetch();

                    // Update pending amount on original bill
                    $stmt = $pdo->prepare("
                        UPDATE bill_allocations
                        SET pending_amount = pending_amount - ?
                        WHERE id = ?
                    ");
                    $stmt->execute([$adjAmount, $adj['allocation_id']]);

                    // Create 'Against' allocation for this payment
                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['party_ledger_id'],
                        'voucher_entry_id' => $vendorEntryId,
                        'bill_no' => $originalBill['bill_no'],
                        'bill_date' => $voucherDate,
                        'amount' => $adjAmount,
                        'type' => 'Against',
                        'pending_amount' => 0,
                        'reference_voucher_id' => $originalBill['original_voucher_id']
                    ]);
                }
            } else {
                // On Account payment (advance without specific bill)
                $onAccountAmount = $totalSettled;
                VoucherHelper::createBillAllocation($pdo, [
                    'ledger_id' => $input['party_ledger_id'],
                    'voucher_entry_id' => $vendorEntryId,
                    'bill_no' => $voucherNo,
                    'bill_date' => $voucherDate,
                    'amount' => $onAccountAmount,
                    'type' => $residualType,
                    'pending_amount' => $onAccountAmount,
                    'financial_year_id' => $fyId
                ]);
            }

            $pdo->commit();

            $payment = [
                'id' => $voucherId,
                'voucher_no' => $voucherNo,
                'voucher_date' => $voucherDate,
                'party_name' => $partyLedger['name'],
                'paid_from' => $cashBankLedger['name'],
                'amount_paid' => round($amount, 2),
                'tds_amount' => round($tdsAmount, 2),
                'discount_amount' => round($discountAmount, 2),
                'total_settled' => round($totalSettled, 2),
                'bills_adjusted' => count($billAdjustments),
                'payment_mode' => $paymentMode,
                'status' => 'posted'
            ];

            ApiResponse::success($payment, 'Payment created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update payment
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Payment ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Payment' AND company_id = ?");
        $stmt->execute([$id, $companyId]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error('Payment not found', 404);
        }

        if ($existing['status'] === 'cancelled') {
            ApiResponse::error('Cancelled payments cannot be edited', 400);
        }

        $errors = [];
        if (empty($input['party_ledger_id'])) $errors['party_ledger_id'] = ['Vendor ledger is required'];
        if (empty($input['amount']) || $input['amount'] <= 0) $errors['amount'] = ['Valid amount is required'];
        if (empty($input['paid_from'])) $errors['paid_from'] = ['Cash/Bank ledger is required'];
        if (!empty($errors)) ApiResponse::validationError($errors);

        $stmt = $pdo->prepare("
            SELECT l.id, l.name, g.name as group_name
            FROM ledgers l INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND (
                g.name = 'Sundry Creditors' OR g.name LIKE 'Sundry Creditors%'
                OR g.name = 'Sundry Debtors' OR g.name LIKE 'Sundry Debtors%'
            )
        ");
        $stmt->execute([$input['party_ledger_id']]);
        $partyLedger = $stmt->fetch();
        if (!$partyLedger) ApiResponse::validationError(['party_ledger_id' => ['Invalid ledger']]);

        $stmt = $pdo->prepare("
            SELECT l.id, l.name, g.name as group_name
            FROM ledgers l INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND g.name IN ('Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c')
        ");
        $stmt->execute([$input['paid_from']]);
        $cashBankLedger = $stmt->fetch();
        if (!$cashBankLedger) ApiResponse::validationError(['paid_from' => ['Invalid Cash/Bank ledger']]);

        $amount = (float)$input['amount'];
        $tdsAmount = isset($input['tds_amount']) ? (float)$input['tds_amount'] : 0;
        $discountAmount = isset($input['discount_amount']) ? (float)$input['discount_amount'] : 0;
        $totalSettled = $amount + $tdsAmount + $discountAmount;
        $paymentMode = $normalizePaymentMode($input['payment_mode'] ?? 'on_account');
        $billAdjustments = $input['bill_adjustments'] ?? [];

        if ($paymentMode === 'Adjustable' && empty($billAdjustments)) {
            ApiResponse::validationError(['bill_adjustments' => ['Select at least one bill in Adjustable mode']]);
        }

        // Fetch current bill adjustments to calculate effective pending on edit
        $currentBillAdjStmt = $pdo->prepare("
            SELECT ba.bill_no, COALESCE(SUM(ba.amount), 0) as current_allocated
            FROM bill_allocations ba
            INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
            WHERE ve.voucher_id = ? AND ba.type = 'Against'
            GROUP BY ba.bill_no
        ");
        $currentBillAdjStmt->execute([$id]);
        $currentBillAdjustments = [];
        foreach ($currentBillAdjStmt->fetchAll() as $row) {
            $currentBillAdjustments[$row['bill_no']] = (float)$row['current_allocated'];
        }

        foreach ($billAdjustments as $idx => $adj) {
            $adjAmount = (float)($adj['amount'] ?? 0);
            $allocationId = (int)($adj['allocation_id'] ?? 0);
            $billNo = trim((string)($adj['bill_no'] ?? ''));
            if (($allocationId <= 0 && $billNo === '') || $adjAmount <= 0) {
                ApiResponse::validationError(["bill_adjustments.$idx" => ['allocation_id or bill_no and valid amount are required']]);
            }
            if ($allocationId > 0) {
                $stmt = $pdo->prepare("
                    SELECT ba.id, ba.bill_no, ba.pending_amount
                    FROM bill_allocations ba
                    INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ba.id = ? AND ba.ledger_id = ? AND ba.type IN ('New','Opening')
                    AND (v.voucher_type = 'Purchase' OR ba.type = 'Opening') AND v.company_id = ?
                ");
                $stmt->execute([$allocationId, $input['party_ledger_id'], $companyId]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT ba.id, ba.bill_no, ba.pending_amount
                    FROM bill_allocations ba
                    INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ba.bill_no = ? AND ba.ledger_id = ? AND ba.type IN ('New','Opening')
                    AND (v.voucher_type = 'Purchase' OR ba.type = 'Opening') AND v.company_id = ?
                    ORDER BY ba.id DESC LIMIT 1
                ");
                $stmt->execute([$billNo, $input['party_ledger_id'], $companyId]);
            }
            $allocation = $stmt->fetch();
            if (!$allocation) {
                ApiResponse::validationError(["bill_adjustments.$idx" => ['Invalid bill allocation']]);
            }
            $effectivePending = (float)$allocation['pending_amount'] + ($currentBillAdjustments[$allocation['bill_no']] ?? 0);
            if ($adjAmount > $effectivePending + 0.01) {
                ApiResponse::validationError(["bill_adjustments.$idx" => ["Amount exceeds pending ({$effectivePending})"]]);
            }
        }

        $pdo->beginTransaction();
        try {
            // Restore pending amounts for existing 'Against' allocations
            $stmt = $pdo->prepare("
                SELECT ba.*, ve.ledger_id
                FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ? AND ba.type = 'Against'
            ");
            $stmt->execute([$id]);
            foreach ($stmt->fetchAll() as $adj) {
                $pdo->prepare("
                    UPDATE bill_allocations SET pending_amount = pending_amount + ?
                    WHERE ledger_id = ? AND bill_no = ? AND type = 'New'
                ")->execute([$adj['amount'], $adj['ledger_id'], $adj['bill_no']]);
            }

            // Delete old bill allocations and entries
            $pdo->prepare("DELETE ba FROM bill_allocations ba INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id WHERE ve.voucher_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM voucher_entries WHERE voucher_id = ?")->execute([$id]);

            // Update voucher header
            $pdo->prepare("
                UPDATE vouchers SET
                    voucher_date = ?, reference_no = ?, party_ledger_id = ?,
                    total_amount = ?, narration = ?, payment_mode = ?, status = 'posted'
                WHERE id = ? AND company_id = ?
            ")->execute([
                $input['voucher_date'] ?? $existing['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                $totalSettled,
                $input['narration'] ?? null,
                $paymentMode,
                $id, $companyId
            ]);

            $stmtEntry = $pdo->prepare("INSERT INTO voucher_entries (voucher_id, ledger_id, dr_cr, amount) VALUES (?, ?, ?, ?)");

            // Dr: Vendor Account
            $stmtEntry->execute([$id, $input['party_ledger_id'], 'Dr', $totalSettled]);
            $vendorEntryId = $pdo->lastInsertId();

            // Cr: Cash/Bank
            $stmtEntry->execute([$id, $input['paid_from'], 'Cr', $amount]);

            // Cr: TDS (if any)
            if ($tdsAmount > 0 && !empty($input['tds_ledger_id'])) {
                $stmtEntry->execute([$id, (int)$input['tds_ledger_id'], 'Cr', $tdsAmount]);
            }

            // Cr: Discount (if any)
            if ($discountAmount > 0 && !empty($input['discount_ledger_id'])) {
                $stmtEntry->execute([$id, (int)$input['discount_ledger_id'], 'Cr', $discountAmount]);
            }

            // Bill adjustments
            if (!empty($billAdjustments)) {
                foreach ($billAdjustments as $adj) {
                    $adjAmount = (float)$adj['amount'];
                    $adjAllocationId = (int)($adj['allocation_id'] ?? 0);
                    $adjBillNo = trim((string)($adj['bill_no'] ?? ''));

                    if ($adjAllocationId > 0) {
                        $stmt = $pdo->prepare("SELECT ba.id, ve.voucher_id as original_voucher_id, ba.bill_no FROM bill_allocations ba INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id WHERE ba.id = ?");
                        $stmt->execute([$adjAllocationId]);
                    } else {
                        $stmt = $pdo->prepare("SELECT ba.id, ve.voucher_id as original_voucher_id, ba.bill_no FROM bill_allocations ba INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id INNER JOIN vouchers v ON ve.voucher_id = v.id WHERE ba.bill_no = ? AND ba.ledger_id = ? AND ba.type IN ('New','Opening') AND v.company_id = ? ORDER BY ba.id DESC LIMIT 1");
                        $stmt->execute([$adjBillNo, $input['party_ledger_id'], $companyId]);
                    }
                    $originalBill = $stmt->fetch();

                    $pdo->prepare("UPDATE bill_allocations SET pending_amount = pending_amount - ? WHERE id = ?")->execute([$adjAmount, $originalBill['id']]);

                    VoucherHelper::createBillAllocation($pdo, [
                        'ledger_id' => $input['party_ledger_id'],
                        'voucher_entry_id' => $vendorEntryId,
                        'bill_no' => $originalBill['bill_no'],
                        'bill_date' => $input['voucher_date'] ?? $existing['voucher_date'],
                        'amount' => $adjAmount,
                        'type' => 'Against',
                        'pending_amount' => 0,
                        'reference_voucher_id' => $originalBill['original_voucher_id']
                    ]);
                }
            } else {
                $onAccountAmount = $totalSettled;
                $residualType = ($paymentMode === 'Advance') ? 'Advance' : 'On Account';
                VoucherHelper::createBillAllocation($pdo, [
                    'ledger_id' => $input['party_ledger_id'],
                    'voucher_entry_id' => $vendorEntryId,
                    'bill_no' => $existing['voucher_no'],
                    'bill_date' => $input['voucher_date'] ?? $existing['voucher_date'],
                    'amount' => $onAccountAmount,
                    'type' => $residualType,
                    'pending_amount' => $onAccountAmount
                ]);
            }

            $pdo->commit();
            ApiResponse::success(['id' => $id], 'Payment updated successfully');
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel payment
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if (!$id) {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
        }

        if (!$id) {
            ApiResponse::error('Payment ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Payment'");
        $stmt->execute([$id]);
        $voucher = $stmt->fetch();

        if (!$voucher) {
            ApiResponse::error('Payment not found', 404);
        }

        if ($voucher['status'] === 'cancelled') {
            ApiResponse::error('Payment is already cancelled', 400);
        }

        $pdo->beginTransaction();

        try {
            // Reverse bill adjustments - restore pending amounts
            $stmt = $pdo->prepare("
                SELECT ba.*, ve.ledger_id
                FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ? AND ba.type = 'Against'
            ");
            $stmt->execute([$id]);
            $adjustments = $stmt->fetchAll();

            foreach ($adjustments as $adj) {
                // Find original bill and restore pending amount
                $stmt = $pdo->prepare("
                    UPDATE bill_allocations
                    SET pending_amount = pending_amount + ?
                    WHERE ledger_id = ? AND bill_no = ? AND type = 'New'
                ");
                $stmt->execute([$adj['amount'], $adj['ledger_id'], $adj['bill_no']]);
            }

            // Cancel voucher
            $stmt = $pdo->prepare("UPDATE vouchers SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$id]);

            // Delete bill allocations for this payment
            $stmt = $pdo->prepare("
                DELETE ba FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Payment cancelled and bill adjustments reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Payment API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database Error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Payment API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
