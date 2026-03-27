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
 * Copy all stock_movement records from source items into the destination company's
 * cloned items (Company A — full history preserved).
 */
function cloneStockMovements(PDO $pdo, array $itemIdMap): int
{
    if (empty($itemIdMap)) return 0;

    $oldIds = array_keys($itemIdMap);
    $ph = implode(',', array_fill(0, count($oldIds), '?'));

    try {
        $stmt = $pdo->prepare("
            SELECT product_id, quantity, type, reference, user_id, notes, created_at
            FROM stock_movement
            WHERE product_id IN ($ph)
            ORDER BY created_at ASC
        ");
        $stmt->execute($oldIds);
        $moved = 0;
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $sm) {
            $newId = $itemIdMap[$sm['product_id']] ?? null;
            if (!$newId) continue;
            $pdo->prepare("
                INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ")->execute([$newId, $sm['quantity'], $sm['type'], $sm['reference'], $sm['user_id'], $sm['notes'], $sm['created_at']]);
            $moved++;
        }
        return $moved;
    } catch (PDOException $e) {
        return 0; // stock_movement table may not exist in this deployment
    }
}

/**
 * Calculate closing stock per item as of split_date (exclusive) and set it as
 * the opening stock in Company B's cloned items.
 *
 * - Uses voucher_items + voucher_date for date-accurate calculation
 * - Inserts one stock_movement 'Opening' record per item in Company B
 * - Does NOT copy historical purchase/sales movements (Company B shows no history)
 *
 * Returns count of items updated.
 */
function applyOpeningStock(PDO $pdo, int $srcId, string $splitDate, array $itemIdMap): int
{
    if (empty($itemIdMap)) return 0;

    $oldIds = array_keys($itemIdMap);
    $ph = implode(',', array_fill(0, count($oldIds), '?'));

    try {
        // Original opening qty: SUM of 'Opening' type records in stock_movement
        $openStmt = $pdo->prepare("
            SELECT product_id, COALESCE(SUM(quantity), 0) AS opening_qty
            FROM stock_movement
            WHERE product_id IN ($ph) AND type = 'Opening'
            GROUP BY product_id
        ");
        $openStmt->execute($oldIds);
        $openingQtyMap = array_column($openStmt->fetchAll(PDO::FETCH_ASSOC), 'opening_qty', 'product_id');

        // Net stock movements before split_date (date-accurate via voucher_date)
        $mvtStmt = $pdo->prepare("
            SELECT
                vi.product_id,
                COALESCE(SUM(CASE WHEN v.voucher_type = 'Purchase'                           THEN vi.quantity ELSE 0 END), 0) AS in_qty,
                COALESCE(SUM(CASE WHEN v.voucher_type IN ('Sales','Delivery Note')           THEN vi.quantity ELSE 0 END), 0) AS out_qty,
                COALESCE(SUM(CASE WHEN v.voucher_type = 'Purchase'                           THEN vi.amount   ELSE 0 END), 0) AS in_value
            FROM voucher_items vi
            JOIN vouchers v ON vi.voucher_id = v.id
            WHERE v.company_id = ?
              AND v.status = 'posted'
              AND v.voucher_date < ?
              AND vi.product_id IN ($ph)
            GROUP BY vi.product_id
        ");
        $mvtStmt->execute(array_merge([$srcId, $splitDate], $oldIds));
        $mvtMap = array_column($mvtStmt->fetchAll(PDO::FETCH_ASSOC), null, 'product_id');

        // Get opening_rate from source items for weighted average calculation
        $rateStmt = $pdo->prepare("SELECT id, opening_rate FROM items WHERE id IN ($ph)");
        $rateStmt->execute($oldIds);
        $rateMap = array_column($rateStmt->fetchAll(PDO::FETCH_ASSOC), 'opening_rate', 'id');

        $updated = 0;
        $now = date('Y-m-d H:i:s');

        foreach ($itemIdMap as $oldId => $newId) {
            $openQty  = floatval($openingQtyMap[$oldId] ?? 0);
            $openRate = floatval($rateMap[$oldId] ?? 0);
            $mvt      = $mvtMap[$oldId] ?? [];

            $inQty    = floatval($mvt['in_qty']   ?? 0);
            $outQty   = floatval($mvt['out_qty']  ?? 0);
            $inValue  = floatval($mvt['in_value'] ?? 0);

            $closingQty = max(0.0, $openQty + $inQty - $outQty);

            // Weighted average rate for closing stock
            $totalQtyIn = $openQty + $inQty;
            $totalValue = ($openQty * $openRate) + $inValue;
            $closingRate  = $totalQtyIn > 0 ? ($totalValue / $totalQtyIn) : $openRate;
            $closingValue = round($closingQty * $closingRate, 2);

            // Update cloned item in Company B: closing becomes new opening
            $pdo->prepare("UPDATE items SET opening_stock = ?, opening_rate = ?, opening_value = ? WHERE id = ?")
                ->execute([round($closingQty, 4), round($closingRate, 4), $closingValue, $newId]);

            // Single Opening movement for Company B (no purchase/sales history here)
            if ($closingQty > 0) {
                $pdo->prepare("
                    INSERT INTO stock_movement (product_id, quantity, type, reference, user_id, notes, created_at)
                    VALUES (?, ?, 'Opening', ?, NULL, 'Opening stock carry-forward from company split', ?)
                ")->execute([$newId, round($closingQty, 4), 'SPLIT-' . $newId, $now]);
            }

            $updated++;
        }

        return $updated;
    } catch (PDOException $e) {
        return 0; // items / stock_movement table may not exist
    }
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

/**
 * Carry forward every unpaid bill/advance from the source company (before split_date)
 * into Company B as individual OPENING_BILL / OPENING_ADVANCE references.
 *
 * Creates one Opening Balance Journal voucher in Company B that serves as the
 * parent for all these bill-wise entries. Runs an integrity check afterward:
 * the sum of opening bills per ledger must equal the ledger's opening_balance.
 *
 * Returns: ['bills_carried' => int, 'advances_carried' => int, 'integrity_errors' => array]
 */
function carryForwardOpeningBills(
    PDO    $pdo,
    int    $srcId,
    int    $dstId,
    string $splitDate,
    array  $maps
): array {
    $now = date('Y-m-d H:i:s');

    // ── Fetch all pending bills (type=New) and advances (type=On Account) ─────
    $stmt = $pdo->prepare("
        SELECT
            ba.ledger_id,
            ba.bill_no,
            ba.bill_date,
            ba.amount          AS original_amount,
            ba.pending_amount,
            ba.type            AS original_type
        FROM bill_allocations ba
        JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
        JOIN vouchers v         ON ve.voucher_id = v.id
        WHERE v.company_id  = ?
          AND v.voucher_date < ?
          AND ba.pending_amount > 0.00
          AND v.status = 'posted'
          AND ba.type IN ('New', 'On Account')
        ORDER BY ba.ledger_id ASC, ba.bill_date ASC
    ");
    $stmt->execute([$srcId, $splitDate]);
    $pendingRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($pendingRows)) {
        return ['bills_carried' => 0, 'advances_carried' => 0, 'integrity_errors' => []];
    }

    // Group by ledger_id
    $byLedger = [];
    foreach ($pendingRows as $row) {
        $byLedger[$row['ledger_id']][] = $row;
    }

    // ── Resolve Financial Year for split_date in Company B ────────────────────
    $fyStmt = $pdo->prepare(
        "SELECT id, code FROM financial_years
         WHERE company_id = ? AND ? BETWEEN start_date AND end_date LIMIT 1"
    );
    $fyStmt->execute([$dstId, $splitDate]);
    $fy = $fyStmt->fetch(PDO::FETCH_ASSOC);

    // ── Create one Opening Balance Journal voucher in Company B ───────────────
    $totalPending = array_sum(array_column($pendingRows, 'pending_amount'));

    $obVoucherId = insertRow($pdo, 'vouchers', [
        'company_id'       => $dstId,
        'voucher_type'     => 'Journal',
        'voucher_no'       => 'OB-' . date('Ymd', strtotime($splitDate)),
        'voucher_date'     => $splitDate,
        'financial_year_id'=> $fy['id'] ?? null,
        'financial_year'   => $fy['code'] ?? null,
        'narration'        => 'Opening Balance: Bill-wise carry-forward from split (source company #' . $srcId . ')',
        'total_amount'     => round($totalPending, 2),
        'status'           => 'posted',
        'created_at'       => $now,
        'updated_at'       => $now,
    ]);

    $billsCarried    = 0;
    $advancesCarried = 0;
    $integrityErrors = [];

    foreach ($byLedger as $oldLedgerId => $bills) {
        $newLedgerId = $maps['ledgers'][$oldLedgerId] ?? null;
        if (!$newLedgerId) continue;

        // Sum pending for this ledger
        $ledgerPending = array_sum(array_column($bills, 'pending_amount'));

        // Fetch opening_balance already set on the new ledger
        $lStmt = $pdo->prepare(
            "SELECT opening_balance, opening_type FROM ledgers WHERE id = ? LIMIT 1"
        );
        $lStmt->execute([$newLedgerId]);
        $ledger = $lStmt->fetch(PDO::FETCH_ASSOC);

        // ── Create one voucher_entry for this ledger in the OB journal ────────
        $entryId = insertRow($pdo, 'voucher_entries', [
            'voucher_id'  => $obVoucherId,
            'ledger_id'   => $newLedgerId,
            'amount'      => round($ledgerPending, 2),
            'dr_cr'       => $ledger['opening_type'] ?? 'Dr',
            'description' => 'Opening bill-wise reference carry-forward',
            'created_at'  => $now,
        ]);

        // ── Create individual bill_allocations for each pending bill ──────────
        foreach ($bills as $bill) {
            $type = ($bill['original_type'] === 'On Account') ? 'Opening' : 'Opening';

            insertRow($pdo, 'bill_allocations', [
                'ledger_id'           => $newLedgerId,
                'voucher_entry_id'    => $entryId,
                'bill_no'             => $bill['bill_no'],
                'bill_date'           => $bill['bill_date'],
                'amount'              => $bill['original_amount'],
                'type'                => 'Opening',
                'pending_amount'      => $bill['pending_amount'],
                'reference_voucher_id'=> null, // original voucher is in old company
            ]);

            if ($bill['original_type'] === 'On Account') {
                $advancesCarried++;
            } else {
                $billsCarried++;
            }
        }

        // ── Integrity check: bills sum must match ledger opening_balance ───────
        $diff = abs($ledgerPending - (float)$ledger['opening_balance']);
        if ($diff > 0.01) {
            // Fetch ledger name for readable error
            $nameStmt = $pdo->prepare("SELECT name FROM ledgers WHERE id = ? LIMIT 1");
            $nameStmt->execute([$newLedgerId]);
            $integrityErrors[] = [
                'ledger_id'       => $newLedgerId,
                'ledger_name'     => $nameStmt->fetchColumn(),
                'opening_balance' => (float)$ledger['opening_balance'],
                'bills_sum'       => round($ledgerPending, 2),
                'difference'      => round($diff, 2),
            ];
        }
    }

    return [
        'bills_carried'    => $billsCarried,
        'advances_carried' => $advancesCarried,
        'integrity_errors' => $integrityErrors,
    ];
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? ($_POST['action'] ?? '');

    // ── GET: Split History ────────────────────────────────────────────────────
    if ($method === 'GET' && $action === 'history') {
        try {
            $stmt = $pdo->prepare("
                SELECT
                    sr.id,
                    sr.split_date,
                    sr.company_a_id,
                    sr.company_a_name,
                    sr.company_a_code,
                    sr.company_b_id,
                    sr.company_b_name,
                    sr.company_b_code,
                    sr.created_at,
                    ca.status AS company_a_status,
                    cb.status AS company_b_status
                FROM split_registry sr
                LEFT JOIN companies ca ON ca.id = sr.company_a_id
                LEFT JOIN companies cb ON cb.id = sr.company_b_id
                WHERE sr.source_company_id = ?
                ORDER BY sr.created_at DESC
            ");
            $stmt->execute([$companyId]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            ApiResponse::success(['history' => $history], 'Split history retrieved');
        } catch (PDOException $e) {
            // split_registry table may not exist yet (no splits done)
            ApiResponse::success(['history' => []], 'Split history retrieved');
        }
    }

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

        // Pending bills list for pre-split review (ageing report preview)
        $pendingBillsList = [];
        try {
            $pbStmt = $pdo->prepare("
                SELECT
                    l.name           AS ledger_name,
                    ba.bill_no,
                    ba.bill_date,
                    ba.amount        AS original_amount,
                    ba.pending_amount,
                    ba.type          AS bill_type,
                    v.voucher_type,
                    DATEDIFF(:sd, ba.bill_date) AS age_days
                FROM bill_allocations ba
                JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
                JOIN vouchers v         ON ve.voucher_id = v.id
                JOIN ledgers  l         ON ba.ledger_id  = l.id
                WHERE v.company_id  = :cid
                  AND v.voucher_date < :sd2
                  AND ba.pending_amount > 0.00
                  AND v.status = 'posted'
                  AND ba.type IN ('New', 'On Account')
                ORDER BY age_days DESC
                LIMIT 100
            ");
            $pbStmt->execute([':sd' => $splitDate, ':cid' => $companyId, ':sd2' => $splitDate]);
            $pendingBillsList = $pbStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) { /* bill_allocations not populated */ }

        ApiResponse::success([
            'checks'            => $checks,
            'can_proceed'       => !$hasErrors,
            'pending_bills'     => $pendingBillsList,
            'summary'           => [
                'vouchers_before_split' => $beforeCount,
                'vouchers_from_split'   => $fromCount,
                'total_ledgers'         => $ledgerCount,
                'pending_bills_count'   => count($pendingBillsList),
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

        $splitDate    = $input['split_date']    ?? null;
        $companyBName = trim($input['company_b_name'] ?? '');

        $errors = [];
        if (!$splitDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $splitDate)) {
            $errors['split_date'] = ['A valid split date is required'];
        }
        if (!$companyBName) $errors['company_b_name'] = ['New company name is required'];
        if (!empty($errors)) ApiResponse::validationError($errors);

        // Auto-generate a unique company code: source code + split year suffix
        $splitYear    = date('Y', strtotime($splitDate));
        $baseCode     = strtoupper(preg_replace('/[^A-Z0-9]/', '', $srcCompany['code'] ?? 'COMP'));
        $baseCode     = substr($baseCode, 0, 8); // keep it short
        $companyBCode = $baseCode . '-' . $splitYear;
        // Ensure uniqueness — append counter if already taken
        $codeCheck = $pdo->prepare("SELECT COUNT(*) FROM companies WHERE code = ?");
        $counter = 2;
        $tryCode = $companyBCode;
        while (true) {
            $codeCheck->execute([$tryCode]);
            if ((int)$codeCheck->fetchColumn() === 0) { $companyBCode = $tryCode; break; }
            $tryCode = $baseCode . '-' . $splitYear . '-' . $counter++;
        }

        // Fetch original company details for cloning metadata
        $srcStmt = $pdo->prepare("SELECT * FROM companies WHERE id = ? LIMIT 1");
        $srcStmt->execute([$companyId]);
        $srcCompany = $srcStmt->fetch(PDO::FETCH_ASSOC);
        if (!$srcCompany) {
            ApiResponse::error('Source company not found', 404);
        }

        // Allow up to 5 minutes for large datasets
        set_time_limit(300);

        // ── Pre-transaction DDL (auto-commits in MySQL) ───────────────────────

        // Ensure bill_allocations.type supports 'Opening'
        try {
            $pdo->exec("
                ALTER TABLE bill_allocations
                MODIFY COLUMN `type`
                    ENUM('New','Against','On Account','Opening') NOT NULL DEFAULT 'New'
            ");
        } catch (PDOException $e) { /* already exists or table missing — ok */ }

        // Add split_parent_id to companies so admin panel can filter out split companies
        try {
            $pdo->exec("ALTER TABLE companies ADD COLUMN split_parent_id INT NULL DEFAULT NULL");
        } catch (PDOException $e) { /* column already exists — ok */ }

        // Create the split_registry table to store split event metadata
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS split_registry (
                    id              INT          AUTO_INCREMENT PRIMARY KEY,
                    source_company_id INT        NOT NULL,
                    company_a_id    INT          NOT NULL,
                    company_b_id    INT          NOT NULL,
                    split_date      DATE         NOT NULL,
                    company_a_name  VARCHAR(255) NOT NULL,
                    company_a_code  VARCHAR(50)  NOT NULL,
                    company_b_name  VARCHAR(255) NOT NULL,
                    company_b_code  VARCHAR(50)  NOT NULL,
                    created_by      INT          NULL,
                    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            ");
        } catch (PDOException $e) { /* table may already exist */ }

        $pdo->beginTransaction();
        try {
            $now = date('Y-m-d H:i:s');

            // ── Detect actual columns in the companies table ──────────────────
            // Two migration versions exist: the older one has only code/name/email/phone,
            // the newer one adds gstin/address/city/state/pincode/country.
            $colStmt = $pdo->query("SHOW COLUMNS FROM companies");
            $existingCols = array_column($colStmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

            // All possible optional fields sourced from the original company
            // split_parent_id marks these companies as split children (hidden from admin panel)
            $optionalFields = [
                'gstin'           => $srcCompany['gstin']   ?? null,
                'address'         => $srcCompany['address'] ?? null,
                'city'            => $srcCompany['city']    ?? null,
                'state'           => $srcCompany['state']   ?? null,
                'pincode'         => $srcCompany['pincode'] ?? null,
                'country'         => $srcCompany['country'] ?? 'India',
                'split_parent_id' => $companyId,
            ];

            // Build a helper that creates a company row using only existing columns
            $createCompany = function (string $code, string $name) use (
                $pdo, $existingCols, $optionalFields, $srcCompany, $now
            ): int {
                $row = [
                    'code'       => $code,
                    'name'       => $name,
                    'email'      => $srcCompany['email'] ?? null,
                    'phone'      => $srcCompany['phone'] ?? null,
                    'status'     => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                // Add optional columns only if they exist in this database
                foreach ($optionalFields as $col => $val) {
                    if (in_array($col, $existingCols)) {
                        $row[$col] = $val;
                    }
                }
                return insertRow($pdo, 'companies', $row);
            };

            // ── Step 1: Create new Company B (post-split) ────────────────────
            // The original company stays intact as the pre-split historical archive.
            $companyBId = $createCompany($companyBCode, $companyBName);

            // ── Step 2: Clone masters to Company B ───────────────────────────
            $mapsB = cloneMasters($pdo, $companyId, $companyBId);

            // ── Step 3: Set closing stock as opening stock for Company B ──────
            $stockItemsSet = applyOpeningStock($pdo, $companyId, $splitDate, $mapsB['items']);

            // ── Step 4: Calculate & apply opening balances to Company B ───────
            $obCount = applyOpeningBalances($pdo, $companyId, $splitDate, $mapsB['ledgers']);

            // ── Step 5: Carry forward bill-by-bill references to Company B ────
            $obBills = carryForwardOpeningBills($pdo, $companyId, $companyBId, $splitDate, $mapsB);

            // ── Step 6: Clone post-split vouchers to Company B ────────────────
            $resB = cloneVouchers(
                $pdo, $companyId, $companyBId, $mapsB,
                "AND v.voucher_date >= ?", [$splitDate]
            );

            // ── Step 7: Link current user to new Company B ────────────────────
            $pdo->prepare(
                "INSERT IGNORE INTO company_users (company_id, user_id, role, is_default, status, created_at, updated_at)
                 VALUES (?, ?, 'owner', 0, 'active', ?, ?)"
            )->execute([$companyBId, $user['id'], $now, $now]);

            $pdo->commit();

            // ── Step 8: Record split in registry (outside transaction — best-effort) ──
            try {
                $pdo->prepare("
                    INSERT INTO split_registry
                        (source_company_id, company_a_id, company_b_id, split_date,
                         company_a_name, company_a_code, company_b_name, company_b_code, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $companyId,
                    $companyId,                          // original company IS company A
                    $companyBId,
                    $splitDate,
                    $srcCompany['name'],                 // original company name
                    $srcCompany['code'],                 // original company code
                    $companyBName,
                    $companyBCode,
                    $user['id'],
                    date('Y-m-d H:i:s'),
                ]);
            } catch (PDOException $e) { /* non-fatal */ }

            ApiResponse::success([
                'source_company' => [
                    'id'     => $companyId,
                    'name'   => $srcCompany['name'],
                    'code'   => $srcCompany['code'],
                    'period' => "Up to " . date('d M Y', strtotime($splitDate . ' -1 day')) . " (archive)",
                ],
                'company_b' => [
                    'id'              => $companyBId,
                    'name'            => $companyBName,
                    'code'            => $companyBCode,
                    'voucher_count'   => count($resB['vouchers']),
                    'period'          => "From " . date('d M Y', strtotime($splitDate)),
                    'bills_carried'   => $obBills['bills_carried'],
                    'advances_carried'=> $obBills['advances_carried'],
                    'integrity_errors'=> $obBills['integrity_errors'],
                    'stock_items_set' => $stockItemsSet,
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
