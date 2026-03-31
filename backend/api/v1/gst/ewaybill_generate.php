<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/ewaybill.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

function ewbNormaliseDate($dateStr) {
    if (empty($dateStr)) {
        return date('Y-m-d H:i:s');
    }
    $dateStr = trim($dateStr);
    $formats = ['d/m/Y h:i:s A', 'd/m/Y H:i:s', 'Y-m-d H:i:s', 'Y-m-d'];
    foreach ($formats as $fmt) {
        $d = DateTime::createFromFormat($fmt, $dateStr);
        if ($d !== false) {
            return $d->format('Y-m-d H:i:s');
        }
    }
    $ts = strtotime($dateStr);
    return $ts ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
}

function ewbQtyUnit($unitSymbol) {
    $raw = strtoupper(trim((string)$unitSymbol));
    $raw = preg_replace('/[^A-Z0-9]/', '', $raw);
    $map = [
        'PCS' => 'NOS', 'PC' => 'NOS', 'NOS' => 'NOS',
        'KG' => 'KGS', 'KGS' => 'KGS',
        'G' => 'GMS', 'GRAM' => 'GMS', 'GRAMS' => 'GMS',
        'L' => 'LTR', 'LTR' => 'LTR', 'LITER' => 'LTR', 'LITRE' => 'LTR',
        'M' => 'MTR', 'MTR' => 'MTR', 'METER' => 'MTR', 'METRE' => 'MTR',
        'CM' => 'CMS', 'MM' => 'MMS',
        'BOX' => 'BOX', 'CTN' => 'CTN', 'CARTON' => 'CTN', 'DZN' => 'DOZ',
        'DOZEN' => 'DOZ', 'ROL' => 'ROL', 'ROLL' => 'ROL', 'BAG' => 'BAG'
    ];
    return $map[$raw] ?? 'NOS';
}

function ewbResolveStateCode($stateValue, $gstin, $fallback) {
    $stateRaw = strtoupper(trim((string)$stateValue));
    $gstinRaw = strtoupper(trim((string)$gstin));

    if ($stateRaw !== '' && ctype_digit($stateRaw)) {
        $code = (int)$stateRaw;
        if ($code > 0 && $code <= 99) {
            return $code;
        }
    }

    $stateMap = [
        'JAMMU AND KASHMIR' => 1,
        'HIMACHAL PRADESH' => 2,
        'PUNJAB' => 3,
        'CHANDIGARH' => 4,
        'UTTARAKHAND' => 5,
        'HARYANA' => 6,
        'DELHI' => 7,
        'RAJASTHAN' => 8,
        'UTTAR PRADESH' => 9,
        'BIHAR' => 10,
        'SIKKIM' => 11,
        'ARUNACHAL PRADESH' => 12,
        'NAGALAND' => 13,
        'MANIPUR' => 14,
        'MIZORAM' => 15,
        'TRIPURA' => 16,
        'MEGHALAYA' => 17,
        'ASSAM' => 18,
        'WEST BENGAL' => 19,
        'JHARKHAND' => 20,
        'ODISHA' => 21,
        'CHHATTISGARH' => 22,
        'MADHYA PRADESH' => 23,
        'GUJARAT' => 24,
        'DADRA AND NAGAR HAVELI AND DAMAN AND DIU' => 26,
        'MAHARASHTRA' => 27,
        'ANDHRA PRADESH' => 28,
        'KARNATAKA' => 29,
        'GOA' => 30,
        'LAKSHADWEEP' => 31,
        'KERALA' => 32,
        'TAMIL NADU' => 33,
        'PUDUCHERRY' => 34,
        'ANDAMAN AND NICOBAR ISLANDS' => 35,
        'TELANGANA' => 36
    ];

    if (isset($stateMap[$stateRaw])) {
        return $stateMap[$stateRaw];
    }

    if ($gstinRaw !== '' && strlen($gstinRaw) >= 2 && ctype_digit(substr($gstinRaw, 0, 2))) {
        $code = (int)substr($gstinRaw, 0, 2);
        if ($code > 0 && $code <= 99) {
            return $code;
        }
    }

    return (int)$fallback;
}

