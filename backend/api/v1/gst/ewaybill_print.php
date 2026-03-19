<?php
/**
 * E-Way Bill Print API (CharteredInfo)
 *
 * Supports GET with query params or POST with JSON body.
 */

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
require_once __DIR__ . '/../../../helpers/ewaybill.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'GET' && $method !== 'POST') {
        ApiResponse::error('Method not allowed', 405);
    }

    $input = [];
    if ($method === 'GET') {
        $input = $_GET;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }
    }

    $errors = [];
    foreach (['gstin', 'username', 'authtoken', 'ewbNo'] as $field) {
        if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
            $errors[$field] = [$field . ' is required'];
        }
    }

    if (!empty($errors)) {
        ApiResponse::validationError($errors);
    }

    $action = $input['action'] ?? 'PRINTEWB';

    $providerPayload = null;
    if (isset($input['payload']) && is_array($input['payload'])) {
        $providerPayload = $input['payload'];
    }

    if ($providerPayload === null) {
        $providerPayload = [
            'ewbNo' => trim((string)$input['ewbNo'])
        ];
    }

    $providerResult = EWayBillHelper::request(
        $action,
        [
            'aspid' => isset($input['aspid']) ? trim((string)$input['aspid']) : null,
            'password' => isset($input['password']) ? trim((string)$input['password']) : null,
            'gstin' => trim((string)$input['gstin']),
            'username' => trim((string)$input['username']),
            'authtoken' => trim((string)$input['authtoken'])
        ],
        $providerPayload,
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

    ApiResponse::success([
        'provider_response' => $providerResult['response'],
        'provider_url' => $providerResult['request_url']
    ], 'E-Way Bill print response fetched successfully');
} catch (PDOException $e) {
    error_log('E-Way print API DB error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log('E-Way print API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
