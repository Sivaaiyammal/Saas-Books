<?php
/**
 * Unit Conversion API
 *
 * Manages conversion rates between units
 * Example: 1 KG = 5 PCS, 1 Roll = 100 Meters
 *
 * Used for:
 * - Purchase in one unit (KG)
 * - Sales in another unit (PCS)
 * - Stock reports showing both units
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/validator.php';
require_once __DIR__ . '/../../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List conversions or get single or convert value
    if ($method === 'GET') {

        // Convert a value from one unit to another
        if (isset($_GET['convert'])) {
            $fromUnitId = (int)($_GET['from_unit'] ?? 0);
            $toUnitId = (int)($_GET['to_unit'] ?? 0);
            $quantity = (float)($_GET['quantity'] ?? 0);
            $itemId = isset($_GET['item_id']) ? (int)$_GET['item_id'] : null;

            if (!$fromUnitId || !$toUnitId || !$quantity) {
                ApiResponse::error('from_unit, to_unit and quantity are required');
            }

            $result = convertUnit($pdo, $fromUnitId, $toUnitId, $quantity, $itemId);
            if ($result === null) {
                ApiResponse::error('No conversion rate found between these units', 404);
            }

            ApiResponse::success($result, 'Conversion calculated successfully');
        }

        // Get conversions for a specific item
        if (isset($_GET['item_id'])) {
            $itemId = (int)$_GET['item_id'];

            $stmt = $pdo->prepare("
                SELECT uc.*,
                       uf.name as from_unit_name, uf.symbol as from_unit_symbol,
                       ut.name as to_unit_name, ut.symbol as to_unit_symbol
                FROM unit_conversions uc
                INNER JOIN units uf ON uc.from_unit_id = uf.id
                INNER JOIN units ut ON uc.to_unit_id = ut.id
                WHERE uc.item_id = ? AND uc.status = 'active'
                ORDER BY uf.name ASC
            ");
            $stmt->execute([$itemId]);
            $conversions = $stmt->fetchAll();

            ApiResponse::success(['conversions' => $conversions], 'Item conversions retrieved');
        }

        // Get single conversion
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("
                SELECT uc.*,
                       uf.name as from_unit_name, uf.symbol as from_unit_symbol,
                       ut.name as to_unit_name, ut.symbol as to_unit_symbol,
                       i.name as item_name
                FROM unit_conversions uc
                INNER JOIN units uf ON uc.from_unit_id = uf.id
                INNER JOIN units ut ON uc.to_unit_id = ut.id
                LEFT JOIN items i ON uc.item_id = i.id
                WHERE uc.id = ? AND uc.status = 'active'
            ");
            $stmt->execute([(int)$_GET['id']]);
            $conversion = $stmt->fetch();

            if (!$conversion) {
                ApiResponse::error('Conversion not found', 404);
            }
            ApiResponse::success($conversion, 'Conversion retrieved successfully');
        }

        // List all conversions
        $search = $_GET['search'] ?? '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $where = ["uc.status = 'active'"];
        $params = [];

        if ($search) {
            $where[] = "(uf.name LIKE ? OR ut.name LIKE ? OR i.name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM unit_conversions uc
            INNER JOIN units uf ON uc.from_unit_id = uf.id
            INNER JOIN units ut ON uc.to_unit_id = ut.id
            LEFT JOIN items i ON uc.item_id = i.id
            WHERE $whereClause
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $pdo->prepare("
            SELECT uc.*,
                   uf.name as from_unit_name, uf.symbol as from_unit_symbol,
                   ut.name as to_unit_name, ut.symbol as to_unit_symbol,
                   i.name as item_name, i.item_code
            FROM unit_conversions uc
            INNER JOIN units uf ON uc.from_unit_id = uf.id
            INNER JOIN units ut ON uc.to_unit_id = ut.id
            LEFT JOIN items i ON uc.item_id = i.id
            WHERE $whereClause
            ORDER BY COALESCE(i.name, 'ZZZZZ') ASC, uf.name ASC
            LIMIT ? OFFSET ?
        ");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $conversions = $stmt->fetchAll();

        ApiResponse::success([
            'conversions' => $conversions,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ], 'Conversions retrieved successfully');
    }

    // POST: Create new conversion
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        $rules = [
            'from_unit_id' => 'required',
            'to_unit_id' => 'required',
            'conversion_rate' => 'required'
        ];
        $errors = Validator::validate($input, $rules);
        if (!empty($errors)) {
            ApiResponse::validationError($errors);
        }

        $fromUnitId = (int)$input['from_unit_id'];
        $toUnitId = (int)$input['to_unit_id'];
        $conversionRate = (float)$input['conversion_rate'];
        $itemId = isset($input['item_id']) ? (int)$input['item_id'] : null;

        if ($fromUnitId === $toUnitId) {
            ApiResponse::validationError(['to_unit_id' => ['From and To units cannot be same']]);
        }

        if ($conversionRate <= 0) {
            ApiResponse::validationError(['conversion_rate' => ['Conversion rate must be greater than 0']]);
        }

        // Validate units exist
        $stmt = $pdo->prepare("SELECT id FROM units WHERE id IN (?, ?) AND status = 'active'");
        $stmt->execute([$fromUnitId, $toUnitId]);
        if ($stmt->rowCount() !== 2) {
            ApiResponse::validationError(['units' => ['One or both units not found']]);
        }

        // Check for duplicate conversion
        $stmt = $pdo->prepare("
            SELECT id FROM unit_conversions
            WHERE from_unit_id = ? AND to_unit_id = ? AND (item_id = ? OR (item_id IS NULL AND ? IS NULL))
            AND status = 'active'
        ");
        $stmt->execute([$fromUnitId, $toUnitId, $itemId, $itemId]);
        if ($stmt->fetch()) {
            ApiResponse::validationError(['conversion' => ['This conversion already exists']]);
        }

        $pdo->beginTransaction();
        try {
            // Create main conversion
            $stmt = $pdo->prepare("
                INSERT INTO unit_conversions (from_unit_id, to_unit_id, conversion_rate, item_id, status, created_at)
                VALUES (?, ?, ?, ?, 'active', NOW())
            ");
            $stmt->execute([$fromUnitId, $toUnitId, $conversionRate, $itemId]);
            $conversionId = $pdo->lastInsertId();

            // Create reverse conversion automatically
            $reverseRate = 1 / $conversionRate;
            $stmt = $pdo->prepare("
                INSERT INTO unit_conversions (from_unit_id, to_unit_id, conversion_rate, item_id, status, created_at)
                VALUES (?, ?, ?, ?, 'active', NOW())
            ");
            $stmt->execute([$toUnitId, $fromUnitId, $reverseRate, $itemId]);

            $pdo->commit();

            // Fetch created conversion
            $stmt = $pdo->prepare("
                SELECT uc.*,
                       uf.name as from_unit_name, uf.symbol as from_unit_symbol,
                       ut.name as to_unit_name, ut.symbol as to_unit_symbol
                FROM unit_conversions uc
                INNER JOIN units uf ON uc.from_unit_id = uf.id
                INNER JOIN units ut ON uc.to_unit_id = ut.id
                WHERE uc.id = ?
            ");
            $stmt->execute([$conversionId]);
            $conversion = $stmt->fetch();

            ApiResponse::success($conversion, 'Conversion created successfully', 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // PUT: Update conversion
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            ApiResponse::error('Invalid JSON data');
        }

        if (!isset($input['id'])) {
            ApiResponse::error('Conversion ID is required');
        }

        $id = (int)$input['id'];

        $stmt = $pdo->prepare("SELECT * FROM unit_conversions WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            ApiResponse::error('Conversion not found', 404);
        }

        $conversionRate = isset($input['conversion_rate']) ? (float)$input['conversion_rate'] : $existing['conversion_rate'];

        if ($conversionRate <= 0) {
            ApiResponse::validationError(['conversion_rate' => ['Conversion rate must be greater than 0']]);
        }

        $pdo->beginTransaction();
        try {
            // Update main conversion
            $stmt = $pdo->prepare("UPDATE unit_conversions SET conversion_rate = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$conversionRate, $id]);

            // Update reverse conversion
            $reverseRate = 1 / $conversionRate;
            $stmt = $pdo->prepare("
                UPDATE unit_conversions
                SET conversion_rate = ?, updated_at = NOW()
                WHERE from_unit_id = ? AND to_unit_id = ?
                AND (item_id = ? OR (item_id IS NULL AND ? IS NULL))
                AND status = 'active'
            ");
            $stmt->execute([$reverseRate, $existing['to_unit_id'], $existing['from_unit_id'], $existing['item_id'], $existing['item_id']]);

            $pdo->commit();

            $stmt = $pdo->prepare("
                SELECT uc.*,
                       uf.name as from_unit_name, uf.symbol as from_unit_symbol,
                       ut.name as to_unit_name, ut.symbol as to_unit_symbol
                FROM unit_conversions uc
                INNER JOIN units uf ON uc.from_unit_id = uf.id
                INNER JOIN units ut ON uc.to_unit_id = ut.id
                WHERE uc.id = ?
            ");
            $stmt->execute([$id]);
            $conversion = $stmt->fetch();

            ApiResponse::success($conversion, 'Conversion updated successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // DELETE: Soft delete conversion
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!isset($input['id']) && !isset($_GET['id'])) {
            ApiResponse::error('Conversion ID is required');
        }

        $id = (int)($input['id'] ?? $_GET['id']);

        $stmt = $pdo->prepare("SELECT * FROM unit_conversions WHERE id = ? AND status = 'active'");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            ApiResponse::error('Conversion not found', 404);
        }

        $pdo->beginTransaction();
        try {
            // Delete main conversion
            $stmt = $pdo->prepare("UPDATE unit_conversions SET status = 'inactive', updated_at = NOW() WHERE id = ?");
            $stmt->execute([$id]);

            // Delete reverse conversion
            $stmt = $pdo->prepare("
                UPDATE unit_conversions
                SET status = 'inactive', updated_at = NOW()
                WHERE from_unit_id = ? AND to_unit_id = ?
                AND (item_id = ? OR (item_id IS NULL AND ? IS NULL))
                AND status = 'active'
            ");
            $stmt->execute([$existing['to_unit_id'], $existing['from_unit_id'], $existing['item_id'], $existing['item_id']]);

            $pdo->commit();

            ApiResponse::success(null, 'Conversion deleted successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Unit Conversion API error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Database error occurred');
} catch (Exception $e) {
    error_log("Unit Conversion API exception: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError($e->getMessage());
}

/**
 * Convert quantity from one unit to another
 */
