<?php
/**
 * Estimate API (V2) - Sales-like with stock effect
 *
 * - Creates estimates (stored as voucher_type = 'Quotation')
 * - Reduces stock for track_inventory items
 * - Creates accounting entries (double-entry) when status is posted
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

    $voucherType = 'Quotation';
    $voucherLabel = 'Estimate';
    $stockMovementType = 'sales';

    $resolveFinancialYear = function ($voucherDate, $inputFinancialYear = null) {
        if (!empty($inputFinancialYear)) {
            $fy = trim((string)$inputFinancialYear);
            if (!preg_match('/^\d{4}-\d{2}$/', $fy)) {
                ApiResponse::validationError([
                    'financial_year' => ['Invalid format. Use YYYY-YY (e.g. 2025-26)']
                ]);
            }
            return $fy;
        }

        $ts = strtotime((string)$voucherDate);
        if ($ts === false) {
            ApiResponse::validationError([
                'voucher_date' => ['Invalid date format (use Y-m-d)']
            ]);
        }

        $year = (int)date('Y', $ts);
        $month = (int)date('n', $ts);
        $startYear = $month >= 4 ? $year : $year - 1;
        $endYearTwoDigits = substr((string)($startYear + 1), -2);

        return $startYear . '-' . $endYearTwoDigits;
    };

    $resolveSalesLedgerId = function ($companyId) use ($pdo) {
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE company_id = ? AND name = 'Sales Accounts' AND status = 'active' LIMIT 1");
        $stmt->execute([$companyId]);
        $ledger = $stmt->fetch();
        if ($ledger) {
            return (int)$ledger['id'];
        }

        $stmt = $pdo->prepare("SELECT id FROM `groups` WHERE company_id = ? AND name = 'Sales Accounts' AND status = 'active' LIMIT 1");
        $stmt->execute([$companyId]);
        $group = $stmt->fetch();

        if (!$group) {
            $stmt = $pdo->prepare("INSERT INTO `groups` (company_id, name, nature, is_system, affects_gross_profit, status) VALUES (?, 'Sales Accounts', 'Income', 1, 1, 'active')");
            $stmt->execute([$companyId]);
            $groupId = (int)$pdo->lastInsertId();
        } else {
            $groupId = (int)$group['id'];
        }

        $stmt = $pdo->prepare("INSERT INTO ledgers (company_id, group_id, name, status) VALUES (?, ?, 'Sales Accounts', 'active')");
        $stmt->execute([$companyId, $groupId]);

        return (int)$pdo->lastInsertId();
    };

    $postVoucherEntries = function ($voucherId, $companyId, $partyLedgerId, $amount, $referenceNo = null) use ($pdo, $resolveSalesLedgerId) {
        $amount = round((float)$amount, 2);
        if ($amount <= 0) {
            return;
        }

        $salesLedgerId = $resolveSalesLedgerId($companyId);

        $stmtEntry = $pdo->prepare("
            INSERT INTO voucher_entries (voucher_id, ledger_id, amount, dr_cr, bill_reference, description)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        // Dr Party
        $stmtEntry->execute([
            $voucherId,
            $partyLedgerId,
            $amount,
            'Dr',
            $referenceNo,
            'Estimate receivable'
        ]);

        // Cr Sales Accounts
        $stmtEntry->execute([
            $voucherId,
            $salesLedgerId,
            $amount,
            'Cr',
            $referenceNo,
            'Estimate sales'
        ]);
    };

    // GET: List estimates or get single
    if ($method === 'GET') {
        if (isset($_GET['next_voucher_no']) && $_GET['next_voucher_no'] === 'true') {
            $nextVoucherNo = VoucherHelper::generateVoucherNo($pdo, $voucherType, $_GET['company_id'] ?? null, 1);
            ApiResponse::success([
                'next_voucher_no' => $nextVoucherNo
            ], 'Next estimate number retrieved successfully');
        }

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT v.*,
                       l.name as party_name,
                       l.address as party_address,
                       l.phone as party_phone,
                       l.email as party_email,
                       u.name as created_by_name
                FROM vouchers v
                LEFT JOIN ledgers l ON v.party_ledger_id = l.id
                LEFT JOIN users u ON v.created_by = u.id
                WHERE v.id = ? AND v.voucher_type = ?
            ");
            $stmt->execute([$id, $voucherType]);
            $estimate = $stmt->fetch();

            if (!$estimate) {
                ApiResponse::error($voucherLabel . ' not found', 404);
            }

            $stmt = $pdo->prepare("
                SELECT vi.*,
                       i.item_code,
                       un.name as unit_name, un.symbol as unit_symbol,
                       g.name as godown_name
                FROM voucher_items vi
                LEFT JOIN items i ON vi.product_id = i.id
                LEFT JOIN units un ON vi.unit_id = un.id
                LEFT JOIN godowns g ON vi.godown_id = g.id
                WHERE vi.voucher_id = ?
                ORDER BY vi.id ASC
            ");
            $stmt->execute([$id]);
            $voucherItems = $stmt->fetchAll();
            $voucherItems = array_map(function ($item) {
                $discountPercent = isset($item['discount_percent']) ? (float)$item['discount_percent'] : 0;
                $discountAmount = isset($item['discount_amount']) ? (float)$item['discount_amount'] : 0;

                if ($discountPercent > 0) {
                    $item['discount_type'] = 'percent';
                    $item['discount_symbol'] = '%';
                    $item['discount_method'] = 'percentage';
                } elseif ($discountAmount > 0) {
                    $item['discount_type'] = 'amount';
                    $item['discount_symbol'] = '₹';
                    $item['discount_method'] = 'rupees';
                } else {
                    $item['discount_type'] = 'none';
                    $item['discount_symbol'] = null;
                    $item['discount_method'] = 'none';
                }

                $item['qty'] = $item['quantity'];
                $item['unit'] = $item['unit_name'] ?? $item['unit_symbol'] ?? null;
                $item['item_description'] = $item['item_name'];
                return $item;
            }, $voucherItems);
            $estimate['voucher_items'] = $voucherItems;
            $estimate['items'] = $voucherItems;

            ApiResponse::success($estimate, $voucherLabel . ' retrieved successfully');
        }

        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $party_id = $_GET['party_id'] ?? '';
        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        $financial_year = $_GET['financial_year'] ?? '';
        $from_date = $_GET['from_date'] ?? '';
        $to_date = $_GET['to_date'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["v.voucher_type = ?"];
        $params = [$voucherType];

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

        if ($company_id > 0) {
            $where[] = "v.company_id = ?";
            $params[] = $company_id;
        }

        if ($financial_year) {
            $where[] = "v.financial_year = ?";
            $params[] = trim($financial_year);
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

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("
                 SELECT v.*,
                     l.name as party_name,
                     l.address as party_address,
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
        $estimates = $stmt->fetchAll();

        ApiResponse::success([
            'estimates' => $estimates,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], $voucherLabel . ' retrieved successfully');
    }

    // POST: Create estimate
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }
        $rules = [
            'company_id' => 'required|integer',
            'party_ledger_id' => 'required',
            'voucher_date' => 'required',
            'items' => 'required'
        ];

        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        if (!VoucherHelper::isValidVoucherDate($input['voucher_date'])) {
            ApiResponse::validationError(['voucher_date' => ['Invalid date format (use Y-m-d)']]);
        }

        $financialYear = $resolveFinancialYear($input['voucher_date'], $input['financial_year'] ?? null);

        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        $companyId = (int)$input['company_id'];
        $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active'");
        $stmt->execute([$companyId]);
        $company = $stmt->fetch();
        if (!$company) {
            ApiResponse::validationError(['company_id' => ['Company not found or inactive']]);
        }

        $stmt = $pdo->prepare("
            SELECT l.*, g.name as group_name, g.nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ? AND l.company_id = ? AND l.status = 'active'
        ");
        $stmt->execute([$input['party_ledger_id'], $companyId]);
        $partyLedger = $stmt->fetch();

        if (!$partyLedger) {
            ApiResponse::validationError(['party_ledger_id' => ['Party ledger not found or inactive']]);
        }

        $pdo->beginTransaction();

        try {
            $voucherNo = isset($input['voucher_no']) && $input['voucher_no']
                ? $input['voucher_no']
                : VoucherHelper::generateVoucherNo($pdo, $voucherType, $companyId, 1);

            $stmt = $pdo->prepare("SELECT id FROM financial_years WHERE company_id = ? AND code = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$companyId, $financialYear]);
            $financialYearRow = $stmt->fetch();
            $financialYearId = $financialYearRow ? (int)$financialYearRow['id'] : null;

            $subtotal = 0;
            $totalDiscount = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $rawDiscountPercent = isset($item['discount_percent']) ? floatval($item['discount_percent']) : null;
                $rawDiscountAmount = isset($item['discount_amount']) ? floatval($item['discount_amount']) : null;
                $discountTypeRaw = strtolower(trim((string)($item['discount_type'] ?? $item['discount_mode'] ?? $item['discount_symbol'] ?? '')));

                $isPercentMode = in_array($discountTypeRaw, ['percent', 'percentage', '%', 'pct'], true);
                $isAmountMode = in_array($discountTypeRaw, ['amount', 'rupee', 'rupees', 'rs', '₹'], true);

                if ($isPercentMode) {
                    $discountPercent = max(0, min(100, $rawDiscountPercent ?? 0));
                    $discountAmt = round(($lineTotal * $discountPercent) / 100, 2);
                    $discountType = 'percent';
                } elseif ($isAmountMode) {
                    $discountAmt = max(0, $rawDiscountAmount ?? 0);
                    $discountAmt = min($discountAmt, $lineTotal);
                    $discountPercent = 0;
                    $discountType = 'amount';
                } else {
                    if ($rawDiscountAmount !== null && $rawDiscountAmount > 0) {
                        $discountAmt = max(0, min($rawDiscountAmount, $lineTotal));
                        $discountPercent = 0;
                        $discountType = 'amount';
                    } else {
                        $discountPercent = max(0, min(100, $rawDiscountPercent ?? 0));
                        $discountAmt = round(($lineTotal * $discountPercent) / 100, 2);
                        $discountType = 'percent';
                    }
                }

                $taxPercent = 0;
                $taxAmount = 0;
                $amount = ($lineTotal - $discountAmt);

                $subtotal += $lineTotal;
                $totalDiscount += $discountAmt;
                $grandTotal += $amount;

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
                    'discount_percent' => $discountPercent,
                    'discount_amount' => $discountAmt,
                    'discount_type' => $discountType,
                    'tax_id' => null,
                    'tax_percent' => $taxPercent,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'godown_id' => $item['godown_id'] ?? null,
                    'description' => $item['description'] ?? null
                ];
            }

            foreach ($processedItems as $processedItem) {
                if (!empty($processedItem['product_id'])) {
                    $stmt = $pdo->prepare("SELECT id FROM items WHERE id = ? AND company_id = ? AND status != 'inactive' LIMIT 1");
                    $stmt->execute([(int)$processedItem['product_id'], $companyId]);
                    if (!$stmt->fetch()) {
                        ApiResponse::validationError([
                            'items' => ['One or more products do not belong to the selected company']
                        ]);
                    }
                }
            }

            $stmt = $pdo->prepare("
                INSERT INTO vouchers (
                    company_id, voucher_type, voucher_no, voucher_date, reference_no,
                    party_ledger_id,
                    financial_year_id,
                    financial_year,
                    total_amount, narration, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $companyId,
                $voucherType,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? null,
                $input['party_ledger_id'],
                $financialYearId,
                $financialYear,
                $grandTotal,
                $input['narration'] ?? null,
                $input['status'] ?? 'posted',
                $user['id']
            ]);

            $voucherId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, discount_percent, discount_amount,
                    tax_id, tax_percent, tax_amount, amount, godown_id, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    $item['tax_id'],
                    $item['tax_percent'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['godown_id'],
                    $item['description']
                ]);

                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $stockMovementType,
                        $voucherNo,
                        $user['id'],
                        $voucherLabel . ' for ' . $partyLedger['name']
                    ]);
                }
            }

            if (($input['status'] ?? 'posted') === 'posted') {
                $postVoucherEntries(
                    (int)$voucherId,
                    $companyId,
                    (int)$input['party_ledger_id'],
                    $grandTotal,
                    $input['reference_no'] ?? null
                );
            }

            $pdo->commit();

            ApiResponse::success([
                'id' => $voucherId,
                'voucher_no' => $voucherNo,
                'voucher_date' => $input['voucher_date'],
                'financial_year' => $financialYear,
                'party_name' => $partyLedger['name'],
                'subtotal' => round($subtotal, 2),
                'discount' => round($totalDiscount, 2),
                'grand_total' => round($grandTotal, 2),
                'status' => $input['status'] ?? 'posted',
                'item_count' => count($processedItems)
            ], $voucherLabel . ' created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update estimate
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id'])) {
            ApiResponse::error($voucherLabel . ' ID is required');
        }

        $id = (int)$input['id'];
        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = ?");
        $stmt->execute([$id, $voucherType]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error($voucherLabel . ' not found', 404);
        }

        if (!is_array($input['items']) || empty($input['items'])) {
            ApiResponse::validationError(['items' => ['At least one item is required']]);
        }

        if (!VoucherHelper::isValidVoucherDate($input['voucher_date'])) {
            ApiResponse::validationError(['voucher_date' => ['Invalid date format (use Y-m-d)']]);
        }

        $companyId = isset($input['company_id']) ? (int)$input['company_id'] : (int)($existing['company_id'] ?? 0);
        if ($companyId <= 0) {
            ApiResponse::validationError(['company_id' => ['Company ID is required']]);
        }

        $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active'");
        $stmt->execute([$companyId]);
        if (!$stmt->fetch()) {
            ApiResponse::validationError(['company_id' => ['Company not found or inactive']]);
        }

        $financialYear = $resolveFinancialYear($input['voucher_date'], $input['financial_year'] ?? ($existing['financial_year'] ?? null));
        $stmt = $pdo->prepare("SELECT id FROM financial_years WHERE company_id = ? AND code = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$companyId, $financialYear]);
        $financialYearRow = $stmt->fetch();
        $financialYearId = $financialYearRow ? (int)$financialYearRow['id'] : null;

        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("SELECT product_id, quantity FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $oldItems = $stmt->fetchAll();

            foreach ($oldItems as $item) {
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }
            }

            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ?");
            $stmt->execute([$existing['voucher_no']]);

            $stmt = $pdo->prepare("DELETE FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);

            $stmt = $pdo->prepare("DELETE FROM voucher_entries WHERE voucher_id = ?");
            $stmt->execute([$id]);

            $subtotal = 0;
            $totalDiscount = 0;
            $grandTotal = 0;

            $processedItems = [];

            foreach ($input['items'] as $item) {
                $qty = floatval($item['quantity']);
                $rate = floatval($item['rate']);
                $lineTotal = $qty * $rate;
                $rawDiscountPercent = isset($item['discount_percent']) ? floatval($item['discount_percent']) : null;
                $rawDiscountAmount = isset($item['discount_amount']) ? floatval($item['discount_amount']) : null;
                $discountTypeRaw = strtolower(trim((string)($item['discount_type'] ?? $item['discount_mode'] ?? $item['discount_symbol'] ?? '')));

                $isPercentMode = in_array($discountTypeRaw, ['percent', 'percentage', '%', 'pct'], true);
                $isAmountMode = in_array($discountTypeRaw, ['amount', 'rupee', 'rupees', 'rs', '₹'], true);

                if ($isPercentMode) {
                    $discountPercent = max(0, min(100, $rawDiscountPercent ?? 0));
                    $discountAmt = round(($lineTotal * $discountPercent) / 100, 2);
                    $discountType = 'percent';
                } elseif ($isAmountMode) {
                    $discountAmt = max(0, $rawDiscountAmount ?? 0);
                    $discountAmt = min($discountAmt, $lineTotal);
                    $discountPercent = 0;
                    $discountType = 'amount';
                } else {
                    if ($rawDiscountAmount !== null && $rawDiscountAmount > 0) {
                        $discountAmt = max(0, min($rawDiscountAmount, $lineTotal));
                        $discountPercent = 0;
                        $discountType = 'amount';
                    } else {
                        $discountPercent = max(0, min(100, $rawDiscountPercent ?? 0));
                        $discountAmt = round(($lineTotal * $discountPercent) / 100, 2);
                        $discountType = 'percent';
                    }
                }

                $taxPercent = 0;
                $taxAmount = 0;
                $amount = ($lineTotal - $discountAmt);

                $subtotal += $lineTotal;
                $totalDiscount += $discountAmt;
                $grandTotal += $amount;

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
                    'discount_percent' => $discountPercent,
                    'discount_amount' => $discountAmt,
                    'discount_type' => $discountType,
                    'tax_id' => null,
                    'tax_percent' => $taxPercent,
                    'tax_amount' => $taxAmount,
                    'amount' => $amount,
                    'godown_id' => $item['godown_id'] ?? null,
                    'description' => $item['description'] ?? null
                ];
            }

            foreach ($processedItems as $processedItem) {
                if (!empty($processedItem['product_id'])) {
                    $stmt = $pdo->prepare("SELECT id FROM items WHERE id = ? AND company_id = ? AND status != 'inactive' LIMIT 1");
                    $stmt->execute([(int)$processedItem['product_id'], $companyId]);
                    if (!$stmt->fetch()) {
                        ApiResponse::validationError([
                            'items' => ['One or more products do not belong to the selected company']
                        ]);
                    }
                }
            }

            $voucherNo = $input['voucher_no'] ?? $existing['voucher_no'];
            $stmt = $pdo->prepare("
                UPDATE vouchers
                SET company_id = ?, voucher_no = ?, voucher_date = ?, reference_no = ?,
                    financial_year_id = ?, financial_year = ?,
                    total_amount = ?, narration = ?, status = ?
                WHERE id = ? AND voucher_type = ?
            ");

            $stmt->execute([
                $companyId,
                $voucherNo,
                $input['voucher_date'],
                $input['reference_no'] ?? $existing['reference_no'],
                $financialYearId,
                $financialYear,
                $grandTotal,
                $input['narration'] ?? $existing['narration'],
                $input['status'] ?? $existing['status'],
                $id,
                $voucherType
            ]);

            $stmtItem = $pdo->prepare("
                INSERT INTO voucher_items (
                    voucher_id, product_id, item_name, colour, gsm, dia, count, roll,
                    quantity, unit_id, rate, discount_percent, discount_amount,
                    tax_id, tax_percent, tax_amount, amount, godown_id, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    $item['tax_id'],
                    $item['tax_percent'],
                    $item['tax_amount'],
                    $item['amount'],
                    $item['godown_id'],
                    $item['description']
                ]);

                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock - ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);

                    $stmtMovement = $pdo->prepare("
                        INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ");
                    $stmtMovement->execute([
                        $item['product_id'],
                        $item['quantity'],
                        $stockMovementType,
                        $voucherNo,
                        $user['id'],
                        $voucherLabel . ' update'
                    ]);
                }
            }

            $nextStatus = $input['status'] ?? $existing['status'];
            if ($nextStatus === 'posted') {
                $postVoucherEntries(
                    (int)$id,
                    $companyId,
                    (int)($existing['party_ledger_id'] ?? 0),
                    $grandTotal,
                    $input['reference_no'] ?? $existing['reference_no'] ?? null
                );
            }

            $pdo->commit();

            ApiResponse::success([
                'id' => $id,
                'voucher_no' => $voucherNo,
                'voucher_date' => $input['voucher_date'],
                'financial_year' => $financialYear,
                'subtotal' => round($subtotal, 2),
                'discount' => round($totalDiscount, 2),
                'grand_total' => round($grandTotal, 2),
                'status' => $input['status'] ?? $existing['status'],
                'item_count' => count($processedItems)
            ], $voucherLabel . ' updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Cancel estimate
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error($voucherLabel . ' ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT * FROM vouchers WHERE id = ? AND voucher_type = ?");
        $stmt->execute([$id, $voucherType]);
        $existing = $stmt->fetch();

        if (!$existing) {
            ApiResponse::error($voucherLabel . ' not found', 404);
        }

        if ($existing['status'] === 'cancelled') {
            ApiResponse::success(null, $voucherLabel . ' already cancelled');
        }

        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("SELECT product_id, quantity FROM voucher_items WHERE voucher_id = ?");
            $stmt->execute([$id]);
            $oldItems = $stmt->fetchAll();

            foreach ($oldItems as $item) {
                if ($item['product_id']) {
                    $stmt = $pdo->prepare("
                        UPDATE items
                        SET opening_stock = opening_stock + ?
                        WHERE id = ? AND track_inventory = 1
                    ");
                    $stmt->execute([$item['quantity'], $item['product_id']]);
                }
            }

            $stmt = $pdo->prepare("DELETE FROM stock_movement WHERE reference = ?");
            $stmt->execute([$existing['voucher_no']]);

            $stmt = $pdo->prepare("DELETE FROM voucher_entries WHERE voucher_id = ?");
            $stmt->execute([$id]);

            $stmt = $pdo->prepare("UPDATE vouchers SET status = 'cancelled' WHERE id = ? AND voucher_type = ?");
            $stmt->execute([$id, $voucherType]);

            $pdo->commit();

            ApiResponse::success(null, $voucherLabel . ' cancelled successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Estimate V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Estimate V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
