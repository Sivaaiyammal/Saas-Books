<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../helpers/apiResponse.php';
require_once __DIR__ . '/../../middleware/auth.php';

// Authenticate user
$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Ledger Statement
    if ($method === 'GET') {
        if (!isset($_GET['ledger_id'])) {
            ApiResponse::error('Ledger ID is required', 400);
        }

        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;

        $ledger_id = (int)$_GET['ledger_id'];
        $from_date = $_GET['from_date'] ?? null;
        $to_date = $_GET['to_date'] ?? null;
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        $offset = ($page - 1) * $limit;

        // Get ledger details with opening balance
        if ($company_id > 0) {
            $stmt = $pdo->prepare("
                SELECT
                    l.*, 
                    g.name as group_name,
                    g.nature as group_nature
                FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE l.id = ? AND l.company_id = ? AND l.status = 'active'
            ");
            $stmt->execute([$ledger_id, $company_id]);
        } else {
            $stmt = $pdo->prepare("
                SELECT
                    l.*, 
                    g.name as group_name,
                    g.nature as group_nature
                FROM ledgers l
                INNER JOIN `groups` g ON l.group_id = g.id
                WHERE l.id = ? AND l.status = 'active'
            ");
            $stmt->execute([$ledger_id]);
        }
        $ledger = $stmt->fetch();

        if (!$ledger) {
            ApiResponse::error('Ledger not found', 404);
        }

        // Build date filter
        $dateFilter = "";
        $effective_company_id = $company_id > 0 ? $company_id : (int)($ledger['company_id'] ?? 0);
        $params = [$ledger_id, $effective_company_id];

        if ($from_date) {
            $dateFilter .= " AND v.voucher_date >= ?";
            $params[] = $from_date;
        }

        if ($to_date) {
            $dateFilter .= " AND v.voucher_date <= ?";
            $params[] = $to_date;
        }

        // Get all ledger entries:
        // 1) explicit voucher_entries rows
        // 2) synthetic rows from vouchers.party_ledger_id when explicit entry is missing
        $query = "
            SELECT *
            FROM (
                SELECT
                    ve.id,
                    ve.amount,
                    ve.dr_cr,
                    ve.bill_reference,
                    ve.description,
                    v.id as voucher_id,
                    v.voucher_type,
                    v.voucher_no,
                    v.voucher_date,
                    v.reference_no,
                    v.narration,
                    v.party_ledger_id,
                    party_ledger.name as party_name
                FROM voucher_entries ve
                INNER JOIN vouchers v ON ve.voucher_id = v.id
                LEFT JOIN ledgers party_ledger ON v.party_ledger_id = party_ledger.id
                WHERE ve.ledger_id = ?
                AND v.company_id = ?
                AND v.status = 'posted'
                {$dateFilter}

                UNION ALL

                SELECT
                    (-1 * v.id) as id,
                    v.total_amount as amount,
                    CASE
                        WHEN v.voucher_type IN ('Sales', 'Quotation') THEN 'Dr'
                        WHEN v.voucher_type = 'Receipt' THEN 'Cr'
                        WHEN v.voucher_type = 'Purchase' THEN 'Cr'
                        WHEN v.voucher_type = 'Payment' THEN 'Dr'
                        ELSE 'Dr'
                    END as dr_cr,
                    NULL as bill_reference,
                    v.narration as description,
                    v.id as voucher_id,
                    v.voucher_type,
                    v.voucher_no,
                    v.voucher_date,
                    v.reference_no,
                    v.narration,
                    v.party_ledger_id,
                    party_ledger.name as party_name
                FROM vouchers v
                LEFT JOIN voucher_entries existing_ve ON existing_ve.voucher_id = v.id AND existing_ve.ledger_id = ?
                LEFT JOIN ledgers party_ledger ON v.party_ledger_id = party_ledger.id
                WHERE v.party_ledger_id = ?
                AND v.company_id = ?
                AND v.status = 'posted'
                AND existing_ve.id IS NULL
                {$dateFilter}
            ) ledger_rows
            ORDER BY voucher_date ASC, voucher_id ASC, id ASC
        ";

        // Get total count
        $countQuery = "
            SELECT COUNT(*)
            FROM (
                SELECT ve.id
                FROM voucher_entries ve
                INNER JOIN vouchers v ON ve.voucher_id = v.id
                WHERE ve.ledger_id = ?
                AND v.company_id = ?
                AND v.status = 'posted'
                {$dateFilter}

                UNION ALL

                SELECT (-1 * v.id) as id
                FROM vouchers v
                LEFT JOIN voucher_entries existing_ve ON existing_ve.voucher_id = v.id AND existing_ve.ledger_id = ?
                WHERE v.party_ledger_id = ?
                AND v.company_id = ?
                AND v.status = 'posted'
                AND existing_ve.id IS NULL
                {$dateFilter}
            ) t
        ";
        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute([
            ...$params,
            $ledger_id,
            $ledger_id,
            $effective_company_id,
            ...array_slice($params, 2)
        ]);
        $total = $countStmt->fetchColumn();

        // Get entries with pagination
        $stmt = $pdo->prepare($query . " LIMIT ? OFFSET ?");
        $stmt->execute([
            ...$params,
            $ledger_id,
            $ledger_id,
            $effective_company_id,
            ...array_slice($params, 2),
            $limit,
            $offset
        ]);
        $entries = $stmt->fetchAll();

        // Calculate opening balance
        $opening_balance = floatval($ledger['opening_balance']);
        $opening_type = $ledger['opening_type']; // Dr or Cr

        // If from_date is provided, calculate balance before from_date
        if ($from_date) {
            $preBalanceQuery = "
                SELECT
                    SUM(CASE WHEN t.dr_cr = 'Dr' THEN t.amount ELSE 0 END) as total_dr,
                    SUM(CASE WHEN t.dr_cr = 'Cr' THEN t.amount ELSE 0 END) as total_cr
                FROM (
                    SELECT ve.amount, ve.dr_cr
                    FROM voucher_entries ve
                    INNER JOIN vouchers v ON ve.voucher_id = v.id
                    WHERE ve.ledger_id = ?
                    AND v.company_id = ?
                    AND v.status = 'posted'
                    AND v.voucher_date < ?

                    UNION ALL

                    SELECT
                        v.total_amount as amount,
                        CASE
                            WHEN v.voucher_type IN ('Sales', 'Quotation') THEN 'Dr'
                            WHEN v.voucher_type = 'Receipt' THEN 'Cr'
                            WHEN v.voucher_type = 'Purchase' THEN 'Cr'
                            WHEN v.voucher_type = 'Payment' THEN 'Dr'
                            ELSE 'Dr'
                        END as dr_cr
                    FROM vouchers v
                    LEFT JOIN voucher_entries existing_ve ON existing_ve.voucher_id = v.id AND existing_ve.ledger_id = ?
                    WHERE v.party_ledger_id = ?
                    AND v.company_id = ?
                    AND v.status = 'posted'
                    AND v.voucher_date < ?
                    AND existing_ve.id IS NULL
                ) t
            ";
            $stmt = $pdo->prepare($preBalanceQuery);
            $stmt->execute([$ledger_id, $effective_company_id, $from_date, $ledger_id, $ledger_id, $effective_company_id, $from_date]);
            $preBalance = $stmt->fetch();

            $total_dr = floatval($preBalance['total_dr'] ?? 0);
            $total_cr = floatval($preBalance['total_cr'] ?? 0);

            // Add opening balance to the calculation
            if ($opening_type === 'Dr') {
                $total_dr += $opening_balance;
            } else {
                $total_cr += $opening_balance;
            }

            // Calculate net opening for from_date
            if ($total_dr > $total_cr) {
                $opening_balance = $total_dr - $total_cr;
                $opening_type = 'Dr';
            } else if ($total_cr > $total_dr) {
                $opening_balance = $total_cr - $total_dr;
                $opening_type = 'Cr';
            } else {
                $opening_balance = 0;
                $opening_type = 'Dr';
            }
        }

        // Process entries and calculate running balance
        $running_dr = ($opening_type === 'Dr') ? $opening_balance : 0;
        $running_cr = ($opening_type === 'Cr') ? $opening_balance : 0;

        $statement_entries = [];
        foreach ($entries as $entry) {
            $amount = floatval($entry['amount']);

            if ($entry['dr_cr'] === 'Dr') {
                $running_dr += $amount;
            } else {
                $running_cr += $amount;
            }

            // Calculate balance
            if ($running_dr > $running_cr) {
                $balance = $running_dr - $running_cr;
                $balance_type = 'Dr';
            } else if ($running_cr > $running_dr) {
                $balance = $running_cr - $running_dr;
                $balance_type = 'Cr';
            } else {
                $balance = 0;
                $balance_type = 'Dr';
            }

            $statement_entries[] = [
                'id' => (int)$entry['id'],
                'voucher_id' => (int)$entry['voucher_id'],
                'voucher_type' => $entry['voucher_type'],
                'voucher_no' => $entry['voucher_no'],
                'voucher_date' => $entry['voucher_date'],
                'reference_no' => $entry['reference_no'],
                'party_name' => $entry['party_name'],
                'bill_reference' => $entry['bill_reference'],
                'description' => $entry['description'] ?: $entry['narration'],
                'debit' => $entry['dr_cr'] === 'Dr' ? round($amount, 2) : 0,
                'credit' => $entry['dr_cr'] === 'Cr' ? round($amount, 2) : 0,
                'balance' => round($balance, 2),
                'balance_type' => $balance_type
            ];
        }

        // Calculate closing balance
        $closing_balance = 0;
        $closing_type = 'Dr';

        if (!empty($statement_entries)) {
            $lastEntry = end($statement_entries);
            $closing_balance = $lastEntry['balance'];
            $closing_type = $lastEntry['balance_type'];
        } else {
            $closing_balance = $opening_balance;
            $closing_type = $opening_type;
        }

        // Calculate total debit and credit
        $total_debit = array_sum(array_column($statement_entries, 'debit'));
        $total_credit = array_sum(array_column($statement_entries, 'credit'));

        ApiResponse::success([
            'ledger' => [
                'id' => (int)$ledger['id'],
                'name' => $ledger['name'],
                'group_name' => $ledger['group_name'],
                'group_nature' => $ledger['group_nature'],
                'address' => $ledger['address'],
                'phone' => $ledger['phone'],
                'email' => $ledger['email'],
                'gst_number' => $ledger['gst_number']
            ],
            'statement' => [
                'opening_balance' => round($opening_balance, 2),
                'opening_type' => $opening_type,
                'entries' => $statement_entries,
                'closing_balance' => round($closing_balance, 2),
                'closing_type' => $closing_type,
                'total_debit' => round($total_debit, 2),
                'total_credit' => round($total_credit, 2)
            ],
            'filters' => [
                'company_id' => $effective_company_id,
                'from_date' => $from_date,
                'to_date' => $to_date
            ],
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Ledger statement retrieved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Ledger Statement API error: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Ledger Statement API exception: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
