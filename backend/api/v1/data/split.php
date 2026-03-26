<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

// ── Helpers ──────────────────────────────────────────────────────────────────

function insertRow(PDO $pdo, string $table, array $row): int
{
    $cols = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
    $ph   = implode(', ', array_fill(0, count($row), '?'));
    $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($ph)")->execute(array_values($row));
    return (int)$pdo->lastInsertId();
}

/** Returns the remapped ID, or the original if not in map (global/system record). */
function remap(array $map, ?int $id): ?int
{
    if ($id === null) return null;
    return $map[$id] ?? $id;
}

/**
 * Clone all masters (groups, ledgers, items, units, taxes, godowns, financial_years)
 * from source company to destination company.
 *
 * Returns ID-mapping arrays for use when cloning vouchers.
 */
function cloneMasters(PDO $pdo, int $srcId, int $dstId): array
{
    $maps = [
        'groups'   => [],
        'ledgers'  => [],
        'items'    => [],
        'units'    => [],
        'taxes'    => [],
        'godowns'  => [],
    ];

    // ── 1. Groups (two-pass to handle parent_id self-reference) ──────────────
    $rows = $pdo->prepare("SELECT * FROM `groups` WHERE company_id = ? ORDER BY id ASC");
    $rows->execute([$srcId]);
    $groups = $rows->fetchAll(PDO::FETCH_ASSOC);

    foreach ($groups as $g) {
        $newRow = $g;
        unset($newRow['id']);
        $newRow['company_id'] = $dstId;
        $newRow['parent_id']  = null;           // set after all are inserted
        $newRow['created_at'] = date('Y-m-d H:i:s');
        $newRow['updated_at'] = date('Y-m-d H:i:s');
        $maps['groups'][$g['id']] = insertRow($pdo, 'groups', $newRow);
    }

    // Second pass: update parent_id using the map
    foreach ($groups as $g) {
        if ($g['parent_id'] !== null) {
            $newParent = remap($maps['groups'], $g['parent_id']);
            $pdo->prepare("UPDATE `groups` SET parent_id = ? WHERE id = ?")
                ->execute([$newParent, $maps['groups'][$g['id']]]);
        }
    }

    // ── 2. Ledgers ────────────────────────────────────────────────────────────
    $rows = $pdo->prepare("SELECT * FROM ledgers WHERE company_id = ? ORDER BY id ASC");
    $rows->execute([$srcId]);
    foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $l) {
        $newRow = $l;
        unset($newRow['id']);
        $newRow['company_id'] = $dstId;
        $newRow['group_id']   = remap($maps['groups'], $l['group_id']);
        $newRow['created_at'] = date('Y-m-d H:i:s');
        $newRow['updated_at'] = date('Y-m-d H:i:s');
        $maps['ledgers'][$l['id']] = insertRow($pdo, 'ledgers', $newRow);
    }

    // ── 3. Units ──────────────────────────────────────────────────────────────
    try {
        $rows = $pdo->prepare("SELECT * FROM units WHERE company_id <=> ? ORDER BY id ASC");
        $rows->execute([$srcId]);
        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $u) {
            $newRow = $u;
            unset($newRow['id']);
            $newRow['company_id'] = $dstId;
            $maps['units'][$u['id']] = insertRow($pdo, 'units', $newRow);
        }
    } catch (PDOException $e) { /* skip if table missing */ }

    // ── 4. Taxes ──────────────────────────────────────────────────────────────
    try {
        $rows = $pdo->prepare("SELECT * FROM taxes WHERE company_id <=> ? ORDER BY id ASC");
        $rows->execute([$srcId]);
        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $t) {
            $newRow = $t;
            unset($newRow['id']);
            $newRow['company_id'] = $dstId;
            $maps['taxes'][$t['id']] = insertRow($pdo, 'taxes', $newRow);
        }
    } catch (PDOException $e) { /* skip if table missing */ }

    // ── 5. Godowns ────────────────────────────────────────────────────────────
    try {
        $rows = $pdo->prepare("SELECT * FROM godowns WHERE company_id <=> ? ORDER BY id ASC");
        $rows->execute([$srcId]);
        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $g) {
            $newRow = $g;
            unset($newRow['id']);
            $newRow['company_id'] = $dstId;
            $maps['godowns'][$g['id']] = insertRow($pdo, 'godowns', $newRow);
        }
    } catch (PDOException $e) { /* skip if table missing */ }

    // ── 6. Items (stock items) ─────────────────────────────────────────────────
    try {
        $rows = $pdo->prepare("SELECT * FROM items WHERE company_id <=> ? ORDER BY id ASC");
        $rows->execute([$srcId]);
        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $item) {
            $newRow = $item;
            unset($newRow['id']);
            $newRow['company_id'] = $dstId;
            $maps['items'][$item['id']] = insertRow($pdo, 'items', $newRow);
        }
    } catch (PDOException $e) {
        // table may not exist in this deployment
    }

    // ── 7. Financial Years ────────────────────────────────────────────────────
    $rows = $pdo->prepare("SELECT * FROM financial_years WHERE company_id <=> ? ORDER BY start_date ASC");
    $rows->execute([$srcId]);
    foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $fy) {
        $newRow = $fy;
        unset($newRow['id']);
        $newRow['company_id'] = $dstId;
        $newRow['is_current']  = 0;
        $newRow['created_at']  = date('Y-m-d H:i:s');
        $newRow['updated_at']  = date('Y-m-d H:i:s');
        try {
            insertRow($pdo, 'financial_years', $newRow);
        } catch (PDOException $e) {
            // ignore duplicate code for company
        }
    }

    return $maps;
}

