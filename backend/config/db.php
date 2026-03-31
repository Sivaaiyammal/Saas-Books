<?php
require_once __DIR__ . '/env.php';

function getDBConnection() {
    static $pdo = null;

    if ($pdo === null) {
        try {
            $port = $_ENV['DB_PORT'] ?? 3306;
            $dsn = "mysql:host={$_ENV['DB_HOST']};port={$port};dbname={$_ENV['DB_NAME']};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false,
            ];

            // Some environments (CLI) might miss the MySQL-specific attribute constant
            if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
                $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci";
            }

            $pdo = new PDO($dsn, $_ENV['DB_USER'], $_ENV['DB_PASS'], $options);

            if (!defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
                $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            }

        } catch (PDOException $e) {
            $logDir = __DIR__ . '/../logs';
            if (is_dir($logDir) && is_writable($logDir)) {
                error_log("Database connection failed: " . $e->getMessage(), 3, $logDir . '/sql_error.log');
            }
            throw new Exception("Database connection failed: " . $e->getMessage());
        }
    }

    return $pdo;
}

// Only auto-connect if NOT in CLI or if explicitly requested
if (php_sapi_name() !== 'cli' && basename($_SERVER['PHP_SELF']) !== 'migrate.php') {
    try {
        $pdo = getDBConnection();
    } catch (Exception $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        exit;
    }
}
