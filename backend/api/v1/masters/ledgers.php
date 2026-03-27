<?php
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
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

// Authenticate user
$user = AuthMiddleware::authenticate();

function ledgersHasDefaultBankColumn(PDO $pdo): bool {
    static $hasColumn = null;
    if ($hasColumn !== null) {
        return $hasColumn;
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM ledgers LIKE 'is_default_bank'");
    $hasColumn = (bool)$stmt->fetch();
    return $hasColumn;
}

function ledgersHasBankBranchColumn(PDO $pdo): bool {
    static $hasColumn = null;
    if ($hasColumn !== null) {
        return $hasColumn;
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM ledgers LIKE 'bank_branch'");
    $hasColumn = (bool)$stmt->fetch();
    return $hasColumn;
}

function isBankGroupName(string $groupName): bool {
    $name = strtoupper(trim($groupName));
    return $name === 'BANK ACCOUNTS' || $name === 'BANK OD A/C' || str_contains($name, 'BANK');
}

function parseBoolFlag($value): int {
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    $v = strtolower(trim((string)$value));
    return in_array($v, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

try {
    $pdo = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List all ledgers or get single ledger
    if ($method === 'GET') {
        // Get ledgerwise outstanding (bills, receipts, payments)
        if (isset($_GET['outstanding'])) {
            $ledgerId = (int)$_GET['outstanding'];

            // Get ledger details
            $stmt = $pdo->prepare("
                SELECT l.*, g.name as group_name, g.nature
                FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE l.id = ? AND l.status = 'active'
            ");
            $stmt->execute([$ledgerId]);
            $ledger = $stmt->fetch();

            if (!$ledger) {
                ApiResponse::error('Ledger not found', 404);
            }

            $groupName = $ledger['group_name'];
            $outstanding = [];

            /**
             * For Sundry Debtors: Show outstanding Sales bills
             * For Sundry Creditors: Show outstanding Purchase bills
             */
            if ($groupName === 'Sundry Debtors' || str_starts_with($groupName, 'Sundry Debtors')) {
                // Get outstanding sales bills (amounts due from customer)
                $stmt = $pdo->prepare("
                    SELECT
                        ba.id as allocation_id,
                        ba.bill_no,
                        ba.bill_date,
                        ba.amount as bill_amount,
                        ba.pending_amount,
                        v.id as voucher_id,
                        v.voucher_no,
                        v.voucher_date,
                        DATEDIFF(CURDATE(), ba.bill_date) as age_days
                    FROM bill_allocations ba
                    INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ba.ledger_id = ?
                    AND ba.type IN ('New', 'Opening')
                    AND ba.pending_amount > 0
                    AND (v.voucher_type = 'Sales' OR ba.type = 'Opening')
                    AND v.status = 'posted'
                    ORDER BY ba.bill_date ASC
                ");
                $stmt->execute([$ledgerId]);
                $bills = $stmt->fetchAll();

                $outstanding = [
                    'ledger_type' => 'Sundry Debtors',
                    'outstanding_bills' => $bills,
                    'total_outstanding' => round(array_sum(array_column($bills, 'pending_amount')), 2)
                ];

            } elseif ($groupName === 'Sundry Creditors' || str_starts_with($groupName, 'Sundry Creditors')) {
                // Get outstanding purchase bills (amounts due to supplier)
                $stmt = $pdo->prepare("
                    SELECT
                        ba.id as allocation_id,
                        ba.bill_no,
                        ba.bill_date,
                        ba.amount as bill_amount,
                        ba.pending_amount,
                        v.id as voucher_id,
                        v.voucher_no,
                        v.voucher_date,
                        DATEDIFF(CURDATE(), ba.bill_date) as age_days
                    FROM bill_allocations ba
                    INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ba.ledger_id = ?
                    AND ba.type IN ('New', 'Opening')
                    AND ba.pending_amount > 0
                    AND (v.voucher_type = 'Purchase' OR ba.type = 'Opening')
                    AND v.status = 'posted'
                    ORDER BY ba.bill_date ASC
                ");
                $stmt->execute([$ledgerId]);
                $bills = $stmt->fetchAll();

                $outstanding = [
                    'ledger_type' => 'Sundry Creditors',
                    'outstanding_bills' => $bills,
                    'total_outstanding' => round(array_sum(array_column($bills, 'pending_amount')), 2)
                ];

            } else {
                ApiResponse::error('This ledger type does not have outstanding tracking', 400);
            }

            ApiResponse::success([
                'ledger' => $ledger,
                'outstanding' => $outstanding
            ], 'Ledgerwise outstanding retrieved successfully');
        }

        // Get single ledger by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $pdo->prepare("
                SELECT
                    l.*,
                    g.name as group_name,
                    g.nature as group_nature,
                    g.affects_gross_profit
                FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE l.id = ? AND l.status = 'active'
            ");

            $stmt->execute([$id]);
            $ledger = $stmt->fetch();

            if (!$ledger) {
                ApiResponse::error('Ledger not found', 404);
            }

            // Convert boolean fields to proper boolean
            $ledger['bill_by_bill'] = (bool)$ledger['bill_by_bill'];
            $ledger['gst_applicable'] = (bool)$ledger['gst_applicable'];
            $ledger['affects_gross_profit'] = (bool)$ledger['affects_gross_profit'];
            $ledger['is_default_bank'] = (bool)($ledger['is_default_bank'] ?? 0);

            ApiResponse::success($ledger, 'Ledger retrieved successfully');
        }

        // List all ledgers
        $search = $_GET['search'] ?? '';
        $group_id = $_GET['group_id'] ?? '';
        $nature = $_GET['nature'] ?? '';
        $bill_by_bill = $_GET['bill_by_bill'] ?? '';
        $gst_applicable = $_GET['gst_applicable'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        // Build query
        $where = ["l.status = 'active'"];
        $params = [];
        TenantHelper::appendCompanyFilter($where, $params, $companyId, 'l.company_id');

        if ($search) {
            $where[] = "(l.name LIKE ? OR l.address LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($group_id) {
            $where[] = "l.group_id = ?";
            $params[] = (int)$group_id;
        }

        if ($nature && in_array($nature, ['Asset', 'Liability', 'Income', 'Expense'])) {
            $where[] = "g.nature = ?";
            $params[] = $nature;
        }

        if ($bill_by_bill !== '') {
            $where[] = "l.bill_by_bill = ?";
            $params[] = (int)$bill_by_bill;
        }

        if ($gst_applicable !== '') {
            $where[] = "l.gst_applicable = ?";
            $params[] = (int)$gst_applicable;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Get ledgers
        $stmt = $pdo->prepare("
            SELECT
                l.id,
                l.name,
                l.group_id,
                g.name as group_name,
                g.nature as group_nature,
                l.opening_balance,
                l.opening_type,
                l.bill_by_bill,
                l.gst_applicable,
                l.gst_number,
                l.bank_name,
                " . (ledgersHasBankBranchColumn($pdo) ? "l.bank_branch" : "NULL") . " as bank_branch,
                l.account_number,
                l.ifsc_code,
                l.address,
                l.city,
                l.state,
                l.pincode,
                l.phone,
                l.email,
                " . (ledgersHasDefaultBankColumn($pdo) ? "l.is_default_bank" : "0") . " as is_default_bank,
                l.created_at
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE $whereClause
            ORDER BY l.name ASC
            LIMIT ? OFFSET ?
        ");

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $ledgers = $stmt->fetchAll();

        // Convert boolean fields
        foreach ($ledgers as &$ledger) {
            $ledger['bill_by_bill'] = (bool)$ledger['bill_by_bill'];
            $ledger['gst_applicable'] = (bool)$ledger['gst_applicable'];
            $ledger['is_default_bank'] = (bool)($ledger['is_default_bank'] ?? 0);
        }

        ApiResponse::success([
            'ledgers' => $ledgers,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Ledgers retrieved successfully');
    }

    // POST: Create new ledger
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'name' => 'required|min:2|max:150',
            'group_id' => 'required',
            'opening_balance' => 'optional',
            'opening_type' => 'optional',
            'bill_by_bill' => 'optional',
            'gst_applicable' => 'optional',
            'gst_number' => 'optional',
            'bank_name' => 'optional',
            'bank_branch' => 'optional',
            'account_number' => 'optional',
            'ifsc_code' => 'optional',
            'is_default_bank' => 'optional',
            'address' => 'optional',
            'city' => 'optional',
            'state' => 'optional',
            'pincode' => 'optional',
            'phone' => 'optional',
            'email' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = trim($input['name']);
        $group_id = (int)$input['group_id'];
        $opening_balance = isset($input['opening_balance']) ? floatval($input['opening_balance']) : 0.00;
        $opening_type = $input['opening_type'] ?? 'Dr';
        $company_id = $companyId;
        $address = $input['address'] ?? null;
        $city = $input['city'] ?? null;
        $state = $input['state'] ?? null;
        $pincode = $input['pincode'] ?? null;
        $phone = $input['phone'] ?? null;
        $email = $input['email'] ?? null;
        $gst_number = $input['gst_number'] ?? null;
        $bank_name = $input['bank_name'] ?? null;
        $bank_branch = $input['bank_branch'] ?? null;
        $account_number = $input['account_number'] ?? null;
        $ifsc_code = $input['ifsc_code'] ?? null;
        $wantsDefaultBank = isset($input['is_default_bank']) ? parseBoolFlag($input['is_default_bank']) : 0;
        $hasBankBranchColumn = ledgersHasBankBranchColumn($pdo);

        // Validate opening_type
        if (!in_array($opening_type, ['Dr', 'Cr'])) {
            ApiResponse::validationError([
                'opening_type' => ['Opening type must be Dr or Cr']
            ]);
        }

        // Validate email if provided
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::validationError([
                'email' => ['Invalid email format']
            ]);
        }

        // Get group details to determine bill_by_bill behavior
        $stmt = $pdo->prepare("SELECT id, name, nature FROM `groups` WHERE id = ? AND status = 'active'");
        $stmt->execute([$group_id]);
        $group = $stmt->fetch();

        if (!$group) {
            ApiResponse::validationError([
                'group_id' => ['Group not found']
            ]);
        }

        // Auto-set bill_by_bill based on group name (Tally logic)
        $bill_by_bill = isset($input['bill_by_bill']) ? (int)$input['bill_by_bill'] : 0;

        // If group is Sundry Debtors or Sundry Creditors, enable bill_by_bill
        if (str_starts_with($group['name'], 'Sundry Debtors') || str_starts_with($group['name'], 'Sundry Creditors')) {
            $bill_by_bill = 1;
        }

        if ($wantsDefaultBank && !isBankGroupName($group['name'])) {
            ApiResponse::validationError([
                'is_default_bank' => ['Default bank can be set only for ledgers in Bank Accounts group']
            ]);
        }

        // GST applicable
        $gst_applicable = isset($input['gst_applicable']) ? (int)$input['gst_applicable'] : 0;

        // Validate GST number if gst_applicable
        if ($gst_applicable && $gst_number) {
            // Basic GST number validation (15 characters)
            if (strlen($gst_number) !== 15) {
                ApiResponse::validationError([
                    'gst_number' => ['GST number must be 15 characters']
                ]);
            }
        }

        // Validate IFSC code if provided (11 characters, starts with 4 letters)
        if ($ifsc_code) {
            if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', strtoupper($ifsc_code))) {
                ApiResponse::validationError([
                    'ifsc_code' => ['Invalid IFSC code format']
                ]);
            }
            $ifsc_code = strtoupper($ifsc_code);
        }

        // Check for duplicate name within same group
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE name = ? AND group_id = ? AND company_id = ? AND status = 'active'");
        $stmt->execute([$name, $group_id, $company_id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Ledger with this name already exists in the same group']
            ]);
        }

        // Insert ledger
        if ($hasBankBranchColumn) {
            $stmt = $pdo->prepare("
                INSERT INTO ledgers
                (company_id, group_id, name, opening_balance, opening_type, bill_by_bill,
                 gst_applicable, gst_number, bank_name, bank_branch, account_number, ifsc_code, address, city, state, pincode, phone, email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $company_id, $group_id, $name, $opening_balance, $opening_type,
                $bill_by_bill, $gst_applicable, $gst_number, $bank_name, $bank_branch, $account_number, $ifsc_code,
                $address, $city, $state, $pincode, $phone, $email
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO ledgers
                (company_id, group_id, name, opening_balance, opening_type, bill_by_bill,
                 gst_applicable, gst_number, bank_name, account_number, ifsc_code, address, city, state, pincode, phone, email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $company_id, $group_id, $name, $opening_balance, $opening_type,
                $bill_by_bill, $gst_applicable, $gst_number, $bank_name, $account_number, $ifsc_code,
                $address, $city, $state, $pincode, $phone, $email
            ]);
        }

        $ledgerId = $pdo->lastInsertId();

        if (ledgersHasDefaultBankColumn($pdo) && isBankGroupName($group['name']) && $wantsDefaultBank) {
            if ($company_id === null || $company_id === '') {
                $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 0 WHERE status = 'active' AND group_id = ? AND company_id IS NULL");
                $stmt->execute([$group_id]);
            } else {
                $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 0 WHERE status = 'active' AND group_id = ? AND company_id = ?");
                $stmt->execute([$group_id, $company_id]);
            }
            $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 1 WHERE id = ?");
            $stmt->execute([$ledgerId]);
        }

        // Get created ledger
        $stmt = $pdo->prepare("
            SELECT
                l.*,
                g.name as group_name,
                g.nature as group_nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ?
        ");
        $stmt->execute([$ledgerId]);
        $ledger = $stmt->fetch();

        // Convert boolean fields
        $ledger['bill_by_bill'] = (bool)$ledger['bill_by_bill'];
        $ledger['gst_applicable'] = (bool)$ledger['gst_applicable'];
        $ledger['is_default_bank'] = (bool)($ledger['is_default_bank'] ?? 0);

        ApiResponse::success($ledger, 'Ledger created successfully', 201);
    }

    // PUT: Update ledger
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Ledger ID is required');
        }

        $id = (int)$input['id'];

        // Check if ledger exists
        $stmt = $pdo->prepare("SELECT * FROM ledgers WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existingLedger = $stmt->fetch();

        if (!$existingLedger) {
            ApiResponse::error('Ledger not found', 404);
        }

        $rules = [
            'name' => 'optional|min:2|max:150',
            'group_id' => 'optional',
            'opening_balance' => 'optional',
            'opening_type' => 'optional',
            'bill_by_bill' => 'optional',
            'gst_applicable' => 'optional',
            'gst_number' => 'optional',
            'bank_name' => 'optional',
            'bank_branch' => 'optional',
            'account_number' => 'optional',
            'ifsc_code' => 'optional',
            'is_default_bank' => 'optional',
            'address' => 'optional',
            'city' => 'optional',
            'state' => 'optional',
            'pincode' => 'optional',
            'phone' => 'optional',
            'email' => 'optional'
        ];

        $errors = Validator::validate($input, $rules);

        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $name = isset($input['name']) ? trim($input['name']) : $existingLedger['name'];
        $group_id = isset($input['group_id']) ? (int)$input['group_id'] : $existingLedger['group_id'];
        $opening_balance = isset($input['opening_balance']) ? floatval($input['opening_balance']) : $existingLedger['opening_balance'];
        $opening_type = $input['opening_type'] ?? $existingLedger['opening_type'];
        $bill_by_bill = isset($input['bill_by_bill']) ? (int)$input['bill_by_bill'] : $existingLedger['bill_by_bill'];
        $gst_applicable = isset($input['gst_applicable']) ? (int)$input['gst_applicable'] : $existingLedger['gst_applicable'];
        $gst_number = array_key_exists('gst_number', $input) ? $input['gst_number'] : $existingLedger['gst_number'];
        $bank_name = array_key_exists('bank_name', $input) ? $input['bank_name'] : $existingLedger['bank_name'];
        $bank_branch = array_key_exists('bank_branch', $input) ? $input['bank_branch'] : ($existingLedger['bank_branch'] ?? null);
        $account_number = array_key_exists('account_number', $input) ? $input['account_number'] : $existingLedger['account_number'];
        $ifsc_code = array_key_exists('ifsc_code', $input) ? $input['ifsc_code'] : $existingLedger['ifsc_code'];
        $hasDefaultBankColumn = ledgersHasDefaultBankColumn($pdo);
        $hasBankBranchColumn = ledgersHasBankBranchColumn($pdo);
        $isDefaultBankProvided = array_key_exists('is_default_bank', $input);
        $isDefaultBank = $isDefaultBankProvided
            ? parseBoolFlag($input['is_default_bank'])
            : (($hasDefaultBankColumn && isset($existingLedger['is_default_bank'])) ? (int)$existingLedger['is_default_bank'] : 0);
        $address = array_key_exists('address', $input) ? $input['address'] : $existingLedger['address'];
        $city = array_key_exists('city', $input) ? $input['city'] : $existingLedger['city'];
        $state = array_key_exists('state', $input) ? $input['state'] : $existingLedger['state'];
        $pincode = array_key_exists('pincode', $input) ? $input['pincode'] : $existingLedger['pincode'];
        $phone = array_key_exists('phone', $input) ? $input['phone'] : $existingLedger['phone'];
        $email = array_key_exists('email', $input) ? $input['email'] : $existingLedger['email'];

        // Validate opening_type
        if (!in_array($opening_type, ['Dr', 'Cr'])) {
            ApiResponse::validationError([
                'opening_type' => ['Opening type must be Dr or Cr']
            ]);
        }

        // Validate email if provided
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::validationError([
                'email' => ['Invalid email format']
            ]);
        }

        // Check if group exists
        $stmt = $pdo->prepare("SELECT id, name FROM `groups` WHERE id = ? AND status = 'active'");
        $stmt->execute([$group_id]);
        $group = $stmt->fetch();

        if (!$group) {
            ApiResponse::validationError([
                'group_id' => ['Group not found']
            ]);
        }

        // Auto-set bill_by_bill for debtor/creditor groups
        if (str_starts_with($group['name'], 'Sundry Debtors') || str_starts_with($group['name'], 'Sundry Creditors')) {
            $bill_by_bill = 1;
        }

        if ($isDefaultBankProvided && $isDefaultBank && !isBankGroupName($group['name'])) {
            ApiResponse::validationError([
                'is_default_bank' => ['Default bank can be set only for ledgers in Bank Accounts group']
            ]);
        }

        // Validate GST number if gst_applicable
        if ($gst_applicable && $gst_number && strlen($gst_number) !== 15) {
            ApiResponse::validationError([
                'gst_number' => ['GST number must be 15 characters']
            ]);
        }

        // Validate IFSC code if provided
        if ($ifsc_code) {
            if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', strtoupper($ifsc_code))) {
                ApiResponse::validationError([
                    'ifsc_code' => ['Invalid IFSC code format']
                ]);
            }
            $ifsc_code = strtoupper($ifsc_code);
        }

        // Check for duplicate name (excluding current ledger)
        $stmt = $pdo->prepare("SELECT id FROM ledgers WHERE name = ? AND group_id = ? AND company_id = ? AND id != ? AND status = 'active'");
        $stmt->execute([$name, $group_id, $existingLedger['company_id'], $id]);
        if ($stmt->fetch()) {
            ApiResponse::validationError([
                'name' => ['Ledger with this name already exists in the same group']
            ]);
        }

        // Update ledger
        if ($hasBankBranchColumn) {
            $stmt = $pdo->prepare("
                UPDATE ledgers
                SET name = ?, group_id = ?, opening_balance = ?, opening_type = ?,
                    bill_by_bill = ?, gst_applicable = ?, gst_number = ?,
                    bank_name = ?, bank_branch = ?, account_number = ?, ifsc_code = ?,
                    address = ?, city = ?, state = ?, pincode = ?, phone = ?, email = ?
                WHERE id = ?
            ");

            $stmt->execute([
                $name, $group_id, $opening_balance, $opening_type,
                $bill_by_bill, $gst_applicable, $gst_number,
                $bank_name, $bank_branch, $account_number, $ifsc_code,
                $address, $city, $state, $pincode, $phone, $email, $id
            ]);
        } else {
            $stmt = $pdo->prepare("
                UPDATE ledgers
                SET name = ?, group_id = ?, opening_balance = ?, opening_type = ?,
                    bill_by_bill = ?, gst_applicable = ?, gst_number = ?,
                    bank_name = ?, account_number = ?, ifsc_code = ?,
                    address = ?, city = ?, state = ?, pincode = ?, phone = ?, email = ?
                WHERE id = ?
            ");

            $stmt->execute([
                $name, $group_id, $opening_balance, $opening_type,
                $bill_by_bill, $gst_applicable, $gst_number,
                $bank_name, $account_number, $ifsc_code,
                $address, $city, $state, $pincode, $phone, $email, $id
            ]);
        }

        if ($hasDefaultBankColumn) {
            if (!isBankGroupName($group['name'])) {
                $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 0 WHERE id = ?");
                $stmt->execute([$id]);
            } elseif ($isDefaultBankProvided) {
                if ($isDefaultBank) {
                    if (empty($existingLedger['company_id'])) {
                        $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 0 WHERE status = 'active' AND group_id = ? AND company_id IS NULL AND id != ?");
                        $stmt->execute([$group_id, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = 0 WHERE status = 'active' AND group_id = ? AND company_id = ? AND id != ?");
                        $stmt->execute([$group_id, $existingLedger['company_id'], $id]);
                    }
                }
                $stmt = $pdo->prepare("UPDATE ledgers SET is_default_bank = ? WHERE id = ?");
                $stmt->execute([$isDefaultBank, $id]);
            }
        }

        // Get updated ledger
        $stmt = $pdo->prepare("
            SELECT
                l.*,
                g.name as group_name,
                g.nature as group_nature
            FROM ledgers l
            INNER JOIN `groups` g ON l.group_id = g.id
            WHERE l.id = ?
        ");
        $stmt->execute([$id]);
        $ledger = $stmt->fetch();

        // Convert boolean fields
        $ledger['bill_by_bill'] = (bool)$ledger['bill_by_bill'];
        $ledger['gst_applicable'] = (bool)$ledger['gst_applicable'];
        $ledger['is_default_bank'] = (bool)($ledger['is_default_bank'] ?? 0);

        ApiResponse::success($ledger, 'Ledger updated successfully');
    }

    // DELETE: Delete ledger
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Ledger ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        // Check if ledger exists
        $stmt = $pdo->prepare("SELECT * FROM ledgers WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $ledger = $stmt->fetch();

        if (!$ledger) {
            ApiResponse::error('Ledger not found', 404);
        }

        // TODO: Check if ledger has transactions before deleting
        // For now, we'll do soft delete

        // Soft delete (set status to inactive)
        $stmt = $pdo->prepare("UPDATE ledgers SET status = 'inactive' WHERE id = ?");
        $stmt->execute([$id]);

        ApiResponse::success(null, 'Ledger deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Ledgers API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Ledgers API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