/**
 * Clone posted vouchers within the given date condition into the destination company.
 * $dateWhere should be something like "AND v.voucher_date < ?" with corresponding $dateParam.
 *
 * Returns maps: ['vouchers' => [...], 'voucher_entries' => [...]]
 */
function cloneVouchers(
    PDO    $pdo,
    int    $srcId,
    int    $dstId,
    array  $maps,
    string $dateWhere,
    array  $dateParams
): array {
    $voucherMap = [];
    $entryMap   = [];

    // ── Vouchers ──────────────────────────────────────────────────────────────
    $sql = "SELECT v.* FROM vouchers v
            WHERE v.company_id = ? AND v.status != 'cancelled' $dateWhere
            ORDER BY v.voucher_date ASC, v.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge([$srcId], $dateParams));
    $vouchers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Pre-build: old financial_year_id → new financial_year_id (avoids per-voucher query)
    $fyIdMap = [];
    $srcFyStmt = $pdo->prepare("SELECT id, code FROM financial_years WHERE company_id <=> ? OR company_id = ?");
    $srcFyStmt->execute([$srcId, $srcId]);
    $srcFyRows = $srcFyStmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($srcFyRows)) {
        $dstFyStmt = $pdo->prepare("SELECT id, code FROM financial_years WHERE company_id = ?");
        $dstFyStmt->execute([$dstId]);
        $dstFyByCode = [];
        foreach ($dstFyStmt->fetchAll(PDO::FETCH_ASSOC) as $fy) {
            $dstFyByCode[$fy['code']] = $fy['id'];
        }
        foreach ($srcFyRows as $fy) {
            if (isset($dstFyByCode[$fy['code']])) {
                $fyIdMap[$fy['id']] = $dstFyByCode[$fy['code']];
            }
        }
    }

    foreach ($vouchers as $v) {
        $newRow = $v;
        unset($newRow['id']);
        $newRow['company_id']        = $dstId;
        $newRow['party_ledger_id']   = remap($maps['ledgers'], $v['party_ledger_id']);
        $newRow['financial_year_id'] = $fyIdMap[$v['financial_year_id']] ?? null;
        // Cross-period order/delivery_note links may not exist in the new company
        $newRow['order_id']          = null;
        $newRow['delivery_note_id']  = null;
        $newRow['created_at']        = date('Y-m-d H:i:s');
        $newRow['updated_at']        = date('Y-m-d H:i:s');

        $voucherMap[$v['id']] = insertRow($pdo, 'vouchers', $newRow);
    }

    if (empty($voucherMap)) {
        return ['vouchers' => $voucherMap, 'voucher_entries' => $entryMap];
    }

    $oldVoucherIds = array_keys($voucherMap);
    $ph = implode(',', array_fill(0, count($oldVoucherIds), '?'));

    // ── Voucher Items ─────────────────────────────────────────────────────────
    $stmt = $pdo->prepare("SELECT * FROM voucher_items WHERE voucher_id IN ($ph)");
    $stmt->execute($oldVoucherIds);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $newRow = $item;
        unset($newRow['id']);
        $newRow['voucher_id']    = $voucherMap[$item['voucher_id']];
        $newRow['product_id']    = remap($maps['items'],   $item['product_id']);
        $newRow['unit_id']       = remap($maps['units'],   $item['unit_id']);
        $newRow['tax_id']        = remap($maps['taxes'],   $item['tax_id']);
        $newRow['godown_id']     = remap($maps['godowns'], $item['godown_id']);
        $newRow['order_item_id'] = null; // cross-company order links are not valid after split
        insertRow($pdo, 'voucher_items', $newRow);
    }

    // ── Voucher Entries (double-entry) ────────────────────────────────────────
    $stmt = $pdo->prepare("SELECT * FROM voucher_entries WHERE voucher_id IN ($ph)");
    $stmt->execute($oldVoucherIds);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $entry) {
        $newRow = $entry;
        unset($newRow['id']);
        $newRow['voucher_id'] = $voucherMap[$entry['voucher_id']];
        $newRow['ledger_id']  = remap($maps['ledgers'], $entry['ledger_id']);
        $newRow['created_at'] = date('Y-m-d H:i:s');
        $entryMap[$entry['id']] = insertRow($pdo, 'voucher_entries', $newRow);
    }

    // ── Bill Allocations ──────────────────────────────────────────────────────
    if (!empty($entryMap)) {
        $oldEntryIds = array_keys($entryMap);
        $eph = implode(',', array_fill(0, count($oldEntryIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM bill_allocations WHERE voucher_entry_id IN ($eph)");
        $stmt->execute($oldEntryIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $ba) {
            $newRow = $ba;
            unset($newRow['id']);
            $newRow['ledger_id']            = remap($maps['ledgers'], $ba['ledger_id']);
            $newRow['voucher_entry_id']      = $entryMap[$ba['voucher_entry_id']];
            $newRow['reference_voucher_id']  = isset($voucherMap[$ba['reference_voucher_id']])
                ? $voucherMap[$ba['reference_voucher_id']]
                : null;
            try {
                insertRow($pdo, 'bill_allocations', $newRow);
            } catch (PDOException $e) {
                // skip if constraint fails
            }
        }
    }

    return ['vouchers' => $voucherMap, 'voucher_entries' => $entryMap];
}

/**
 * Calculate each ledger's closing balance as of split_date (exclusive)
 * and update opening_balance / opening_type on the cloned ledgers in Company B.
 *
 * Returns count of ledgers whose opening balance was set.
 */
function applyOpeningBalances(
    PDO    $pdo,
    int    $srcId,
    string $splitDate,
    array  $ledgerIdMap
): int {
    $stmt = $pdo->prepare("
        SELECT
            l.id,
            l.opening_balance,
            l.opening_type,
            COALESCE(SUM(CASE WHEN ve.dr_cr = 'Dr' AND v.voucher_date < :sd1 THEN ve.amount ELSE 0 END), 0) AS sum_dr,
            COALESCE(SUM(CASE WHEN ve.dr_cr = 'Cr' AND v.voucher_date < :sd2 THEN ve.amount ELSE 0 END), 0) AS sum_cr
        FROM ledgers l
        LEFT JOIN voucher_entries ve ON ve.ledger_id = l.id
        LEFT JOIN vouchers v
               ON v.id = ve.voucher_id
              AND v.company_id = :cid
              AND v.status = 'posted'
        WHERE l.company_id = :cid2
        GROUP BY l.id, l.opening_balance, l.opening_type
    ");
    $stmt->execute([
        ':sd1'  => $splitDate,
        ':sd2'  => $splitDate,
        ':cid'  => $srcId,
        ':cid2' => $srcId,
    ]);

    $updated = 0;
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $newLedgerId = $ledgerIdMap[$row['id']] ?? null;
        if (!$newLedgerId) continue;

        $openDr = $row['opening_type'] === 'Dr' ? (float)$row['opening_balance'] : 0;
        $openCr = $row['opening_type'] === 'Cr' ? (float)$row['opening_balance'] : 0;

        $netDr = $openDr + (float)$row['sum_dr'];
        $netCr = $openCr + (float)$row['sum_cr'];

        $closing = $netDr - $netCr;
        $closingAmt  = abs($closing);
        $closingType = $closing >= 0 ? 'Dr' : 'Cr';

        $pdo->prepare("UPDATE ledgers SET opening_balance = ?, opening_type = ? WHERE id = ?")
            ->execute([round($closingAmt, 2), $closingType, $newLedgerId]);
        $updated++;
    }

    return $updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? ($_POST['action'] ?? '');

    // ── GET: Pre-Split Verification ───────────────────────────────────────────
    if ($method === 'GET' && $action === 'verify') {
        $splitDate = $_GET['split_date'] ?? null;
        if (!$splitDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $splitDate)) {
            ApiResponse::validationError(['split_date' => ['A valid split date (YYYY-MM-DD) is required']]);
        }

        $checks = [];

        // 1. Draft vouchers before split
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM vouchers WHERE company_id = ? AND status = 'draft' AND voucher_date < ?"
        );
        $stmt->execute([$companyId, $splitDate]);
        $draftCount = (int)$stmt->fetchColumn();
        if ($draftCount > 0) {
            $checks[] = [
                'type'    => 'warning',
                'code'    => 'draft_vouchers',
                'count'   => $draftCount,
                'message' => "$draftCount draft voucher(s) exist before the split date. Post or cancel them before splitting.",
            ];
        }

        // 2. Pending (outstanding) bills crossing the split boundary
        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(DISTINCT ba.id)
                FROM bill_allocations ba
                JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                JOIN vouchers v ON ve.voucher_id = v.id
                WHERE v.company_id = ? AND v.voucher_date < ? AND ba.pending_amount > 0.00 AND v.status = 'posted'
            ");
            $stmt->execute([$companyId, $splitDate]);
            $pendingBills = (int)$stmt->fetchColumn();
            if ($pendingBills > 0) {
                $checks[] = [
                    'type'    => 'warning',
                    'code'    => 'pending_bills',
                    'count'   => $pendingBills,
                    'message' => "$pendingBills outstanding bill(s) with pending amounts will cross the split boundary. Their closing balances will be injected as opening balance in Company B.",
                ];
            }
        } catch (PDOException $e) { /* bill_allocations not used */ }

        // 3. Open sales/purchase orders before split
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM vouchers
            WHERE company_id = ? AND voucher_type IN ('Sales Order','Purchase Order')
              AND status = 'posted' AND voucher_date < ?
        ");
        $stmt->execute([$companyId, $splitDate]);
        $openOrders = (int)$stmt->fetchColumn();
        if ($openOrders > 0) {
            $checks[] = [
                'type'    => 'warning',
                'code'    => 'open_orders',
                'count'   => $openOrders,
                'message' => "$openOrders sales/purchase order(s) before the split date may not be fully billed. Cross-period order links will be cleared after the split.",
            ];
        }

        // 4. Trial balance check (Dr = Cr in voucher_entries)
        try {
            $stmt = $pdo->prepare("
                SELECT
                    COALESCE(SUM(CASE WHEN ve.dr_cr = 'Dr' THEN ve.amount ELSE 0 END), 0) AS total_dr,
                    COALESCE(SUM(CASE WHEN ve.dr_cr = 'Cr' THEN ve.amount ELSE 0 END), 0) AS total_cr
                FROM voucher_entries ve
                JOIN vouchers v ON ve.voucher_id = v.id
                WHERE v.company_id = ? AND v.status = 'posted'
            ");
            $stmt->execute([$companyId]);
            $tb   = $stmt->fetch(PDO::FETCH_ASSOC);
            $diff = abs((float)$tb['total_dr'] - (float)$tb['total_cr']);
            if ($diff > 0.01) {
                // Find vouchers that have missing or incomplete voucher_entries
                $mismatchStmt = $pdo->prepare("
                    SELECT v.voucher_no, v.voucher_type, v.voucher_date, v.total_amount,
                           COALESCE(SUM(CASE WHEN ve.dr_cr = 'Dr' THEN ve.amount ELSE 0 END), 0) AS entry_dr,
                           COALESCE(SUM(CASE WHEN ve.dr_cr = 'Cr' THEN ve.amount ELSE 0 END), 0) AS entry_cr
                    FROM vouchers v
                    LEFT JOIN voucher_entries ve ON ve.voucher_id = v.id
                    WHERE v.company_id = ? AND v.status = 'posted'
                    GROUP BY v.id, v.voucher_no, v.voucher_type, v.voucher_date, v.total_amount
                    HAVING ABS(entry_dr - entry_cr) > 0.01 OR (entry_dr = 0 AND entry_cr = 0)
                    ORDER BY v.voucher_date DESC
                    LIMIT 5
                ");
                $mismatchStmt->execute([$companyId]);
                $mismatchVouchers = $mismatchStmt->fetchAll(PDO::FETCH_ASSOC);

                $checks[] = [
                    'type'             => 'warning',
                    'code'             => 'trial_balance_mismatch',
                    'count'            => 0,
                    'message'          => "Trial balance difference: ₹" . number_format($diff, 2) . ". This is usually caused by vouchers created before the double-entry system was enabled. Opening balances will still be calculated correctly per ledger.",
                    'affected_vouchers'=> $mismatchVouchers,
                ];
            } else {
                $checks[] = [
                    'type'    => 'ok',
                    'code'    => 'trial_balance_ok',
                    'count'   => 0,
                    'message' => "Trial balance is balanced — debits equal credits.",
                ];
            }
        } catch (PDOException $e) { /* voucher_entries not populated */ }

        // Summary counts
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM vouchers WHERE company_id = ? AND status != 'cancelled' AND voucher_date < ?");
        $stmt->execute([$companyId, $splitDate]);
        $beforeCount = (int)$stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM vouchers WHERE company_id = ? AND status != 'cancelled' AND voucher_date >= ?");
        $stmt->execute([$companyId, $splitDate]);
        $fromCount = (int)$stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM ledgers WHERE company_id = ?");
        $stmt->execute([$companyId]);
        $ledgerCount = (int)$stmt->fetchColumn();

        $hasErrors = !empty(array_filter($checks, fn($c) => $c['type'] === 'error'));

        ApiResponse::success([
            'checks'       => $checks,
            'can_proceed'  => !$hasErrors,
            'summary'      => [
                'vouchers_before_split' => $beforeCount,
                'vouchers_from_split'   => $fromCount,
                'total_ledgers'         => $ledgerCount,
            ],
        ], 'Verification complete');
    }

    // ── POST: Execute Split ───────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON input', 400);
        }

        $action = $input['action'] ?? '';

        if ($action !== 'execute') {
            ApiResponse::error('Unknown action', 400);
        }

        $splitDate   = $input['split_date']    ?? null;
        $companyAName = trim($input['company_a_name'] ?? '');
        $companyACode = trim($input['company_a_code'] ?? '');
        $companyBName = trim($input['company_b_name'] ?? '');
        $companyBCode = trim($input['company_b_code'] ?? '');

        $errors = [];
        if (!$splitDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $splitDate)) {
            $errors['split_date'] = ['A valid split date is required'];
        }
        if (!$companyAName) $errors['company_a_name'] = ['Company A name is required'];
        if (!$companyACode) $errors['company_a_code'] = ['Company A code is required'];
        if (!$companyBName) $errors['company_b_name'] = ['Company B name is required'];
        if (!$companyBCode) $errors['company_b_code'] = ['Company B code is required'];
        if (!empty($errors)) ApiResponse::validationError($errors);

        // Fetch original company details for cloning metadata
        $srcStmt = $pdo->prepare("SELECT * FROM companies WHERE id = ? LIMIT 1");
        $srcStmt->execute([$companyId]);
        $srcCompany = $srcStmt->fetch(PDO::FETCH_ASSOC);
        if (!$srcCompany) {
            ApiResponse::error('Source company not found', 404);
        }

        // Allow up to 5 minutes for large datasets
        set_time_limit(300);

        $pdo->beginTransaction();
        try {
            $now = date('Y-m-d H:i:s');

            // ── Step 1: Create Company A (pre-split) ──────────────────────────
            $pdo->prepare(
                "INSERT INTO companies (code, name, email, phone, gstin, address, city, state, pincode, country, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)"
            )->execute([
                $companyACode, $companyAName,
                $srcCompany['email'], $srcCompany['phone'], $srcCompany['gstin'],
                $srcCompany['address'], $srcCompany['city'], $srcCompany['state'],
                $srcCompany['pincode'], $srcCompany['country'],
                $now, $now,
            ]);
            $companyAId = (int)$pdo->lastInsertId();

            // ── Step 2: Create Company B (post-split) ─────────────────────────
            $pdo->prepare(
                "INSERT INTO companies (code, name, email, phone, gstin, address, city, state, pincode, country, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)"
            )->execute([
                $companyBCode, $companyBName,
                $srcCompany['email'], $srcCompany['phone'], $srcCompany['gstin'],
                $srcCompany['address'], $srcCompany['city'], $srcCompany['state'],
                $srcCompany['pincode'], $srcCompany['country'],
                $now, $now,
            ]);
            $companyBId = (int)$pdo->lastInsertId();

            // ── Step 3: Clone masters to Company A ───────────────────────────
            $mapsA = cloneMasters($pdo, $companyId, $companyAId);

            // ── Step 4: Clone masters to Company B ───────────────────────────
            $mapsB = cloneMasters($pdo, $companyId, $companyBId);

            // ── Step 5: Calculate & apply opening balances to Company B ───────
            $obCount = applyOpeningBalances($pdo, $companyId, $splitDate, $mapsB['ledgers']);

            // ── Step 6: Clone pre-split vouchers to Company A ─────────────────
            $resA = cloneVouchers(
                $pdo, $companyId, $companyAId, $mapsA,
                "AND v.voucher_date < ?", [$splitDate]
            );

            // ── Step 7: Clone post-split vouchers to Company B ────────────────
            $resB = cloneVouchers(
                $pdo, $companyId, $companyBId, $mapsB,
                "AND v.voucher_date >= ?", [$splitDate]
            );

            // ── Step 8: Link current user to both new companies ───────────────
            foreach ([$companyAId, $companyBId] as $cid) {
                $pdo->prepare(
                    "INSERT IGNORE INTO company_users (company_id, user_id, role, is_default, status, created_at, updated_at)
                     VALUES (?, ?, 'owner', 0, 'active', ?, ?)"
                )->execute([$cid, $user['id'], $now, $now]);
            }

            $pdo->commit();

            ApiResponse::success([
                'company_a' => [
                    'id'            => $companyAId,
                    'name'          => $companyAName,
                    'code'          => $companyACode,
                    'voucher_count' => count($resA['vouchers']),
                    'period'        => "Up to " . date('d M Y', strtotime($splitDate . ' -1 day')),
                ],
                'company_b' => [
                    'id'            => $companyBId,
                    'name'          => $companyBName,
                    'code'          => $companyBCode,
                    'voucher_count' => count($resB['vouchers']),
                    'period'        => "From " . date('d M Y', strtotime($splitDate)),
                ],
                'opening_balances_set' => $obCount,
                'split_date'           => $splitDate,
            ], 'Company split completed successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (Exception $e) {
    error_log("Split API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
