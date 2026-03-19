<?php
class VoucherHelper {

    /**
     * Generate next voucher number for a voucher type
     *
     * @param PDO $pdo Database connection
     * @param string $voucherType Type of voucher (Sales, Purchase, etc.)
     * @param int|null $companyId Company ID (optional)
     * @param int $startingNumber Starting number if no vouchers exist (default: 1)
     * @return string Generated voucher number
     */
    public static function generateVoucherNo($pdo, $voucherType, $companyId = null, $startingNumber = 1) {
        $prefix = self::getVoucherPrefix($voucherType);

        $sql = "SELECT voucher_no FROM vouchers
                WHERE voucher_type = ?
                AND voucher_no LIKE ?";
        $params = [$voucherType, $prefix . '%'];

        if ($companyId) {
            $sql .= " AND company_id = ?";
            $params[] = $companyId;
        }

        $sql .= " ORDER BY id DESC LIMIT 1";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $lastVoucher = $stmt->fetch();

        if ($lastVoucher) {
            // Extract number from last voucher (e.g., INV-123 => 123)
            $lastNumber = (int)preg_replace('/[^0-9]/', '', $lastVoucher['voucher_no']);
            $nextNumber = $lastNumber + 1;
        } else {
            // Use starting number if no vouchers exist
            $nextNumber = $startingNumber;
        }

        // Return without leading zeros - INV-1, INV-2, INV-3, etc.
        return $prefix . $nextNumber;
    }

    /**
     * Get voucher prefix based on type
     */
    private static function getVoucherPrefix($voucherType) {
        $prefixes = [
            'Sales' => 'INV-',
            'Purchase' => 'PUR-',
            'Receipt' => 'RCP-',
            'Payment' => 'PAY-',
            'Sales Order' => 'SO-',
            'Purchase Order' => 'PO-',
            'Quotation' => 'VCH-',
            'Contra' => 'CON-',
            'Journal' => 'JV-'
        ];

        return $prefixes[$voucherType] ?? 'VCH-';
    }

    /**
     * Validate double-entry (Dr total must equal Cr total)
     */
    public static function validateDoubleEntry($entries) {
        $drTotal = 0;
        $crTotal = 0;

        foreach ($entries as $entry) {
            $amount = floatval($entry['amount']);
            if ($entry['dr_cr'] === 'Dr') {
                $drTotal += $amount;
            } else {
                $crTotal += $amount;
            }
        }

        // Allow small floating point difference (0.01)
        return abs($drTotal - $crTotal) < 0.01;
    }

    /**
     * Get outstanding bills for a ledger
     */
    public static function getOutstandingBills($pdo, $ledgerId, $type = 'New') {
        $stmt = $pdo->prepare("
            SELECT
                ba.*,
                v.voucher_no,
                v.voucher_date,
                v.voucher_type
            FROM bill_allocations ba
            INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
            INNER JOIN vouchers v ON ve.voucher_id = v.id
            WHERE ba.ledger_id = ?
            AND ba.pending_amount > 0
            AND ba.type = ?
            ORDER BY ba.bill_date ASC
        ");

        $stmt->execute([$ledgerId, $type]);
        return $stmt->fetchAll();
    }

    /**
     * Create bill allocation (for bill-by-bill tracking)
     */
    public static function createBillAllocation($pdo, $data) {
        $stmt = $pdo->prepare("
            INSERT INTO bill_allocations
            (ledger_id, voucher_entry_id, bill_no, bill_date, amount, type, pending_amount, reference_voucher_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $data['ledger_id'],
            $data['voucher_entry_id'],
            $data['bill_no'],
            $data['bill_date'] ?? null,
            $data['amount'],
            $data['type'] ?? 'New',
            $data['pending_amount'] ?? $data['amount'],
            $data['reference_voucher_id'] ?? null
        ]);

        return $pdo->lastInsertId();
    }

    /**
     * Update pending amount in bill allocation
     */
    public static function updatePendingAmount($pdo, $billAllocationId, $paidAmount) {
        $stmt = $pdo->prepare("
            UPDATE bill_allocations
            SET pending_amount = pending_amount - ?
            WHERE id = ? AND pending_amount >= ?
        ");

        return $stmt->execute([$paidAmount, $billAllocationId, $paidAmount]);
    }

    /**
     * Get ledger balance
     */
    public static function getLedgerBalance($pdo, $ledgerId, $upToDate = null) {
        $sql = "
            SELECT
                l.opening_balance,
                l.opening_type,
                COALESCE(SUM(CASE WHEN ve.dr_cr = 'Dr' THEN ve.amount ELSE 0 END), 0) as total_dr,
                COALESCE(SUM(CASE WHEN ve.dr_cr = 'Cr' THEN ve.amount ELSE 0 END), 0) as total_cr
            FROM ledgers l
            LEFT JOIN voucher_entries ve ON l.id = ve.ledger_id
            LEFT JOIN vouchers v ON ve.voucher_id = v.id
            WHERE l.id = ? AND l.status = 'active'
        ";

        $params = [$ledgerId];

        if ($upToDate) {
            $sql .= " AND v.voucher_date <= ?";
            $params[] = $upToDate;
        }

        $sql .= " GROUP BY l.id, l.opening_balance, l.opening_type";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();

        if (!$result) {
            return ['balance' => 0, 'type' => 'Dr'];
        }

        $openingBalance = floatval($result['opening_balance']);
        $totalDr = floatval($result['total_dr']);
        $totalCr = floatval($result['total_cr']);

        // Calculate balance based on opening type
        if ($result['opening_type'] === 'Dr') {
            $balance = $openingBalance + $totalDr - $totalCr;
        } else {
            $balance = $openingBalance + $totalCr - $totalDr;
        }

        $type = $balance >= 0 ? 'Dr' : 'Cr';
        $balance = abs($balance);

        return ['balance' => $balance, 'type' => $type];
    }

    /**
     * Check if ledger requires bill-by-bill
     */
    public static function requiresBillByBill($pdo, $ledgerId) {
        $stmt = $pdo->prepare("SELECT bill_by_bill FROM ledgers WHERE id = ?");
        $stmt->execute([$ledgerId]);
        $result = $stmt->fetch();
        return $result && (bool)$result['bill_by_bill'];
    }

    /**
     * Generate unique bill number
     */
    public static function generateBillNo($pdo, $voucherType, $companyId = null) {
        return self::generateVoucherNo($pdo, $voucherType, $companyId);
    }

    /**
     * Validate voucher date
     */
    public static function isValidVoucherDate($date) {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    /**
     * Get voucher summary
     */
    public static function getVoucherSummary($pdo, $voucherId) {
        $stmt = $pdo->prepare("
            SELECT
                v.*,
                l.name as party_name,
                u.name as created_by_name,
                COUNT(DISTINCT ve.id) as entry_count,
                COUNT(DISTINCT vi.id) as item_count
            FROM vouchers v
            LEFT JOIN ledgers l ON v.party_ledger_id = l.id
            LEFT JOIN users u ON v.created_by = u.id
            LEFT JOIN voucher_entries ve ON v.id = ve.voucher_id
            LEFT JOIN voucher_items vi ON v.id = vi.voucher_id
            WHERE v.id = ?
            GROUP BY v.id
        ");

        $stmt->execute([$voucherId]);
        return $stmt->fetch();
    }
}