function convertUnit($pdo, $fromUnitId, $toUnitId, $quantity, $itemId = null) {
    // If same unit, return as is
    if ($fromUnitId === $toUnitId) {
        return [
            'original_quantity' => $quantity,
            'converted_quantity' => $quantity,
            'conversion_rate' => 1
        ];
    }

    // Try item-specific conversion first
    if ($itemId) {
        $stmt = $pdo->prepare("
            SELECT conversion_rate FROM unit_conversions
            WHERE from_unit_id = ? AND to_unit_id = ? AND item_id = ? AND status = 'active'
        ");
        $stmt->execute([$fromUnitId, $toUnitId, $itemId]);
        $conversion = $stmt->fetch();

        if ($conversion) {
            return [
                'original_quantity' => $quantity,
                'converted_quantity' => round($quantity * $conversion['conversion_rate'], 4),
                'conversion_rate' => $conversion['conversion_rate'],
                'conversion_type' => 'item_specific'
            ];
        }
    }

    // Try global conversion
    $stmt = $pdo->prepare("
        SELECT conversion_rate FROM unit_conversions
        WHERE from_unit_id = ? AND to_unit_id = ? AND item_id IS NULL AND status = 'active'
    ");
    $stmt->execute([$fromUnitId, $toUnitId]);
    $conversion = $stmt->fetch();

    if ($conversion) {
        return [
            'original_quantity' => $quantity,
            'converted_quantity' => round($quantity * $conversion['conversion_rate'], 4),
            'conversion_rate' => $conversion['conversion_rate'],
            'conversion_type' => 'global'
        ];
    }

    return null;
}
