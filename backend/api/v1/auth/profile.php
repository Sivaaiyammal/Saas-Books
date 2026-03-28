<?php
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
require_once __DIR__ . '/../../../helpers/auth.php';
require_once __DIR__ . '/../../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Method not allowed', 405);
}

function usersTableHasProfileImageColumn(PDO $pdo): bool {
    static $hasColumn = null;

    if ($hasColumn !== null) {
        return $hasColumn;
    }

    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'profile_image'");
        $stmt->execute();
        $hasColumn = (bool)$stmt->fetchColumn();
    } catch (PDOException $e) {
        $hasColumn = false;
    }

    return $hasColumn;
}

function buildProfileImageUrl(?string $profileImagePath): ?string {
    if (!$profileImagePath) {
        return null;
    }

    $normalized = ltrim(str_replace('\\', '/', $profileImagePath), '/');
    if (preg_match('#^https?://#i', $normalized)) {
        return $normalized;
    }

    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host . '/' . $normalized;
}

try {
    $currentUser = AuthMiddleware::authenticate();

    $name = trim((string)($_POST['name'] ?? ''));
    $phone = trim((string)($_POST['phone'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if ($name === '') {
        ApiResponse::validationError(['name' => ['name is required']]);
    }

    if (strlen($name) > 100) {
        ApiResponse::validationError(['name' => ['name must be at most 100 characters']]);
    }

    if ($phone !== '' && !preg_match('/^[0-9]{10}$/', $phone)) {
        ApiResponse::validationError(['phone' => ['phone must be a valid 10-digit number']]);
    }

    if ($password !== '' && strlen($password) < 6) {
        ApiResponse::validationError(['password' => ['password must be at least 6 characters']]);
    }

    $hasProfileImageColumn = usersTableHasProfileImageColumn($pdo);
    $newProfileImagePath = null;

    if ($hasProfileImageColumn && isset($_FILES['avatar']) && is_array($_FILES['avatar']) && ($_FILES['avatar']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $avatar = $_FILES['avatar'];

        if (($avatar['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            ApiResponse::error('Failed to upload image', 400);
        }

        if (($avatar['size'] ?? 0) > (2 * 1024 * 1024)) {
            ApiResponse::validationError(['avatar' => ['Image must be under 2MB']]);
        }

        $tmpPath = $avatar['tmp_name'] ?? '';
        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            ApiResponse::error('Invalid uploaded image', 400);
        }

        $imageInfo = @getimagesize($tmpPath);
        if ($imageInfo === false || empty($imageInfo['mime'])) {
            ApiResponse::validationError(['avatar' => ['Invalid image file']]);
        }

        $mime = strtolower((string)$imageInfo['mime']);
        $allowedMimeToExt = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        if (!isset($allowedMimeToExt[$mime])) {
            ApiResponse::validationError(['avatar' => ['Only JPG, PNG, and WEBP images are allowed']]);
        }

        $uploadDirAbs = realpath(__DIR__ . '/../../../');
        if ($uploadDirAbs === false) {
            ApiResponse::serverError('Upload path resolution failed');
        }

        $uploadDirAbs .= '/uploads/profile';
        if (!is_dir($uploadDirAbs) && !mkdir($uploadDirAbs, 0755, true)) {
            ApiResponse::serverError('Failed to create upload directory');
        }

        $filename = sprintf('user_%d_%d.%s', (int)$currentUser['id'], time(), $allowedMimeToExt[$mime]);
        $targetAbs = $uploadDirAbs . '/' . $filename;

        if (!move_uploaded_file($tmpPath, $targetAbs)) {
            ApiResponse::serverError('Failed to save uploaded image');
        }

        $newProfileImagePath = 'uploads/profile/' . $filename;
    }

    $sqlParts = [
        'name = :name',
        'phone = :phone',
        'updated_at = NOW()',
    ];

    $params = [
        ':name' => $name,
        ':phone' => $phone !== '' ? $phone : null,
        ':id' => (int)$currentUser['id'],
    ];

    if ($password !== '') {
        $sqlParts[] = 'password = :password';
        $params[':password'] = AuthHelper::hashPassword($password);
    }

    if ($hasProfileImageColumn && $newProfileImagePath !== null) {
        $sqlParts[] = 'profile_image = :profile_image';
        $params[':profile_image'] = $newProfileImagePath;
    }

    $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $sqlParts) . ' WHERE id = :id');
    $stmt->execute($params);

    $userData = AuthHelper::getUserAuthContext($pdo, (int)$currentUser['id']);
    if (!$userData) {
        ApiResponse::serverError('Failed to load updated profile');
    }

    if (!empty($userData['profile_image'])) {
        $userData['profile_image_url'] = buildProfileImageUrl($userData['profile_image']);
    } else {
        $userData['profile_image_url'] = null;
    }

    ApiResponse::success([
        'user' => $userData,
    ], 'Profile updated successfully');
} catch (PDOException $e) {
    error_log('Profile update error: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to update profile');
} catch (Exception $e) {
    error_log('Profile update exception: ' . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('An unexpected error occurred');
}
