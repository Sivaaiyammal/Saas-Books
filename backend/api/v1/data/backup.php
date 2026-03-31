<?php
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

try {
    $pdo = getDBConnection();
    $user = AuthMiddleware::authenticate();
    $companyId = TenantHelper::getCompanyId($user, $_GET['company_id'] ?? null);
    $method = $_SERVER['REQUEST_METHOD'];

    // ── GET: Export backup ───────────────────────────────────────────────────
    if ($method === 'GET') {
        $scope    = $_GET['scope']     ?? 'all';
        $fromDate = $_GET['from_date'] ?? null;
        $toDate   = $_GET['to_date']   ?? null;

        $backup = [
            'version'     => '1.0',
            'company_id'  => $companyId,
            'exported_at' => date('Y-m-d H:i:s'),
            'scope'       => $scope,
        ];

        if ($scope === 'all' || $scope === 'masters') {
            $tables = [
                'ledgers'         => "SELECT * FROM ledgers WHERE company_id <=> ?",
                'groups'          => "SELECT * FROM `groups` WHERE company_id <=> ?",
                'stock_items'     => "SELECT * FROM stock_items WHERE company_id <=> ?",
                'units'           => "SELECT * FROM units WHERE company_id <=> ?",
                'taxes'           => "SELECT * FROM taxes WHERE company_id <=> ?",
                'financial_years' => "SELECT * FROM financial_years WHERE company_id <=> ?",
            ];

            foreach ($tables as $key => $sql) {
                try {
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$companyId]);
                    $backup[$key] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (PDOException $e) {
                    // Table may not exist in all deployments — skip gracefully
                    $backup[$key] = [];
                }
            }
        }

        if ($scope === 'all' || $scope === 'vouchers') {
            $voucherWhere  = "v.company_id = ?";
            $voucherParams = [$companyId];

            if ($fromDate) {
                $voucherWhere   .= " AND v.voucher_date >= ?";
                $voucherParams[] = $fromDate;
            }
            if ($toDate) {
                $voucherWhere   .= " AND v.voucher_date <= ?";
                $voucherParams[] = $toDate;
            }

            $stmt = $pdo->prepare(
                "SELECT * FROM vouchers v WHERE $voucherWhere ORDER BY v.voucher_date, v.id"
            );
            $stmt->execute($voucherParams);
            $vouchers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($vouchers)) {
                $voucherIds   = array_column($vouchers, 'id');
                $placeholders = implode(',', array_fill(0, count($voucherIds), '?'));

                $stmt = $pdo->prepare("SELECT * FROM voucher_items WHERE voucher_id IN ($placeholders)");
                $stmt->execute($voucherIds);
                $allItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $itemsByVoucher = [];
                foreach ($allItems as $item) {
                    $itemsByVoucher[$item['voucher_id']][] = $item;
                }
                foreach ($vouchers as &$voucher) {
                    $voucher['items'] = $itemsByVoucher[$voucher['id']] ?? [];
                }
                unset($voucher);
            }

            $backup['vouchers'] = $vouchers;
        }

        ApiResponse::success($backup, 'Backup created successfully');
    }

    // ── POST: Restore backup ─────────────────────────────────────────────────
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($input['version'])) {
            ApiResponse::error('Invalid backup file format', 400);
        }

        $pdo->beginTransaction();
        try {
            $restored = [];

            // Helper: upsert rows into a table, forcing company_id
            $upsert = function (string $table, array $rows) use ($pdo, $companyId): void {
                foreach ($rows as $row) {
                    $row['company_id'] = $companyId;
                    $cols         = implode(', ', array_map(fn($c) => "`$c`", array_keys($row)));
                    $placeholders = implode(', ', array_fill(0, count($row), '?'));
                    $updates      = implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", array_keys($row)));
                    $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($placeholders) ON DUPLICATE KEY UPDATE $updates")
                        ->execute(array_values($row));
                }
            };

            foreach (['ledgers', 'units', 'taxes', 'financial_years'] as $table) {
                if (!empty($input[$table])) {
                    $upsert($table, $input[$table]);
                    $restored[] = $table;
                }
            }

            if (!empty($input['vouchers'])) {
                foreach ($input['vouchers'] as $voucher) {
                    $items = $voucher['items'] ?? [];
                    unset($voucher['items']);
                    $voucher['company_id'] = $companyId;

                    $cols         = implode(', ', array_map(fn($c) => "`$c`", array_keys($voucher)));
                    $placeholders = implode(', ', array_fill(0, count($voucher), '?'));
                    $updates      = implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", array_keys($voucher)));
                    $pdo->prepare("INSERT INTO vouchers ($cols) VALUES ($placeholders) ON DUPLICATE KEY UPDATE $updates")
                        ->execute(array_values($voucher));

                    foreach ($items as $item) {
                        $item['voucher_id'] = $voucher['id'];
                        $iCols         = implode(', ', array_map(fn($c) => "`$c`", array_keys($item)));
                        $iPlaceholders = implode(', ', array_fill(0, count($item), '?'));
                        $iUpdates      = implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", array_keys($item)));
                        $pdo->prepare("INSERT INTO voucher_items ($iCols) VALUES ($iPlaceholders) ON DUPLICATE KEY UPDATE $iUpdates")
                            ->execute(array_values($item));
                    }
                }
                $restored[] = 'vouchers';
            }

            $pdo->commit();
            ApiResponse::success(['restored' => $restored], 'Data restored successfully');
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);
} catch (Exception $e) {
    error_log("Backup API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}
