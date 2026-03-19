<?php
/**
 * E-Way Bill Access Token API (CharteredInfo)
 *
 * POST body:
 * {
 *   "gstin": "33AAIFE9454A1ZN",
 *   "username": "earnestmin_API_buy",
 *   "ewbpwd": "eway@EMTS@123",
 *   "action": "ACCESSTOKEN",
 *   "http_method": "POST"
 * }
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/ewaybill.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        ApiResponse::error('Method not allowed', 405);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        ApiResponse::error('Invalid JSON data');
    }

    $required = ['gstin', 'username', 'ewbpwd'];
    $errors = [];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
            $errors[$field] = [strtoupper($field) . ' is required'];
        }
    }

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $gstinRaw = strtoupper(trim((string)$input['gstin']));
    $gstin = preg_replace('/[^A-Z0-9]/', '', $gstinRaw);
    $username = trim((string)$input['username']);
    $ewbpwd = trim((string)$input['ewbpwd']);

    if (strpos($gstinRaw, '{{') !== false || strpos($gstinRaw, '}}') !== false) {
        ApiResponse::validationError([
            'gstin' => ['GSTIN variable is unresolved. Select the correct Postman environment or provide raw GSTIN value.']
        ]);
    }

    if (!preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/', $gstin)) {
        ApiResponse::validationError([
            'gstin' => ['Invalid GSTIN format. Expected 15-character GSTIN (example: 33AAIFE9454A1ZN).']
        ]);
    }

    if (strpos($username, '{{') !== false || strpos($username, '}}') !== false) {
        ApiResponse::validationError([
            'username' => ['Username variable is unresolved. Select the correct Postman environment or provide raw username.']
        ]);
    }

    if (strpos($ewbpwd, '{{') !== false || strpos($ewbpwd, '}}') !== false) {
        ApiResponse::validationError([
            'ewbpwd' => ['EWB password variable is unresolved. Select the correct Postman environment or provide raw ewbpwd.']
        ]);
    }

    $action = 'ACCESSTOKEN';
    $aspid = isset($input['aspid']) ? trim((string)$input['aspid']) : null;
    $asppassword = isset($input['password']) ? trim((string)$input['password']) : null;
    $ewbConfig = EWayBillHelper::getDefaultConfig();
    $providerResult = EWayBillHelper::request(
        $action,
        [
            'aspid' => $aspid,
            'password' => $asppassword,
            'gstin' => $gstin,
            'username' => $username,
            'ewbpwd' => $ewbpwd
        ],
        isset($input['payload']) && is_array($input['payload']) ? $input['payload'] : null,
        $input['http_method'] ?? 'GET',
        $ewbConfig['auth_url']  // Access token uses /dec/auth, not /dec/ewayapi
    );

    if (!$providerResult['success']) {
        ApiResponse::error(
            EWayBillHelper::providerMessage($providerResult['response']),
            $providerResult['http_code'] > 0 ? $providerResult['http_code'] : 400,
            [
                'provider_response' => $providerResult['response'],
                'provider_url' => $providerResult['request_url'],
                'request_debug' => [
                    'action' => $action,
                    'aspid_length' => $aspid !== null ? strlen($aspid) : 0,
                    'gstin_raw' => $gstinRaw,
                    'gstin_sanitized' => $gstin,
                    'gstin_length' => strlen($gstin),
                    'username_length' => strlen($username)
                ]
            ]
        );
    }

    ApiResponse::success([
        'provider_response' => $providerResult['response'],
        'provider_url' => $providerResult['request_url']
    ], 'E-Way Bill access token fetched successfully');
} catch (PDOException $e) {
    error_log('E-Way access token API DB error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log('E-Way access token API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
