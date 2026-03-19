<?php
/**
 * Migration: Add notifications for V2
 * Run once: php backend/migrations/add_notifications_v2.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        company_id INT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        notification_type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
        meta_json JSON NULL,
        is_read TINYINT(1) DEFAULT 0,
        read_at DATETIME NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_notifications_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
        INDEX idx_notifications_user (user_id),
        INDEX idx_notifications_company (company_id),
        INDEX idx_notifications_is_read (is_read),
        INDEX idx_notifications_status (status),
        INDEX idx_notifications_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    echo "Notifications migration completed successfully.\n";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