function ewbDecodeProviderResponse($response) {
    if (is_array($response)) {
        return $response;
    }

    if (!is_string($response)) {
        return [];
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) ? $decoded : [];
}

try {
    $pdo       = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method    = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $voucherId = $_GET['voucher_id'] ?? null;
        $ewbNo = $_GET['ewb_no'] ?? null;

        if ($ewbNo) {
            $stmt = $pdo->prepare("SELECT * FROM ewaybill_log WHERE ewb_no = ?");
            $stmt->execute([$ewbNo]);
        } elseif ($voucherId) {
            $stmt = $pdo->prepare("\n                SELECT ewl.*, v.voucher_no, v.voucher_date, v.total_amount
                FROM ewaybill_log ewl
                INNER JOIN vouchers v ON ewl.voucher_id = v.id
                WHERE ewl.voucher_id = ?
                ORDER BY ewl.id DESC LIMIT 1
            ");
            $stmt->execute([$voucherId]);
        } else {
            ApiResponse::error('Voucher ID or EWB number is required');
        }

        $ewaybill = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ewaybill) {
            ApiResponse::success(['status' => 'not_generated'], 'E-Way Bill not found');
        }

        $ewaybill['is_expired'] = ($ewaybill['valid_upto'] && strtotime($ewaybill['valid_upto']) < time());
        ApiResponse::success($ewaybill, 'E-Way Bill status retrieved');
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        // Manual mode (pass-through)
        if (isset($input['payload']) && is_array($input['payload'])) {
            $required = ['gstin', 'ewbpwd', 'authtoken'];
            $errors = [];
            foreach ($required as $field) {
                if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
                    $errors[$field] = [strtoupper($field) . ' is required'];
                }
            }
            if (!empty($errors)) {
                ApiResponse::validationError($errors);
            }

            $providerResult = EWayBillHelper::request(
                $input['action'] ?? 'GENEWAYBILL',
                [
                    'aspid' => isset($input['aspid']) ? trim((string)$input['aspid']) : null,
                    'password' => isset($input['password']) ? trim((string)$input['password']) : null,
                    'gstin' => trim((string)$input['gstin']),
                    'ewbpwd' => trim((string)$input['ewbpwd']),
                    'authtoken' => trim((string)$input['authtoken']),
                    'username' => isset($input['username']) ? trim((string)$input['username']) : null
                ],
                $input['payload'],
                $input['http_method'] ?? 'POST'
            );

            if (!$providerResult['success']) {
                ApiResponse::error(
                    EWayBillHelper::providerMessage($providerResult['response']),
                    $providerResult['http_code'] > 0 ? $providerResult['http_code'] : 400,
                    [
                        'provider_response' => $providerResult['response'],
                        'provider_url' => $providerResult['request_url']
                    ]
                );
            }

            $resp = $providerResult['response'];
            $ewbNo = $resp['ewayBillNo'] ?? $resp['EwbNo'] ?? $resp['ewbNo'] ?? null;

            ApiResponse::success([
                'ewb_no' => $ewbNo,
                'provider_response' => $resp,
                'provider_url' => $providerResult['request_url']
            ], 'E-Way Bill generated successfully');
        }

        if (!isset($input['voucher_id'])) {
            ApiResponse::error('voucher_id is required (or provide payload for manual mode)');
        }

        $voucherId = (int)$input['voucher_id'];

        $stmt = $pdo->prepare("SELECT * FROM ewb_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$companyId]);
        $ewbSettings = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ewbSettings) {
            ApiResponse::error('EWB settings not configured. Save settings first.', 400);
        }

        $stmt = $pdo->prepare("SELECT id FROM ewaybill_log WHERE voucher_id = ? AND status = 'generated'");
        $stmt->execute([$voucherId]);
        if ($stmt->fetch()) {
            ApiResponse::error('E-Way Bill already generated for this voucher', 409);
        }

        $stmt = $pdo->prepare("\n            SELECT v.*, l.name as buyer_name, l.gst_number as buyer_gstin,
                   l.address as buyer_address, l.city as buyer_city, l.state as buyer_state, l.pincode as buyer_pincode
            FROM vouchers v
            INNER JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE v.id = ? AND v.voucher_type = 'Sales' AND v.status = 'posted'
        ");
        $stmt->execute([$voucherId]);
        $voucher = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$voucher) {
            ApiResponse::error('Valid posted sales voucher not found', 404);
        }

        $stmt = $pdo->prepare("\n            SELECT vi.*, i.hsn_code, i.name as product_name, u.symbol as unit_symbol
            FROM voucher_items vi
            LEFT JOIN items i ON vi.product_id = i.id
            LEFT JOIN units u ON vi.unit_id = u.id
            WHERE vi.voucher_id = ?
        ");
        $stmt->execute([$voucherId]);
        $lineItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($lineItems)) {
            ApiResponse::error('No voucher items found', 400);
        }

        $vehicleNo = trim((string)($input['vehicle_no'] ?? ''));
        $transDistance = (int)($input['trans_distance'] ?? 0);
        $transModeInput = strtoupper(trim((string)($input['trans_mode'] ?? '1')));
        $vehicleTypeInput = strtoupper(trim((string)($input['vehicle_type'] ?? 'R')));

        $transModeProvider = in_array($transModeInput, ['1', '2', '3', '4'], true)
            ? $transModeInput
            : (['ROAD' => '1', 'RAIL' => '2', 'AIR' => '3', 'SHIP' => '4'][$transModeInput] ?? '1');
        $transModeDb = ['1' => 'Road', '2' => 'Rail', '3' => 'Air', '4' => 'Ship'][$transModeProvider];

        $vehicleTypeProvider = in_array($vehicleTypeInput, ['R', 'O'], true)
            ? $vehicleTypeInput
            : (($vehicleTypeInput === 'ODC' || $vehicleTypeInput === 'OVER DIMENSIONAL CARGO') ? 'O' : 'R');
        $vehicleTypeDb = ($vehicleTypeProvider === 'O') ? 'ODC' : 'Regular';

        if ($transModeProvider === '1' && $vehicleNo === '') {
            ApiResponse::validationError(['vehicle_no' => ['Vehicle number is required for road transport']]);
        }
        if ($transDistance <= 0) {
            ApiResponse::validationError(['trans_distance' => ['Transport distance must be greater than 0']]);
        }

        $fromStateCode = (int)$ewbSettings['from_state_code'];
        $toGstin = trim((string)($voucher['buyer_gstin'] ?? ''));
        $toGstin = $toGstin !== '' ? strtoupper($toGstin) : 'URP';
        $toStateCode = ewbResolveStateCode($voucher['buyer_state'] ?? '', $toGstin, $fromStateCode);
        $intraState = ($fromStateCode === $toStateCode);

        $itemList = [];
        $totalTaxable = 0.0;
        $totalCgst = 0.0;
        $totalSgst = 0.0;
        $totalIgst = 0.0;

        foreach ($lineItems as $li) {
            $taxable = round((float)($li['amount'] ?? 0), 2);
            $taxRate = round((float)($li['tax_percent'] ?? 0), 2);
            $hsnRaw = preg_replace('/\D/', '', (string)($li['hsn_code'] ?? ''));
            $hsnCode = ($hsnRaw === '') ? 0 : (int)$hsnRaw;
            $qtyUnit = ewbQtyUnit($li['unit_symbol'] ?? '');
            $name = trim((string)($li['item_name'] ?? $li['product_name'] ?? 'ITEM'));

            if ($hsnCode <= 0) {
                ApiResponse::validationError(['hsn_code' => ["HSN missing for item: {$name}"]]);
            }

            if ($intraState) {
                $cgstRate = round($taxRate / 2, 2);
                $sgstRate = $cgstRate;
                $igstRate = 0.0;
            } else {
                $cgstRate = 0.0;
                $sgstRate = 0.0;
                $igstRate = $taxRate;
            }

            $lineCgst = round($taxable * $cgstRate / 100, 2);
            $lineSgst = round($taxable * $sgstRate / 100, 2);
            $lineIgst = round($taxable * $igstRate / 100, 2);

            $totalTaxable += $taxable;
            $totalCgst += $lineCgst;
            $totalSgst += $lineSgst;
            $totalIgst += $lineIgst;

            $itemList[] = [
                'productName' => $name,
                'productDesc' => $name,
                'hsnCode' => $hsnCode,
                'quantity' => (float)($li['quantity'] ?? 0),
                'qtyUnit' => $qtyUnit,
                'cgstRate' => $cgstRate,
                'sgstRate' => $sgstRate,
                'igstRate' => $igstRate,
                'cessRate' => 0,
                'cessNonadvol' => 0,
                'taxableAmount' => $taxable
            ];
        }

        $totalTaxable = round($totalTaxable, 2);
        $totalCgst = round($totalCgst, 2);
        $totalSgst = round($totalSgst, 2);
        $totalIgst = round($totalIgst, 2);
        $totInvValue = round($totalTaxable + $totalCgst + $totalSgst + $totalIgst, 2);

        $ewbPayload = [
            'supplyType' => 'O',
            'subSupplyType' => '1',
            'subSupplyDesc' => '',
            'docType' => 'INV',
            'docNo' => $voucher['voucher_no'],
            'docDate' => date('d/m/Y', strtotime($voucher['voucher_date'])),
            'fromGstin' => $ewbSettings['gstin'],
            'fromTrdName' => $ewbSettings['from_trade_name'],
            'fromAddr1' => $ewbSettings['from_addr1'],
            'fromAddr2' => $ewbSettings['from_addr2'] ?? '',
            'fromPlace' => $ewbSettings['from_place'],
            'fromPincode' => (int)$ewbSettings['from_pincode'],
            'actFromStateCode' => $fromStateCode,
            'fromStateCode' => $fromStateCode,
            'toGstin' => $toGstin,
            'toTrdName' => $voucher['buyer_name'],
            'toAddr1' => $voucher['buyer_address'] ?? 'NA',
            'toAddr2' => '',
            'toPlace' => $voucher['buyer_city'] ?? $voucher['place_of_supply'] ?? 'NA',
            'toPincode' => (int)($voucher['buyer_pincode'] ?? $ewbSettings['from_pincode']),
            'actToStateCode' => $toStateCode,
            'toStateCode' => $toStateCode,
            'transactionType' => (int)($input['transaction_type'] ?? 1),
            'otherValue' => '',
            'totalValue' => $totalTaxable,
            'cgstValue' => $totalCgst,
            'sgstValue' => $totalSgst,
            'igstValue' => $totalIgst,
            'cessValue' => 0,
            'cessNonAdvolValue' => 0,
            'totInvValue' => $totInvValue,
            'transporterId' => trim((string)($input['transporter_id'] ?? '')),
            'transporterName' => trim((string)($input['transporter_name'] ?? '')),
            'transDocNo' => '',
            'transMode' => $transModeProvider,
            'transDistance' => $transDistance,
            'transDocDate' => '',
            'vehicleNo' => $vehicleNo,
            'vehicleType' => $vehicleTypeProvider,
            'itemList' => $itemList
        ];

        $cfg = EWayBillHelper::getDefaultConfig();
        $tokenResult = EWayBillHelper::request(
            'ACCESSTOKEN',
            [
                'gstin' => $ewbSettings['gstin'],
                'username' => $ewbSettings['username'],
                'ewbpwd' => $ewbSettings['ewbpwd']
            ],
            null,
            'GET',
            $cfg['auth_url']
        );

        if (!$tokenResult['success']) {
            ApiResponse::error(
                'Failed to get EWB access token: ' . EWayBillHelper::providerMessage($tokenResult['response']),
                400,
                ['provider_response' => $tokenResult['response']]
            );
        }

        $tokenResp = ewbDecodeProviderResponse($tokenResult['response']);
        $authToken = $tokenResp['authToken']
            ?? $tokenResp['authtoken']
            ?? $tokenResp['data']['authToken']
            ?? $tokenResp['data']['authtoken']
            ?? null;

        if (!$authToken) {
            ApiResponse::error('EWB access token not found in provider response', 400, ['provider_response' => $tokenResp]);
        }

        $genResult = EWayBillHelper::request(
            'GENEWAYBILL',
            [
                'gstin' => $ewbSettings['gstin'],
                'username' => $ewbSettings['username'],
                'ewbpwd' => $ewbSettings['ewbpwd'],
                'authtoken' => $authToken
            ],
            $ewbPayload,
            'POST'
        );

        if (!$genResult['success']) {
            ApiResponse::error(
                EWayBillHelper::providerMessage($genResult['response']),
                $genResult['http_code'] > 0 ? $genResult['http_code'] : 400,
                [
                    'provider_response' => $genResult['response'],
                    'ewb_payload' => $ewbPayload,
                    'provider_url' => $genResult['request_url']
                ]
            );
        }

        $genResp = ewbDecodeProviderResponse($genResult['response']);
        $ewbNo = $genResp['ewayBillNo'] ?? $genResp['EwbNo'] ?? $genResp['ewbNo'] ?? null;
        $ewbDate = $genResp['ewayBillDate'] ?? $genResp['EwbDt'] ?? date('Y-m-d H:i:s');
        $validUpto = $genResp['validUpto'] ?? $genResp['EwbValidTill'] ?? date('Y-m-d 23:59:59', strtotime('+1 day'));

        if (!$ewbNo) {
            ApiResponse::error('EWB number not found in provider response', 400, ['provider_response' => $genResp]);
        }

        $ewbDate = ewbNormaliseDate($ewbDate);
        $validUpto = ewbNormaliseDate($validUpto);

        $stmt = $pdo->prepare("\n            INSERT INTO ewaybill_log (
                voucher_id, ewb_no, ewb_date, valid_upto,
                transporter_id, transporter_name, vehicle_no, vehicle_type,
                trans_mode, trans_distance, status, api_response
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?)
        ");
        $stmt->execute([
            $voucherId,
            $ewbNo,
            $ewbDate,
            $validUpto,
            trim((string)($input['transporter_id'] ?? '')) ?: null,
            trim((string)($input['transporter_name'] ?? '')) ?: null,
            $vehicleNo,
            $vehicleTypeDb,
            $transModeDb,
            $transDistance,
            json_encode($genResp)
        ]);

        $logId = $pdo->lastInsertId();

        ApiResponse::success([
            'id' => $logId,
            'voucher_id' => $voucherId,
            'voucher_no' => $voucher['voucher_no'],
            'ewb_no' => $ewbNo,
            'ewb_date' => $ewbDate,
            'valid_upto' => $validUpto,
            'vehicle_no' => $vehicleNo,
            'trans_mode' => $transModeDb,
            'trans_distance' => $transDistance,
            'status' => 'generated'
        ], 'E-Way Bill generated successfully', 201);
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['ewb_no'])) {
            ApiResponse::error('E-Way Bill number is required');
        }

        $ewbNo = $input['ewb_no'];
        $stmt = $pdo->prepare("SELECT * FROM ewaybill_log WHERE ewb_no = ? AND status = 'generated'");
        $stmt->execute([$ewbNo]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            ApiResponse::error('Active E-Way Bill not found', 404);
        }

        if (strtotime($existing['valid_upto']) < time()) {
            ApiResponse::error('E-Way Bill has expired', 400);
        }

        $stmt = $pdo->prepare("\n            UPDATE ewaybill_log SET
                vehicle_no = COALESCE(?, vehicle_no),
                transporter_id = COALESCE(?, transporter_id),
                transporter_name = COALESCE(?, transporter_name),
                updated_at = NOW()
            WHERE ewb_no = ?
        ");
        $stmt->execute([
            $input['vehicle_no'] ?? null,
            $input['transporter_id'] ?? null,
            $input['transporter_name'] ?? null,
            $ewbNo
        ]);

        ApiResponse::success([
            'ewb_no' => $ewbNo,
            'vehicle_no' => $input['vehicle_no'] ?? $existing['vehicle_no'],
            'message' => 'E-Way Bill Part-B updated successfully'
        ], 'E-Way Bill updated successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('E-Way Bill API error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log('E-Way Bill API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
