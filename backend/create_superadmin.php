<?php
/**
 * Script to create a superadmin user
 * Usage: php backend/create_superadmin.php
 */

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/auth.php';

try {
    $pdo = getDBConnection();
    $email = 'admin@earnestminds.in';
    $password = 'Emts@123!';
    $name = 'Super Admin';

    // Check if user already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch();

    if ($existingUser) {
        echo "❌ User with email $email already exists (ID: {$existingUser['id']})\n";
        echo "If you want to update the password, delete the user first or use the password reset flow.\n";
        exit(1);
    }

    // Hash the password
    $hashedPassword = AuthHelper::hashPassword($password);

    // Insert the new superadmin user
    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, password, role, status, created_at)
        VALUES (?, ?, ?, 'super_admin', 'active', NOW())
    ");

    $stmt->execute([$name, $email, $hashedPassword]);
    $userId = $pdo->lastInsertId();

    echo "✅ Superadmin user created successfully!\n";
    echo "───────────────────────────────────────\n";
    echo "Email:    $email\n";
    echo "Password: $password\n";
    echo "Role:     super_admin\n";
    echo "User ID:  $userId\n";
    echo "───────────────────────────────────────\n";
    echo "You can now login with these credentials.\n";

} catch (PDOException $e) {
    echo "❌ Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
