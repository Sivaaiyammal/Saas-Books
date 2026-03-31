<?php
/**
 * E-Invoice Generation API
 *
 * Flow:
 * 1. Sales Voucher Created
 * 2. Validate GST fields (GSTIN, HSN, etc.)
 * 3. Generate E-Invoice JSON as per GST portal format
 * 4. Send to IRP (Invoice Registration Portal) API
 * 5. Store IRN, Signed Invoice, QR Code
 *
 * Note: This is a template. Actual IRP API integration requires:
 * - GSP (GST Suvidha Provider) credentials
 * - Valid GSTIN registration
 * - Production/Sandbox API endpoints
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Check E-Invoice status
    if ($method === 'GET') {
        $voucherId = $_GET['voucher_id'] ?? null;

        if (!$voucherId) {
            ApiResponse::error('Voucher ID is required');
        }

        $stmt = $pdo->prepare("
            SELECT el.*, v.voucher_no, v.voucher_date, v.total_amount
            FROM einvoice_log el
            INNER JOIN vouchers v ON el.voucher_id = v.id
            WHERE el.voucher_id = ?
            ORDER BY el.id DESC LIMIT 1
        ");
        $stmt->execute([$voucherId]);
        $einvoice = $stmt->fetch();

        if (!$einvoice) {
            ApiResponse::success(['status' => 'not_generated'], 'E-Invoice not yet generated');
        }

        ApiResponse::success($einvoice, 'E-Invoice status retrieved');
    }

    // POST: Generate E-Invoice
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!isset($input['voucher_id'])) {
            ApiResponse::error('Voucher ID is required');
        }

        $voucherId = (int)$input['voucher_id'];

        // Get voucher details
        $stmt = $pdo->prepare("
            SELECT v.*,
                   l.name as buyer_name,
                   l.gst_number as buyer_gstin,
                   l.address as buyer_address,
                   l.phone as buyer_phone,
                   l.email as buyer_email
            FROM vouchers v
            INNER JOIN ledgers l ON v.party_ledger_id = l.id
            WHERE v.id = ? AND v.voucher_type = 'Sales' AND v.status = 'posted'
        ");
        $stmt->execute([$voucherId]);
        $voucher = $stmt->fetch();

        if (!$voucher) {
            ApiResponse::error('Valid posted sales voucher not found', 404);
        }

        // Check if already generated
        $stmt = $pdo->prepare("
            SELECT * FROM einvoice_log
            WHERE voucher_id = ? AND status = 'generated'
        ");
        $stmt->execute([$voucherId]);
        if ($stmt->fetch()) {
            ApiResponse::error('E-Invoice already generated for this voucher', 400);
        }

        // Validate GST fields
        $errors = [];
        if (empty($voucher['buyer_gstin'])) {
            $errors[] = 'Buyer GSTIN is required';
        }

        // Get items with HSN codes
        $stmt = $pdo->prepare("
            SELECT vi.*, i.hsn_code
            FROM voucher_items vi
            LEFT JOIN items i ON vi.product_id = i.id
            WHERE vi.voucher_id = ?
        ");
        $stmt->execute([$voucherId]);
        $items = $stmt->fetchAll();

        foreach ($items as $idx => $item) {
            if (empty($item['hsn_code'])) {
                $errors[] = "Item #{$idx}: HSN code is required for E-Invoice";
            }
        }

        if (!empty($errors)) {
            ApiResponse::validationError(['gst_validation' => $errors]);
        }

        // Company details (should come from settings)
        $companyGstin = $input['company_gstin'] ?? '29AABCU9603R1ZM'; // Example
        $companyName = $input['company_name'] ?? "Saas Books";
        $companyAddress = $input['company_address'] ?? 'Bangalore, Karnataka';
        $companyState = $input['company_state'] ?? 'Karnataka';
        $companyStateCode = $input['company_state_code'] ?? '29';

        // Build E-Invoice JSON (as per GST E-Invoice Schema)
        $einvoiceData = [
            'Version' => '1.1',
            'TranDtls' => [
                'TaxSch' => 'GST',
                'SupTyp' => 'B2B', // B2B, B2C, SEZWP, SEZWOP, EXPWP, EXPWOP, DEXP
                'RegRev' => 'N',
                'EcmGstin' => null,
                'IgstOnIntra' => 'N'
            ],
            'DocDtls' => [
                'Typ' => 'INV', // INV, CRN, DBN
                'No' => $voucher['voucher_no'],
                'Dt' => date('d/m/Y', strtotime($voucher['voucher_date']))
            ],
            'SellerDtls' => [
                'Gstin' => $companyGstin,
                'LglNm' => $companyName,
                'TrdNm' => $companyName,
                'Addr1' => $companyAddress,
                'Loc' => 'Bangalore',
                'Pin' => 560001,
                'Stcd' => $companyStateCode
            ],
            'BuyerDtls' => [
                'Gstin' => $voucher['buyer_gstin'],
                'LglNm' => $voucher['buyer_name'],
                'TrdNm' => $voucher['buyer_name'],
                'Addr1' => $voucher['buyer_address'] ?? 'NA',
                'Loc' => 'NA',
                'Pin' => 560001,
                'Stcd' => '29', // Should be derived from GSTIN
                'Ph' => $voucher['buyer_phone'],
                'Em' => $voucher['buyer_email']
            ],
            'ItemList' => [],
            'ValDtls' => [
                'AssVal' => 0,
                'CgstVal' => 0,
                'SgstVal' => 0,
                'IgstVal' => 0,
                'CesVal' => 0,
                'StCesVal' => 0,
                'Discount' => 0,
                'OthChrg' => 0,
                'RndOffAmt' => 0,
                'TotInvVal' => floatval($voucher['total_amount'])
            ]
        ];

        // Add items
        $slNo = 1;
        $totalAssVal = 0;
        $totalCgst = 0;
        $totalSgst = 0;
        $totalIgst = 0;
        $totalDiscount = 0;

        foreach ($items as $item) {
            $taxableVal = floatval($item['quantity']) * floatval($item['rate']) - floatval($item['discount_amount']);
            $cgstAmt = round($taxableVal * floatval($item['tax_percent']) / 2 / 100, 2);
            $sgstAmt = round($taxableVal * floatval($item['tax_percent']) / 2 / 100, 2);
            $igstAmt = 0; // For same state

            $einvoiceData['ItemList'][] = [
                'SlNo' => (string)$slNo,
                'PrdDesc' => $item['item_name'],
                'IsServc' => 'N',
                'HsnCd' => $item['hsn_code'],
                'Qty' => floatval($item['quantity']),
                'Unit' => 'MTR', // Should be mapped from unit_id
                'UnitPrice' => floatval($item['rate']),
                'TotAmt' => floatval($item['quantity']) * floatval($item['rate']),
                'Discount' => floatval($item['discount_amount']),
                'AssAmt' => $taxableVal,
                'GstRt' => floatval($item['tax_percent']),
                'CgstAmt' => $cgstAmt,
                'SgstAmt' => $sgstAmt,
                'IgstAmt' => $igstAmt,
                'CesRt' => 0,
                'CesAmt' => 0,
                'CesNonAdvlAmt' => 0,
                'StateCesRt' => 0,
                'StateCesAmt' => 0,
                'StateCesNonAdvlAmt' => 0,
                'OthChrg' => 0,
                'TotItemVal' => $taxableVal + $cgstAmt + $sgstAmt + $igstAmt
            ];

            $totalAssVal += $taxableVal;
            $totalCgst += $cgstAmt;
            $totalSgst += $sgstAmt;
            $totalIgst += $igstAmt;
            $totalDiscount += floatval($item['discount_amount']);
            $slNo++;
        }

        $einvoiceData['ValDtls']['AssVal'] = round($totalAssVal, 2);
        $einvoiceData['ValDtls']['CgstVal'] = round($totalCgst, 2);
        $einvoiceData['ValDtls']['SgstVal'] = round($totalSgst, 2);
        $einvoiceData['ValDtls']['IgstVal'] = round($totalIgst, 2);
        $einvoiceData['ValDtls']['Discount'] = round($totalDiscount, 2);

        // In production: Send to IRP API
        // $irpResponse = sendToIRP($einvoiceData);

        // For demo: Generate mock response
        $mockIrn = 'IRN' . strtoupper(md5($voucher['voucher_no'] . time()));
        $mockAckNo = rand(100000000000, 999999999999);
        $mockQrCode = base64_encode(json_encode([
            'SellerGstin' => $companyGstin,
            'BuyerGstin' => $voucher['buyer_gstin'],
            'DocNo' => $voucher['voucher_no'],
            'DocTyp' => 'INV',
            'DocDt' => $voucher['voucher_date'],
            'TotInvVal' => $voucher['total_amount'],
            'Irn' => $mockIrn
        ]));

        // Store in database
        $stmt = $pdo->prepare("
            INSERT INTO einvoice_log (
                voucher_id, irn, ack_no, ack_date, signed_qr_code,
                status, api_response
            ) VALUES (?, ?, ?, NOW(), ?, 'generated', ?)
        ");

        $stmt->execute([
            $voucherId,
            $mockIrn,
            $mockAckNo,
            $mockQrCode,
            json_encode($einvoiceData)
        ]);

        $logId = $pdo->lastInsertId();

        ApiResponse::success([
            'id' => $logId,
            'voucher_id' => $voucherId,
            'voucher_no' => $voucher['voucher_no'],
            'irn' => $mockIrn,
            'ack_no' => $mockAckNo,
            'ack_date' => date('Y-m-d H:i:s'),
            'qr_code' => $mockQrCode,
            'status' => 'generated',
            'message' => 'E-Invoice generated successfully (Demo Mode)',
            'einvoice_json' => $einvoiceData
        ], 'E-Invoice generated successfully', 201);
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("E-Invoice API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("E-Invoice API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
