<?php

class StockHelper {

    public static function checkAvailability($pdo, $productId, $requiredQuantity) {
        try {
            $stmt = $pdo->prepare("
                SELECT id, name, stock_quantity
                FROM products
                WHERE id = ? AND status = 'active'
            ");

            $stmt->execute([$productId]);
            $product = $stmt->fetch();

            if (!$product) {
                return [
                    'available' => false,
                    'message' => 'Product not found'
                ];
            }

            if ($product['stock_quantity'] < $requiredQuantity) {
                return [
                    'available' => false,
                    'message' => 'Insufficient stock',
                    'available_quantity' => $product['stock_quantity']
                ];
            }

            return [
                'available' => true,
                'product' => $product
            ];

        } catch (PDOException $e) {
            error_log("Stock check error: " . $e->getMessage());
            return [
                'available' => false,
                'message' => 'Error checking stock'
            ];
        }
    }

    public static function updateStock($pdo, $productId, $quantity, $operation = 'subtract') {
        try {
            if ($operation === 'subtract') {
                $stmt = $pdo->prepare("
                    UPDATE products
                    SET stock_quantity = stock_quantity - ?
                    WHERE id = ? AND stock_quantity >= ?
                ");

                $stmt->execute([$quantity, $productId, $quantity]);
            } else if ($operation === 'add') {
                $stmt = $pdo->prepare("
                    UPDATE products
                    SET stock_quantity = stock_quantity + ?
                    WHERE id = ?
                ");

                $stmt->execute([$quantity, $productId]);
            }

            return $stmt->rowCount() > 0;

        } catch (PDOException $e) {
            error_log("Stock update error: " . $e->getMessage());
            return false;
        }
    }

    public static function getLowStockProducts($pdo, $threshold = 10) {
        try {
            $stmt = $pdo->prepare("
                SELECT id, name, stock_quantity, low_stock_threshold
                FROM products
                WHERE stock_quantity <= ? AND status = 'active'
                ORDER BY stock_quantity ASC
            ");

            $stmt->execute([$threshold]);
            return $stmt->fetchAll();

        } catch (PDOException $e) {
            error_log("Low stock fetch error: " . $e->getMessage());
            return [];
        }
    }

    public static function logStockMovement($pdo, $productId, $quantity, $type, $reference, $userId = null) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO stock_movements (
                    product_id, quantity, type, reference, user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            ");

            $stmt->execute([$productId, $quantity, $type, $reference, $userId]);
            return true;

        } catch (PDOException $e) {
            error_log("Stock movement log error: " . $e->getMessage());
            return false;
        }
    }

    public static function getStockHistory($pdo, $productId, $limit = 50) {
        try {
            $stmt = $pdo->prepare("
                SELECT sm.*, u.name as user_name
                FROM stock_movements sm
                LEFT JOIN users u ON sm.user_id = u.id
                WHERE sm.product_id = ?
                ORDER BY sm.created_at DESC
                LIMIT ?
            ");

            $stmt->execute([$productId, $limit]);
            return $stmt->fetchAll();

        } catch (PDOException $e) {
            error_log("Stock history error: " . $e->getMessage());
            return [];
        }
    }
}
