<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../helpers/apiResponse.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = AuthMiddleware::authenticate();

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];
    $userId = (int)$user['id'];

    $toBool = function ($value) {
        if (is_bool($value)) {
            return $value;
        }

        $value = strtolower(trim((string)$value));
        return in_array($value, ['1', 'true', 'yes', 'y'], true);
    };

    $buildCompanyCondition = function ($companyId) {
        if ($companyId > 0) {
            return ["(n.company_id = ? OR n.company_id IS NULL)", [$companyId]];
        }

        return ["1=1", []];
    };

    if ($method === 'GET') {
        $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        $unreadOnly = isset($_GET['unread_only']) ? $toBool($_GET['unread_only']) : false;
        $countOnly = isset($_GET['count_only']) ? $toBool($_GET['count_only']) : false;
        $type = isset($_GET['type']) ? strtolower(trim((string)$_GET['type'])) : '';

        list($companyWhere, $companyParams) = $buildCompanyCondition($companyId);

        if ($countOnly) {
            $stmt = $pdo->prepare("SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
                FROM notifications n
                WHERE n.user_id = ?
                  AND n.status = 'active'
                  AND $companyWhere");
            $stmt->execute(array_merge([$userId], $companyParams));
            $counts = $stmt->fetch();

            ApiResponse::success([
                'total' => (int)($counts['total'] ?? 0),
                'unread' => (int)($counts['unread'] ?? 0)
            ], 'Notification counts retrieved successfully');
        }

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $where = ["n.user_id = ?", "n.status = 'active'", $companyWhere];
        $params = array_merge([$userId], $companyParams);

        if ($unreadOnly) {
            $where[] = 'n.is_read = 0';
        }

        if ($type && in_array($type, ['info', 'success', 'warning', 'error'], true)) {
            $where[] = 'n.notification_type = ?';
            $params[] = $type;
        }

        $whereClause = implode(' AND ', $where);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications n WHERE $whereClause");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT
                n.id,
                n.title,
                n.message,
                n.notification_type,
                n.meta_json,
                n.company_id,
                n.is_read,
                n.read_at,
                n.created_at
            FROM notifications n
            WHERE $whereClause
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT ? OFFSET ?");

        $queryParams = $params;
        $queryParams[] = $limit;
        $queryParams[] = $offset;
        $stmt->execute($queryParams);
        $notifications = $stmt->fetchAll();

        foreach ($notifications as &$notification) {
            $notification['is_read'] = (bool)$notification['is_read'];
            $notification['meta'] = !empty($notification['meta_json']) ? json_decode($notification['meta_json'], true) : null;
            unset($notification['meta_json']);
        }

        $unreadStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications n
            WHERE n.user_id = ?
              AND n.status = 'active'
              AND n.is_read = 0
              AND $companyWhere");
        $unreadStmt->execute(array_merge([$userId], $companyParams));
        $unreadCount = (int)$unreadStmt->fetchColumn();

        ApiResponse::success([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => (int)ceil($total / $limit)
            ]
        ], 'Notifications retrieved successfully');
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
            ApiResponse::error('Invalid JSON data');
        }

        $title = isset($input['title']) ? trim((string)$input['title']) : '';
        $message = isset($input['message']) ? trim((string)$input['message']) : '';
        $notificationType = isset($input['notification_type']) ? strtolower(trim((string)$input['notification_type'])) : 'info';
        $companyId = isset($input['company_id']) ? (int)$input['company_id'] : 0;
        $recipientUserId = isset($input['user_id']) ? (int)$input['user_id'] : $userId;
        $meta = $input['meta'] ?? null;

        if ($title === '') {
            ApiResponse::validationError(['title' => ['Title is required']]);
        }

        if ($message === '') {
            ApiResponse::validationError(['message' => ['Message is required']]);
        }

        if (!in_array($notificationType, ['info', 'success', 'warning', 'error'], true)) {
            ApiResponse::validationError(['notification_type' => ['Invalid notification type']]);
        }

        if ($recipientUserId !== $userId) {
            ApiResponse::forbidden('You can only create notifications for your own user');
        }

        if ($companyId > 0) {
            $stmt = $pdo->prepare("SELECT id FROM companies WHERE id = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$companyId]);
            if (!$stmt->fetch()) {
                ApiResponse::validationError(['company_id' => ['Company not found or inactive']]);
            }

            $stmt = $pdo->prepare("SELECT id FROM company_users WHERE company_id = ? AND user_id = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$companyId, $userId]);
            if (!$stmt->fetch()) {
                ApiResponse::forbidden('You do not have access to this company');
            }
        }

        $metaJson = null;
        if ($meta !== null) {
            $encoded = json_encode($meta);
            if ($encoded === false) {
                ApiResponse::validationError(['meta' => ['Meta must be valid JSON-serializable data']]);
            }
            $metaJson = $encoded;
        }

        $stmt = $pdo->prepare("INSERT INTO notifications
            (user_id, company_id, title, message, notification_type, meta_json, is_read, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'active')");

        $stmt->execute([$recipientUserId, $companyId > 0 ? $companyId : null, $title, $message, $notificationType, $metaJson]);

        $notificationId = (int)$pdo->lastInsertId();

        $stmt = $pdo->prepare("SELECT id, title, message, notification_type, meta_json, company_id, is_read, read_at, created_at
            FROM notifications
            WHERE id = ? AND user_id = ?");
        $stmt->execute([$notificationId, $userId]);
        $notification = $stmt->fetch();

        if ($notification) {
            $notification['is_read'] = (bool)$notification['is_read'];
            $notification['meta'] = !empty($notification['meta_json']) ? json_decode($notification['meta_json'], true) : null;
            unset($notification['meta_json']);
        }

        ApiResponse::success($notification, 'Notification created successfully', 201);
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
            ApiResponse::error('Invalid JSON data');
        }

        $markAll = isset($input['mark_all']) ? $toBool($input['mark_all']) : false;
        $companyId = isset($input['company_id']) ? (int)$input['company_id'] : 0;

        list($companyWhere, $companyParams) = $buildCompanyCondition($companyId);

        if ($markAll) {
            $stmt = $pdo->prepare("UPDATE notifications n
                SET n.is_read = 1, n.read_at = NOW()
                WHERE n.user_id = ?
                  AND n.status = 'active'
                  AND n.is_read = 0
                  AND $companyWhere");
            $stmt->execute(array_merge([$userId], $companyParams));

            ApiResponse::success([
                'updated' => $stmt->rowCount()
            ], 'All notifications marked as read successfully');
        }

        $id = isset($input['id']) ? (int)$input['id'] : 0;
        $ids = isset($input['ids']) && is_array($input['ids']) ? $input['ids'] : [];

        if ($id <= 0 && empty($ids)) {
            ApiResponse::error('Notification ID or IDs are required');
        }

        if ($id > 0) {
            $stmt = $pdo->prepare("UPDATE notifications
                SET is_read = 1, read_at = NOW()
                WHERE id = ? AND user_id = ? AND status = 'active'");
            $stmt->execute([$id, $userId]);

            if ($stmt->rowCount() === 0) {
                ApiResponse::error('Notification not found', 404);
            }

            ApiResponse::success([
                'updated' => 1
            ], 'Notification marked as read successfully');
        }

        $sanitizedIds = [];
        foreach ($ids as $rawId) {
            $parsed = (int)$rawId;
            if ($parsed > 0) {
                $sanitizedIds[] = $parsed;
            }
        }

        if (empty($sanitizedIds)) {
            ApiResponse::validationError(['ids' => ['At least one valid notification ID is required']]);
        }

        $placeholders = implode(',', array_fill(0, count($sanitizedIds), '?'));
        $params = array_merge($sanitizedIds, [$userId]);

        $stmt = $pdo->prepare("UPDATE notifications
            SET is_read = 1, read_at = NOW()
            WHERE id IN ($placeholders) AND user_id = ? AND status = 'active'");
        $stmt->execute($params);

        ApiResponse::success([
            'updated' => $stmt->rowCount()
        ], 'Notifications marked as read successfully');
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        $id = 0;
        if (is_array($input) && isset($input['id'])) {
            $id = (int)$input['id'];
        } elseif (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
        }

        if ($id <= 0) {
            ApiResponse::error('Notification ID is required');
        }

        $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);

        if ($stmt->rowCount() === 0) {
            ApiResponse::error('Notification not found', 404);
        }

        ApiResponse::success(null, 'Notification deleted successfully');
    }

    ApiResponse::error('Method not allowed', 405);

} catch (PDOException $e) {
    error_log("Notifications V2 API error: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('Failed to process request. Please try again.');
} catch (Exception $e) {
    error_log("Notifications V2 API exception: " . $e->getMessage(), 3, __DIR__ . '/../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
