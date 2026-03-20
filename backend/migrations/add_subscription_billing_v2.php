<?php
/**
 * Migration: Add plans/subscriptions for pay-before-access flow in V2
 * Run once: php backend/migrations/add_subscription_billing_v2.php
 */

require_once __DIR__ . '/../config/db.php';

try {
    $pdo = getDBConnection();

    $pdo->exec("CREATE TABLE IF NOT EXISTS plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        validity_days INT NOT NULL DEFAULT 30,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_plans_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        status ENUM('pending', 'active', 'expired', 'cancelled') DEFAULT 'pending',
        payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
        amount_paid DECIMAL(12, 2) DEFAULT 0.00,
        payment_reference VARCHAR(100) NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        paid_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_subscriptions_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE RESTRICT,
        INDEX idx_subscriptions_company (company_id),
        INDEX idx_subscriptions_user (user_id),
        INDEX idx_subscriptions_status (status),
        INDEX idx_subscriptions_end_date (end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $insertPlan = $pdo->prepare("INSERT INTO plans (code, name, amount, currency, validity_days, status)
        SELECT ?, ?, ?, 'INR', ?, 'active'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = ?)");

    $insertPlan->execute(['BASIC_MONTHLY', 'Basic Monthly', 999.00, 30, 'BASIC_MONTHLY']);
    $insertPlan->execute(['PRO_MONTHLY', 'Pro Monthly', 2499.00, 30, 'PRO_MONTHLY']);
    $insertPlan->execute(['PRO_YEARLY', 'Pro Yearly', 24999.00, 365, 'PRO_YEARLY']);

    echo "Plans and subscriptions migration completed successfully.\n";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
