<?php
/**
 * Receipt Voucher API
 *
 * Used to record money received from customers (Sundry Debtors)
 *
 * Accounting Entry:
 * - Dr: Cash/Bank Account (money received)
 * - Cr: Customer Account (debtor balance reduced)
 *
 * Features:
 * - Bill-by-bill adjustment (settle specific invoices)
 * - Partial payment support
 * - Multiple payment modes (Cash, Bank, UPI, etc.)
 * - On Account payment (advance without specific bill)
 * - TDS/Discount deduction support
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
require_once __DIR__ . '/../../../helpers/voucher.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Outstanding bills for a party (must be checked FIRST)
    if ($method === 'GET' && isset($_GET['outstanding']) && isset($_GET['party_id'])) {
        $partyId = (int)$_GET['party_id'];

        $stmt = $pdo->prepare("
            SELECT
                ba.id as allocation_id,
                ba.bill_no,
                ba.bill_date,
                ba.amount as bill_amount,
                ba.pending_amount,
                v.voucher_no,
                v.voucher_date,
                v.voucher_type,
                v.id as voucher_id
            FROM bill_allocations ba
            INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
            INNER JOIN vouchers v ON ve.voucher_id = v.id
            WHERE ba.ledger_id = ?
            AND ba.pending_amount > 0
            AND ba.type = 'New'
            AND v.status = 'posted'
            ORDER BY ba.bill_date ASC
        ");
        $stmt->execute([$partyId]);
        $bills = $stmt->fetchAll();

        // Calculate total outstanding
        $totalOutstanding = array_sum(array_column($bills, 'pending_amount'));

        ApiResponse::success([
            'bills' => $bills,
            'total_outstanding' => round($totalOutstanding, 2),
            'bill_count' => count($bills)
        ], 'Outstanding bills retrieved');
    }

    // GET: List receipts or get single
    if ($method === 'GET') {
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
                WHERE v.id = ? AND v.voucher_type = 'Receipt'
            ");
            $stmt->execute([$id]);
            $voucher = $stmt->fetch();

            if (!$voucher) {
                ApiResponse::error('Receipt not found', 404);
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

            ApiResponse::success($voucher, 'Receipt retrieved successfully');
        }

        // List all receipts
        $search = $_GET['search'] ?? '';
        $party_id = $_GET['party_id'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $status = $_GET['status'] ?? '';
        $show_cancelled = isset($_GET['show_cancelled']) && $_GET['show_cancelled'] == '1';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = 'Receipt'"];
        $params = [];

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

        // Get receipts
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as party_name
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
            ORDER BY v.voucher_date DESC, v.id DESC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $receipts = $stmt->fetchAll();

        ApiResponse::success([
            'receipts' => $receipts,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Receipts retrieved successfully');
    }

    // POST: Create receipt
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Validation
        $rules = [
            'party_ledger_id' => 'required',
            'voucher_date' => 'required',
            'amount' => 'required',
            'received_in' => 'required'  // Cash/Bank ledger ID
        ];

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        // Validate date
        if (!VoucherHelper::isValidVoucherDate($input['voucher_date'])) {
            ApiResponse::validationError(['voucher_date' => ['Invalid date format (use Y-m-d)']]);
        }

        $amount = floatval($input['amount']);
        if ($amount <= 0) {
            ApiResponse::validationError(['amount' => ['Amount must be greater than 0']]);
        }

        // Validate party ledger (should be Sundry Debtor)
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['party_ledger_id']]);
        $partyLedger = $stmt->fetch();

        if (!$partyLedger) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        // Validate received_in ledger (Cash/Bank)
        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.status = 'active'
            AND g.name IN ('Cash-in-Hand', 'Bank Accounts')
        ");
        $stmt->execute([$input['received_in']]);
        $cashBankLedger = $stmt->fetch();

        if (!$cashBankLedger) {
            ApiResponse::validationError(['received_in' => ['Invalid Cash/Bank ledger']]);
        }

        // Begin transaction
        $pdo->beginTransaction();

        try {
            // Generate receipt number
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : VoucherHelper::generateVoucherNo($pdo, 'Receipt', $input['company_id'] ?? null);

            // Calculate total (with optional deductions)
            $tdsAmount = floatval($input['tds_amount'] ?? 0);
            $discountAmount = floatval($input['discount_amount'] ?? 0);
            $totalReceived = $amount; // Amount actually received in cash/bank
            $totalSettled = $amount + $tdsAmount + $discountAmount; // Total credited to party

            // Create voucher
            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    party_ledger_id, total_amount, narration, status, created_by
                ) VALUES (?, 'Receipt', ?, ?, ?, ?, ?, ?, 'posted', ?)
            ");

            $stmt->execute([
                $input['company_id'] ?? null,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                $totalSettled,
                $input['narration'] ?? null,
                $user['id']
            ]);

            $voucherId = $pdo->lastInsertId();

            // Create accounting entries
            $stmtEntry = $pdo->prepare("
                INSERT INTO voucher_entries (voucher_id, ledger_id, amount, dr_cr, description)
                VALUES (?, ?, ?, ?, ?)
            ");

            // 1. Debit: Cash/Bank Account
            $stmtEntry->execute([
                $voucherId,
                $input['received_in'],
                $totalReceived,
                'Dr',
                'Receipt from ' . $partyLedger['name']
            ]);

            // 2. Debit: TDS (if applicable)
            if ($tdsAmount > 0 && isset($input['tds_ledger_id'])) {
                $stmtEntry->execute([
                    $voucherId,
                    $input['tds_ledger_id'],
                    $tdsAmount,
                    'Dr',
                    'TDS deducted by ' . $partyLedger['name']
                ]);
            }

            // 3. Debit: Discount Allowed (if applicable)
            if ($discountAmount > 0 && isset($input['discount_ledger_id'])) {
                $stmtEntry->execute([
                    $voucherId,
                    $input['discount_ledger_id'],
                    $discountAmount,
                    'Dr',
                    'Discount allowed to ' . $partyLedger['name']
                ]);
            }

            // 4. Credit: Party Account (Customer)
            $stmtEntry->execute([
                $voucherId,
                $input['party_ledger_id'],
                $totalSettled,
                'Cr',
                'Payment received'
            ]);

            $partyEntryId = $pdo->lastInsertId();

            // Bill-by-bill adjustment
            $billAdjustments = $input['bill_adjustments'] ?? [];
            $adjustedTotal = 0;

            if (!empty($billAdjustments)) {
                foreach ($billAdjustments as $adj) {
                    $adjAmount = floatval($adj['amount']);
                    if ($adjAmount <= 0) continue;

                    $adjustedTotal += $adjAmount;

                    // Get original bill allocation
                    $stmt = $pdo->prepare("
                        SELECT ba.*, ve.voucher_id as original_voucher_id
                        FROM bill_allocations ba
                        INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                        WHERE ba.id = ? AND ba.ledger_id = ?
                    ");
                    $stmt->execute([$adj['allocation_id'], $input['party_ledger_id']]);
                    $originalBill = $stmt->fetch();

                    if ($originalBill && $originalBill['pending_amount'] >= $adjAmount) {
                        // Update pending amount on original bill
                        $stmt = $pdo->prepare("
                            UPDATE bill_allocations
                            SET pending_amount = pending_amount - ?
                            WHERE id = ?
                        ");
                        $stmt->execute([$adjAmount, $adj['allocation_id']]);

                        // Create 'Against' allocation for this receipt
                        VoucherHelper::createBillAllocation($pdo, [
                            'ledger_id' => $input['party_ledger_id'],
                            'voucher_entry_id' => $partyEntryId,
                            'bill_no' => $originalBill['bill_no'],
                            'bill_date' => $originalBill['bill_date'],
                            'amount' => $adjAmount,
                            'type' => 'Against',
                            'pending_amount' => 0,
                            'reference_voucher_id' => $originalBill['original_voucher_id']
                        ]);
                    }
                }
            }

            // If no bill adjustments or partial adjustment, create On Account entry
            $onAccountAmount = $totalSettled - $adjustedTotal;
            if ($onAccountAmount > 0) {
                VoucherHelper::createBillAllocation($pdo, [
                    'ledger_id' => $input['party_ledger_id'],
                    'voucher_entry_id' => $partyEntryId,
                    'bill_no' => $voucherNo,
                    'bill_date' => $input['voucher_date'],
                    'amount' => $onAccountAmount,
                    'type' => 'On Account',
                    'pending_amount' => $onAccountAmount
                ]);
            }

            $pdo->commit();

            // Return response
            $receipt = [
                'id' => $voucherId,
                'voucher_no' => $voucherNo,
                'voucher_date' => $input['voucher_date'],
                'party_name' => $partyLedger['name'],
                'received_in' => $cashBankLedger['name'],
                'amount_received' => round($totalReceived, 2),
                'tds_amount' => round($tdsAmount, 2),
                'discount_amount' => round($discountAmount, 2),
                'total_settled' => round($totalSettled, 2),
                'bills_adjusted' => count($billAdjustments),
                'on_account_amount' => round($onAccountAmount, 2),
                'status' => 'posted'
            ];

            ApiResponse::success($receipt, 'Receipt created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel receipt
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

        if (!$id) {
            ApiResponse::error('Receipt ID is required');
        }

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'Receipt'");
        $stmt->execute([$id]);
        $voucher = $stmt->fetch();

        if (!$voucher) {
            ApiResponse::error('Receipt not found', 404);
        }

        if ($voucher['status'] === 'cancelled') {
            ApiResponse::error('Receipt is already cancelled', 400);
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

            // Delete bill allocations for this receipt
            $stmt = $pdo->prepare("
                DELETE ba FROM bill_allocations ba
                INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                WHERE ve.voucher_id = ?
            ");
            $stmt->execute([$id]);

            $pdo->commit();

            ApiResponse::success(null, 'Receipt cancelled and bill adjustments reversed');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Receipt API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Receipt API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
