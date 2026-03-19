<?php
/**
 * E-Way Bill View API
 *
 * Returns structured e-Way Bill data (Header, PART-A, PART-B)
 * matching the official GSP e-Way Bill print format.
 *
 * GET /api/v1/gst/ewaybill_view.php?ewb_no=664745437278
 * GET /api/v1/gst/ewaybill_view.php?voucher_id=123
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../middleware/auth.php';

AuthMiddleware::authenticate();

function ewbFormatDateTime($value) {
    if (empty($value)) return null;
    $ts = strtotime($value);
    return $ts ? date('d/m/Y h:i:s A', $ts) : $value;
}

function ewbFormatDate($value) {
    if (empty($value)) return null;
    $ts = strtotime($value);
    return $ts ? date('d/m/Y', $ts) : $value;
}

function ewbTransactionTypeLabel($type) {
    $map = [
        1 => 'Regular',
        2 => 'Bill To - Ship To',
        3 => 'Bill From - Dispatch From',
        4 => 'Combination of 2 and 3',
    ];
    return $map[(int)$type] ?? (string)$type;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        ApiResponse::error('Method not allowed', 405);
    }

    $pdo      = getDBConnection();
    $ewbNo    = trim($_GET['ewb_no'] ?? '');
    $voucherId = isset($_GET['voucher_id']) ? (int)$_GET['voucher_id'] : null;

    if ($ewbNo === '' && !$voucherId) {
        ApiResponse::error('ewb_no or voucher_id is required', 400);
    }

    // Fetch ewaybill_log joined with voucher + party ledger
    if ($ewbNo !== '') {
        $sql = "
            SELECT
                ewl.*,
                v.voucher_no, v.voucher_date, v.voucher_type,
                v.billing_name, v.billing_gstin, v.billing_address,
                v.billing_state, v.consignee_name, v.consignee_address,
                v.consignee_gstin, v.consignee_state, v.consignee_pincode,
                v.consignee_same_as_billing, v.place_of_supply, v.total_amount,
                l.name      AS party_name,
                l.gst_number AS party_gstin,
                l.address   AS party_address,
                l.state     AS party_state
            FROM ewaybill_log ewl
            INNER JOIN vouchers v  ON ewl.voucher_id = v.id
            INNER JOIN ledgers  l  ON v.party_ledger_id = l.id
            WHERE ewl.ewb_no = ?
            LIMIT 1
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$ewbNo]);
    } else {
        $sql = "
            SELECT
                ewl.*,
                v.voucher_no, v.voucher_date, v.voucher_type,
                v.billing_name, v.billing_gstin, v.billing_address,
                v.billing_state, v.consignee_name, v.consignee_address,
                v.consignee_gstin, v.consignee_state, v.consignee_pincode,
                v.consignee_same_as_billing, v.place_of_supply, v.total_amount,
                l.name      AS party_name,
                l.gst_number AS party_gstin,
                l.address   AS party_address,
                l.state     AS party_state
            FROM ewaybill_log ewl
            INNER JOIN vouchers v  ON ewl.voucher_id = v.id
            INNER JOIN ledgers  l  ON v.party_ledger_id = l.id
            WHERE ewl.voucher_id = ?
            ORDER BY ewl.id DESC
            LIMIT 1
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$voucherId]);
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        ApiResponse::error('E-Way Bill not found', 404);
    }

    // Fetch EWB settings (supplier / dispatch info)
    $settingsStmt = $pdo->query("SELECT * FROM ewb_settings ORDER BY id DESC LIMIT 1");
    $settings     = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // Parse stored provider API response for extra fields
    $apiResp = [];
    if (!empty($row['api_response'])) {
        $decoded = json_decode($row['api_response'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $apiResp = $decoded;
        }
    }

    // Helper: pick first non-empty value
    $pick = function () {
        foreach (func_get_args() as $v) {
            if ($v !== null && trim((string)$v) !== '') return $v;
        }
        return null;
    };

    // ── Resolve PART-A fields ─────────────────────────────────────────────────
    $supplierGstin    = $pick($settings['gstin'] ?? null, $apiResp['fromGstin'] ?? null);
    $supplierName     = $pick($settings['from_trade_name'] ?? null, $apiResp['fromTrdName'] ?? null);
    $generatedBy      = $supplierGstin . ($supplierName ? ' - ' . $supplierName : '');

    $dispatchAddr1    = $pick($settings['from_addr1'] ?? null, $apiResp['fromAddr1'] ?? null, '');
    $dispatchPlace    = $pick($settings['from_place'] ?? null, $apiResp['fromPlace'] ?? null, '');
    $dispatchState    = $pick($settings['from_state'] ?? null);
    $dispatchPincode  = $pick($settings['from_pincode'] ?? null, $apiResp['fromPincode'] ?? null);
    $placeOfDispatch  = implode(', ', array_filter([
        $dispatchAddr1,
        $dispatchPlace,
        $dispatchState,
        $dispatchPincode ? (string)$dispatchPincode : null,
    ]));

    // Recipient details (consignee / billing)
    $useConsignee     = !$row['consignee_same_as_billing'] && !empty($row['consignee_name']);
    $recipientGstin   = $pick(
        $useConsignee ? ($row['consignee_gstin'] ?? null) : null,
        $row['billing_gstin'],
        $row['party_gstin'],
        $apiResp['toGstin'] ?? null
    );
    $recipientName    = $pick(
        $useConsignee ? ($row['consignee_name'] ?? null) : null,
        $row['billing_name'],
        $row['party_name'],
        $apiResp['toTrdName'] ?? null
    );
    $deliveryAddr     = $pick(
        $useConsignee ? ($row['consignee_address'] ?? null) : null,
        $row['billing_address'],
        $row['party_address'],
        $apiResp['toAddr1'] ?? null
    );
    $deliveryState    = $pick(
        $useConsignee ? ($row['consignee_state'] ?? null) : null,
        $row['billing_state'],
        $row['party_state'],
        $apiResp['toPlace'] ?? null
    );
    $deliveryPincode  = $pick(
        $useConsignee ? ($row['consignee_pincode'] ?? null) : null,
        $apiResp['toPincode'] ?? null
    );
    $placeOfDelivery  = implode(', ', array_filter([
        $deliveryAddr,
        $deliveryState,
        $deliveryPincode ? (string)$deliveryPincode : null,
    ]));

    // HSN Code — fetch directly from voucher_items JOIN items (source of truth)
    $itemsStmt = $pdo->prepare("
        SELECT vi.item_name, vi.quantity, vi.rate, vi.amount,
               vi.tax_percent, vi.tax_amount,
               i.hsn_code, i.name AS product_name,
               u.symbol AS unit_symbol
        FROM voucher_items vi
        LEFT JOIN items i ON vi.product_id = i.id
        LEFT JOIN units u ON vi.unit_id = u.id
        WHERE vi.voucher_id = ?
        ORDER BY vi.id ASC
    ");
    $itemsStmt->execute([$row['voucher_id']]);
    $voucherItems = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Build item list and collect unique HSN codes
    $itemList   = [];
    $hsnCodes   = [];
    foreach ($voucherItems as $vi) {
        $hsn = trim((string)($vi['hsn_code'] ?? ''));
        if ($hsn !== '' && !in_array($hsn, $hsnCodes, true)) {
            $hsnCodes[] = $hsn;
        }
        $itemList[] = [
            'item_name'   => $vi['item_name'],
            'product_name'=> $vi['product_name'],
            'hsn_code'    => $hsn !== '' ? $hsn : null,
            'quantity'    => (float)$vi['quantity'],
            'unit'        => $vi['unit_symbol'],
            'rate'        => (float)$vi['rate'],
            'amount'      => (float)$vi['amount'],
            'tax_percent' => (float)$vi['tax_percent'],
            'tax_amount'  => (float)$vi['tax_amount'],
        ];
    }

    $transactionType = $pick($apiResp['transactionType'] ?? null, 1);
    $totalValue      = $pick($apiResp['totInvValue'] ?? null, $row['total_amount']);
    $reasonForTrans  = 'Outward - Supply'; // default for Sales

    // Valid From with distance info
    $validFromRaw  = ewbFormatDateTime($row['ewb_date']);
    $validFrom     = $validFromRaw;
    if (!empty($row['trans_distance'])) {
        $validFrom .= '[' . $row['trans_distance'] . ' Kms]';
    }

    $isExpired = strtotime($row['valid_upto']) < time();

    // ── Build Response ────────────────────────────────────────────────────────
    $response = [
        'header' => [
            'ewb_no'       => $row['ewb_no'],
            'ewb_date'     => ewbFormatDateTime($row['ewb_date']),
            'generated_by' => $generatedBy,
            'valid_from'   => $validFrom,
            'valid_until'  => ewbFormatDateTime($row['valid_upto']),
            'portal'       => 1,
            'status'       => $row['status'],
            'is_expired'   => $isExpired,
        ],
        'part_a' => [
            'supplier_gstin'         => $supplierGstin,
            'supplier_name'          => $supplierName,
            'place_of_dispatch'      => $placeOfDispatch,
            'recipient_gstin'        => $recipientGstin,
            'recipient_name'         => $recipientName,
            'place_of_delivery'      => $placeOfDelivery,
            'document_no'            => $row['voucher_no'],
            'document_date'          => ewbFormatDate($row['voucher_date']),
            'transaction_type'       => ewbTransactionTypeLabel($transactionType),
            'value_of_goods'         => $totalValue !== null ? (float)$totalValue : null,
            'hsn_code'               => !empty($hsnCodes) ? implode(', ', $hsnCodes) : null,
            'reason_for_transport'   => $reasonForTrans,
            'transporter'            => $pick($row['transporter_name'], $row['transporter_id']),
        ],
        'part_b' => [
            [
                'mode'          => $row['trans_mode'],
                'vehicle_no'    => $row['vehicle_no'],
                'vehicle_type'  => $row['vehicle_type'],
                'from'          => $pick($row['from_place'], $dispatchPlace),
                'entered_date'  => ewbFormatDateTime($row['created_at']),
                'entered_by'    => $supplierGstin,
                'trans_distance'=> $row['trans_distance'],
                'cewb_no'       => null,
                'multi_veh_info'=> null,
                'portal'        => 1,
            ]
        ],
        'items' => $itemList,
        'cancel' => $row['status'] === 'cancelled' ? [
            'cancelled_at'  => ewbFormatDateTime($row['cancelled_at']),
            'cancel_reason' => $row['cancel_reason'],
        ] : null,
    ];

    ApiResponse::success($response, 'E-Way Bill details fetched successfully');

} catch (PDOException $e) {
    error_log('EWB View API DB error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log('EWB View API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
