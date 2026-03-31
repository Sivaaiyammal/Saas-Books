<?php
/**
 * EWB Settings API
 *
 * GET  → return current settings (ewbpwd is masked)
 * POST → create or update settings
 *
 * POST body:
 * {
 *   "gstin":           "33AAIFE9454A1ZN",
 *   "username":        "earnestmin_API_buy",
 *   "ewbpwd":          "eway@EMTS@123",
 *   "from_trade_name": "Saas Books",
 *   "from_addr1":      "123, Main Road",
 *   "from_addr2":      "Near Bus Stand",
 *   "from_place":      "Tiruppur",
 *   "from_state":      "Tamil Nadu",
 *   "from_pincode":    641603,
 *   "from_state_code": 33
 * }
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Financial-Year-Id');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/tenant.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

function ewbSettingsHasFromStateColumn(PDO $pdo): bool {
    static $hasColumn = null;
    if ($hasColumn !== null) {
        return $hasColumn;
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM ewb_settings LIKE 'from_state'");
    $hasColumn = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
    return $hasColumn;
}

try {
    $pdo       = getDBConnection();
    $companyId = TenantHelper::getCompanyId($user);
    $method    = $_SERVER['REQUEST_METHOD'];

    // Ensure required columns exist on ewb_settings
    try {
        $existingCols = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ewb_settings'");
        $existingCols->execute();
        $cols = array_column($existingCols->fetchAll(PDO::FETCH_ASSOC), 'COLUMN_NAME');

        if (!in_array('company_id', $cols)) {
            $pdo->exec("ALTER TABLE ewb_settings ADD COLUMN company_id INT NULL");
            $pdo->exec("ALTER TABLE ewb_settings ADD INDEX idx_ewb_company (company_id)");
        }
        if (!in_array('email', $cols)) {
            $pdo->exec("ALTER TABLE ewb_settings ADD COLUMN email VARCHAR(255) NULL");
        }
        if (!in_array('phone', $cols)) {
            $pdo->exec("ALTER TABLE ewb_settings ADD COLUMN phone VARCHAR(50) NULL");
        }
    } catch (Exception $e) {
        error_log('ewb_settings migration error: ' . $e->getMessage());
    }

    // ── GET ──────────────────────────────────────────────────────────────────
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM ewb_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$companyId]);
        $row  = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            ApiResponse::success(null, 'EWB settings not configured yet');
        }

        // Mask password before returning
        $row['ewbpwd'] = str_repeat('*', 8);
        ApiResponse::success($row, 'EWB settings fetched');
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $required = ['gstin', 'from_trade_name', 'from_addr1', 'from_place', 'from_state', 'from_pincode', 'from_state_code'];
        $errors   = [];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
                $errors[$field] = [$field . ' is required'];
            }
        }
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $gstin          = strtoupper(preg_replace('/[^A-Z0-9]/i', '', trim($input['gstin'])));
        $username       = trim($input['username'] ?? '');
        $ewbpwdInput    = trim((string)($input['ewbpwd'] ?? ''));
        $fromTradeName  = trim($input['from_trade_name']);
        $email          = trim($input['email'] ?? '');
        $phone          = trim($input['phone'] ?? '');
        $fromAddr1      = trim($input['from_addr1']);
        $fromAddr2      = trim($input['from_addr2'] ?? '');
        $fromPlace      = trim($input['from_place']);
        $fromState      = trim($input['from_state']);
        $fromPincode    = (int)$input['from_pincode'];
        $fromStateCode  = (int)$input['from_state_code'];
        $hasFromStateColumn = ewbSettingsHasFromStateColumn($pdo);

        if (!preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/', $gstin)) {
            ApiResponse::validationError(['gstin' => ['Invalid GSTIN format (expected 15-character GSTIN)']]);
        }

        // Check for existing row for this company
        $stmt     = $pdo->prepare("SELECT id, ewbpwd, username FROM ewb_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$companyId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        $ewbpwd = $ewbpwdInput;
        if ($existing && $ewbpwdInput === '') {
            $ewbpwd = $existing['ewbpwd'];
        }

        // Preserve existing username if not provided in this request
        if ($username === '' && $existing && !empty($existing['username'])) {
            $username = $existing['username'];
        }

        if ($existing) {
            // Update
            if ($hasFromStateColumn) {
                $stmt = $pdo->prepare("
                    UPDATE ewb_settings SET
                        gstin           = ?,
                        username        = ?,
                        ewbpwd          = ?,
                        from_trade_name = ?,
                        email           = ?,
                        phone           = ?,
                        from_addr1      = ?,
                        from_addr2      = ?,
                        from_place      = ?,
                        from_state      = ?,
                        from_pincode    = ?,
                        from_state_code = ?,
                        updated_at      = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([
                    $gstin, $username, $ewbpwd,
                    $fromTradeName, $email ?: null, $phone ?: null,
                    $fromAddr1, $fromAddr2,
                    $fromPlace, $fromState, $fromPincode, $fromStateCode,
                    $existing['id']
                ]);
            } else {
                $stmt = $pdo->prepare("
                    UPDATE ewb_settings SET
                        gstin           = ?,
                        username        = ?,
                        ewbpwd          = ?,
                        from_trade_name = ?,
                        email           = ?,
                        phone           = ?,
                        from_addr1      = ?,
                        from_addr2      = ?,
                        from_place      = ?,
                        from_pincode    = ?,
                        from_state_code = ?,
                        updated_at      = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([
                    $gstin, $username, $ewbpwd,
                    $fromTradeName, $email ?: null, $phone ?: null,
                    $fromAddr1, $fromAddr2,
                    $fromPlace, $fromPincode, $fromStateCode,
                    $existing['id']
                ]);
            }
            $settingsId = $existing['id'];
        } else {
            // Insert
            if ($hasFromStateColumn) {
                $stmt = $pdo->prepare("
                    INSERT INTO ewb_settings
                        (company_id, gstin, username, ewbpwd, from_trade_name, email, phone, from_addr1, from_addr2, from_place, from_state, from_pincode, from_state_code)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $companyId,
                    $gstin, $username, $ewbpwd,
                    $fromTradeName, $email ?: null, $phone ?: null,
                    $fromAddr1, $fromAddr2,
                    $fromPlace, $fromState, $fromPincode, $fromStateCode
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO ewb_settings
                        (company_id, gstin, username, ewbpwd, from_trade_name, email, phone, from_addr1, from_addr2, from_place, from_pincode, from_state_code)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $companyId,
                    $gstin, $username, $ewbpwd,
                    $fromTradeName, $email ?: null, $phone ?: null,
                    $fromAddr1, $fromAddr2,
                    $fromPlace, $fromPincode, $fromStateCode
                ]);
            }
            $settingsId = $pdo->lastInsertId();
        }

        ApiResponse::success(['id' => $settingsId], 'EWB settings saved successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log('EWB settings API DB error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log('EWB settings API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
