<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../helpers/moduleAccess.php';
require_once __DIR__ . '/../../../middleware/auth.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST', 'PUT'], true)) {
    ApiResponse::error('Method not allowed', 405);
}

function ensureSaasAdmin(array $user): void {
    if (($user['role'] ?? '') !== 'super_admin') {
        ApiResponse::forbidden('Only SaaS admin can access this endpoint.');
    }
}

function tableHasColumn(PDO $pdo, string $tableName, string $columnName): bool {
    try {
        $stmt = $pdo->prepare('SHOW COLUMNS FROM `' . $tableName . '` LIKE ?');
        $stmt->execute([$columnName]);
        return (bool)$stmt->fetch();
    } catch (Throwable $e) {
        return false;
    }
}

function loadCompanyWithPlan(PDO $pdo, int $companyId): ?array {
    $resultStmt = $pdo->prepare(
        "SELECT
            c.id,
            c.code,
            c.name,
            c.email,
            c.phone,
            c.status,
            c.created_at,
            s.id AS subscription_id,
            s.plan_id,
            s.status AS subscription_status,
            s.payment_status,
            s.start_date,
            s.end_date,
            s.amount_paid,
            p.name AS plan_name,
            p.code AS plan_code,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            owner_user.phone AS owner_phone,
            COALESCE(company_stats.user_count, 0) AS user_count
        FROM companies c
        LEFT JOIN (
            SELECT s1.*
            FROM subscriptions s1
            INNER JOIN (
                SELECT company_id, MAX(id) AS max_id
                FROM subscriptions
                GROUP BY company_id
            ) latest ON latest.max_id = s1.id
        ) s ON s.company_id = c.id
        LEFT JOIN plans p ON p.id = s.plan_id
        LEFT JOIN (
            SELECT cu.company_id, MIN(cu.user_id) AS owner_user_id
            FROM company_users cu
            WHERE cu.status = 'active' AND cu.role = 'owner'
            GROUP BY cu.company_id
        ) owner_link ON owner_link.company_id = c.id
        LEFT JOIN users owner_user ON owner_user.id = owner_link.owner_user_id
        LEFT JOIN (
            SELECT cu.company_id, COUNT(*) AS user_count
            FROM company_users cu
            WHERE cu.status = 'active'
            GROUP BY cu.company_id
        ) company_stats ON company_stats.company_id = c.id
        WHERE c.id = ?
        LIMIT 1"
    );
    $resultStmt->execute([$companyId]);
    $company = $resultStmt->fetch();

    if (!$company) {
        return null;
    }

    $company['modules'] = ModuleAccessHelper::getCompanyModules($pdo, (int)$company['id']);
    return $company;
}

