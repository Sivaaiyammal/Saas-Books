<?php
/**
 * Migration Runner
 * Usage:
 *   php migrate.php          — run all pending migrations
 *   php migrate.php rollback — rollback last batch
 *   php migrate.php status   — show migration status
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/env.php';

$command = $argv[1] ?? 'run';

$pdo = getDbConnection();

// Create migrations tracking table
$pdo->exec("
    CREATE TABLE IF NOT EXISTS migrations (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        migration   VARCHAR(255) NOT NULL,
        batch       INT NOT NULL DEFAULT 1,
        ran_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_migration (migration)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// Collect all migration files ordered by number prefix
$files = [];
$dirs  = glob(__DIR__ . '/*/');

foreach ($dirs as $dir) {
    foreach (glob($dir . '*.php') as $file) {
        $basename = basename($file, '.php');
        // Extract leading number for sorting (e.g. "001_create_users")
        preg_match('/^(\d+)/', $basename, $m);
        $num = isset($m[1]) ? (int)$m[1] : 999;
        $files[$num][] = ['file' => $file, 'name' => $basename];
    }
}
ksort($files);

$all = [];
foreach ($files as $group) {
    foreach ($group as $f) {
        $all[] = $f;
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function getRanMigrations(PDO $pdo): array {
    return $pdo->query("SELECT migration FROM migrations ORDER BY id")
               ->fetchAll(PDO::FETCH_COLUMN);
}

function getLastBatch(PDO $pdo): int {
    $r = $pdo->query("SELECT MAX(batch) FROM migrations")->fetchColumn();
    return $r ? (int)$r : 0;
}

function loadMigration(string $file): object {
    require_once $file;
    $basename = pathinfo($file, PATHINFO_FILENAME); // e.g. "001_create_users"
    $parts    = explode('_', $basename);
    $num      = (int)$parts[0];                                          // "001" → 1
    $name     = implode('', array_map('ucfirst', array_slice($parts, 1))); // "CreateUsers"
    $class    = "Migration_{$num}_{$name}";                              // "Migration_1_CreateUsers"
    return new $class(getDbConnection());
}

// ── commands ─────────────────────────────────────────────────────────────────
switch ($command) {

    case 'run':
        $ran   = getRanMigrations($pdo);
        $batch = getLastBatch($pdo) + 1;
        $count = 0;

        foreach ($all as $m) {
            if (in_array($m['name'], $ran)) continue;

            echo "Running: {$m['name']} ... ";
            try {
                $migration = loadMigration($m['file']);
                $migration->up();

                $stmt = $pdo->prepare("INSERT INTO migrations (migration, batch) VALUES (?, ?)");
                $stmt->execute([$m['name'], $batch]);

                echo "OK\n";
                $count++;
            } catch (Throwable $e) {
                echo "FAILED\n  " . $e->getMessage() . "\n";
                exit(1);
            }
        }

        echo $count === 0 ? "Nothing to migrate.\n" : "Done. {$count} migration(s) ran.\n";
        break;

    case 'rollback':
        $batch = getLastBatch($pdo);
        if ($batch === 0) { echo "Nothing to rollback.\n"; exit(0); }

        $stmt = $pdo->prepare("SELECT migration FROM migrations WHERE batch = ? ORDER BY id DESC");
        $stmt->execute([$batch]);
        $toRollback = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // Map name → file path
        $nameToFile = [];
        foreach ($all as $m) { $nameToFile[$m['name']] = $m['file']; }

        $count = 0;
        foreach ($toRollback as $name) {
            if (!isset($nameToFile[$name])) {
                echo "File not found for: $name — skipping\n";
                continue;
            }
            echo "Rolling back: $name ... ";
            try {
                $migration = loadMigration($nameToFile[$name]);
                $migration->down();

                $pdo->prepare("DELETE FROM migrations WHERE migration = ?")->execute([$name]);
                echo "OK\n";
                $count++;
            } catch (Throwable $e) {
                echo "FAILED\n  " . $e->getMessage() . "\n";
                exit(1);
            }
        }
        echo "Rolled back batch #{$batch}. {$count} migration(s).\n";
        break;

    case 'status':
        $ran = getRanMigrations($pdo);
        echo str_pad("Migration", 50) . " Status\n";
        echo str_repeat("-", 60) . "\n";
        foreach ($all as $m) {
            $status = in_array($m['name'], $ran) ? "Ran" : "Pending";
            echo str_pad($m['name'], 50) . " $status\n";
        }
        break;

    default:
        echo "Unknown command: $command\nUsage: php migrate.php [run|rollback|status]\n";
        exit(1);
}