try {
    $db = null;
    $user = AuthMiddleware::authenticate();
    ensureSaasAdmin($user);

    $method = $_SERVER['REQUEST_METHOD'];
    $db = getDBConnection();

    if ($method === 'GET') {
        $plans = [];
        $planHasFeatures = tableHasColumn($db, 'plans', 'features');
        $planHasMaxUsers = tableHasColumn($db, 'plans', 'max_users');
        $planHasMaxCompanies = tableHasColumn($db, 'plans', 'max_companies');

        $planSelectFields = ['id', 'code', 'name', 'amount', 'currency', 'validity_days', 'status'];
        if ($planHasFeatures) {
            $planSelectFields[] = 'features';
        }
        if ($planHasMaxUsers) {
            $planSelectFields[] = 'max_users';
        }
        if ($planHasMaxCompanies) {
            $planSelectFields[] = 'max_companies';
        }

        $planQuery = 'SELECT ' . implode(', ', $planSelectFields) . ' FROM plans ORDER BY amount ASC, id ASC';
        $planStmt = $db->query($planQuery);
        $plans = $planStmt->fetchAll();

        foreach ($plans as &$plan) {
            if (isset($plan['features']) && is_string($plan['features'])) {
                $decoded = json_decode($plan['features'], true);
                $plan['features'] = is_array($decoded) ? $decoded : [];
            }
        }
        unset($plan);

        // Exclude split companies (split_parent_id IS NOT NULL) — they live in split_registry
        $hasSplitParent = tableHasColumn($db, 'companies', 'split_parent_id');
        $splitFilter = $hasSplitParent ? 'WHERE c.split_parent_id IS NULL' : '';

        $companiesStmt = $db->query(
            "SELECT
                c.id,
                c.code,
                c.name,
                c.email,
                c.phone,
                c.status,
                c.created_at,
                s.id AS subscription_id,
                s.plan_id,
                s.status AS subscription_status,
                s.payment_status,
                s.start_date,
                s.end_date,
                s.amount_paid,
                p.name AS plan_name,
                p.code AS plan_code,
                owner_user.name AS owner_name,
                owner_user.email AS owner_email,
                owner_user.phone AS owner_phone,
                COALESCE(company_stats.user_count, 0) AS user_count
            FROM companies c
            LEFT JOIN (
                SELECT s1.*
                FROM subscriptions s1
                INNER JOIN (
                    SELECT company_id, MAX(id) AS max_id
                    FROM subscriptions
                    GROUP BY company_id
                ) latest ON latest.max_id = s1.id
            ) s ON s.company_id = c.id
            LEFT JOIN plans p ON p.id = s.plan_id
            LEFT JOIN (
                SELECT cu.company_id, MIN(cu.user_id) AS owner_user_id
                FROM company_users cu
                WHERE cu.status = 'active' AND cu.role = 'owner'
                GROUP BY cu.company_id
            ) owner_link ON owner_link.company_id = c.id
            LEFT JOIN users owner_user ON owner_user.id = owner_link.owner_user_id
            LEFT JOIN (
                SELECT cu.company_id, COUNT(*) AS user_count
                FROM company_users cu
                WHERE cu.status = 'active'
                GROUP BY cu.company_id
            ) company_stats ON company_stats.company_id = c.id
            $splitFilter
            ORDER BY c.id DESC"
        );

        $companies = $companiesStmt->fetchAll();
        foreach ($companies as &$company) {
            $company['modules'] = ModuleAccessHelper::getCompanyModules($db, (int)$company['id']);
        }
        unset($company);

        ApiResponse::success([
            'companies' => $companies,
            'plans' => $plans
        ], 'SaaS companies retrieved successfully');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
        ApiResponse::error('Invalid JSON data');
    }

    if ($method === 'POST') {
        $companyName = trim((string)($input['company_name'] ?? ''));
        $companyEmail = trim((string)($input['company_email'] ?? ''));
        $companyPhone = trim((string)($input['company_phone'] ?? ''));
        $adminName = trim((string)($input['admin_name'] ?? ''));
        $adminEmail = AuthHelper::sanitizeEmail($input['admin_email'] ?? '');
        $adminPhone = trim((string)($input['admin_phone'] ?? ''));
        $adminPassword = (string)($input['admin_password'] ?? '');
        $planId = isset($input['plan_id']) ? (int)$input['plan_id'] : null;
        $modules = isset($input['modules']) && is_array($input['modules'])
            ? ModuleAccessHelper::normalizeModules($input['modules'])
            : ModuleAccessHelper::defaultModules();

        $validationErrors = [];
        if ($companyName === '') {
            $validationErrors['company_name'] = ['Company name is required'];
        }
        if ($adminName === '') {
            $validationErrors['admin_name'] = ['Admin name is required'];
        }
        if ($adminEmail === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            $validationErrors['admin_email'] = ['Valid admin email is required'];
        }
        if (!AuthHelper::isStrongPassword($adminPassword)) {
            $validationErrors['admin_password'] = ['Password must be at least 8 characters and include uppercase, lowercase, and numbers'];
        }
        if (!empty($validationErrors)) {
            ApiResponse::validationError($validationErrors);
        }

        $existingUserStmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $existingUserStmt->execute([$adminEmail]);
        if ($existingUserStmt->fetch()) {
            ApiResponse::validationError(['admin_email' => ['Email already exists in users']]);
        }

        if ($planId !== null && $planId > 0) {
            $planExistsStmt = $db->prepare('SELECT id FROM plans WHERE id = ? LIMIT 1');
            $planExistsStmt->execute([$planId]);
            if (!$planExistsStmt->fetch()) {
                ApiResponse::validationError(['plan_id' => ['Plan not found']]);
            }
        }

        $db->beginTransaction();

        $companyCode = AuthHelper::generateCompanyCode($db);
        $companyInsert = $db->prepare(
            'INSERT INTO companies (code, name, email, phone, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())'
        );
        $companyInsert->execute([
            $companyCode,
            $companyName,
            $companyEmail !== '' ? $companyEmail : $adminEmail,
            $companyPhone !== '' ? $companyPhone : ($adminPhone !== '' ? $adminPhone : null),
            'active'
        ]);
        $companyId = (int)$db->lastInsertId();

        $permissionIds = AuthHelper::ensurePermissions($db);
        $roleIds = AuthHelper::ensureCompanyRoles($db, $companyId);
        AuthHelper::assignDefaultRolePermissions($db, $roleIds, $permissionIds);
        $ownerRoleId = $roleIds['owner'] ?? null;

        $passwordHash = AuthHelper::hashPassword($adminPassword);
        $adminInsert = $db->prepare(
            "INSERT INTO users (name, email, password, phone, company_id, role_id, role, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', NOW(), NOW())"
        );
        $adminInsert->execute([$adminName, $adminEmail, $passwordHash, $adminPhone !== '' ? $adminPhone : null, $companyId, $ownerRoleId]);
        $adminUserId = (int)$db->lastInsertId();

        $companyUserInsert = $db->prepare(
            "INSERT INTO company_users (company_id, user_id, role_id, role, is_default, status, created_at, updated_at)
             VALUES (?, ?, ?, 'owner', 1, 'active', NOW(), NOW())"
        );
        $companyUserInsert->execute([$companyId, $adminUserId, $ownerRoleId]);

        if ($planId !== null && $planId > 0) {
            $subInsert = $db->prepare(
                'INSERT INTO subscriptions (company_id, user_id, plan_id, status, payment_status, amount_paid, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0.00, NOW(), NOW())'
            );
            $subInsert->execute([$companyId, (int)$user['id'], $planId, 'pending', 'pending']);
        }

        ModuleAccessHelper::upsertCompanyModules($db, $companyId, $modules, (int)$user['id']);

        $db->commit();

        $company = loadCompanyWithPlan($db, $companyId);

        ApiResponse::created([
            'company' => $company,
            'admin_user' => [
                'id' => $adminUserId,
                'name' => $adminName,
                'email' => $adminEmail
            ]
        ], 'Company created successfully');
    }

    $companyId = isset($input['company_id']) ? (int)$input['company_id'] : 0;
    if ($companyId <= 0) {
        ApiResponse::validationError(['company_id' => ['Valid company_id is required']]);
    }

    $companyExistsStmt = $db->prepare('SELECT id FROM companies WHERE id = ? LIMIT 1');
    $companyExistsStmt->execute([$companyId]);
    if (!$companyExistsStmt->fetch()) {
        ApiResponse::notFound('Company not found');
    }

    $planId = isset($input['plan_id']) ? (int)$input['plan_id'] : null;
    $companyStatus = isset($input['company_status']) ? trim((string)$input['company_status']) : null;
    $modules = isset($input['modules']) && is_array($input['modules']) ? $input['modules'] : null;

    $db->beginTransaction();

    if ($companyStatus !== null && in_array($companyStatus, ['active', 'inactive'], true)) {
        $companyStatusStmt = $db->prepare('UPDATE companies SET status = ?, updated_at = NOW() WHERE id = ?');
        $companyStatusStmt->execute([$companyStatus, $companyId]);
    }

    if ($planId !== null && $planId > 0) {
        $planExistsStmt = $db->prepare('SELECT id FROM plans WHERE id = ? LIMIT 1');
        $planExistsStmt->execute([$planId]);
        if (!$planExistsStmt->fetch()) {
            $db->rollBack();
            ApiResponse::validationError(['plan_id' => ['Plan not found']]);
        }

        $latestSubStmt = $db->prepare('SELECT id FROM subscriptions WHERE company_id = ? ORDER BY id DESC LIMIT 1');
        $latestSubStmt->execute([$companyId]);
        $latestSubId = $latestSubStmt->fetchColumn();

        if ($latestSubId) {
            $updateSubStmt = $db->prepare('UPDATE subscriptions SET plan_id = ?, updated_at = NOW() WHERE id = ?');
            $updateSubStmt->execute([$planId, (int)$latestSubId]);
        } else {
            $insertSubStmt = $db->prepare(
                'INSERT INTO subscriptions (company_id, user_id, plan_id, status, payment_status, amount_paid, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0.00, NOW(), NOW())'
            );
            $insertSubStmt->execute([$companyId, (int)$user['id'], $planId, 'pending', 'pending']);
        }
    }

    if ($modules !== null) {
        ModuleAccessHelper::upsertCompanyModules($db, $companyId, $modules, (int)$user['id']);
    }

    $db->commit();

    $company = loadCompanyWithPlan($db, $companyId);

    ApiResponse::success(['company' => $company], 'Company access updated successfully');
} catch (PDOException $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Admin companies API error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to process admin request');
} catch (Exception $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Admin companies API exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
