<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/env.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailHelper {

    private static function getMailer() {
        $mail = new PHPMailer(true);

        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host       = $_ENV['MAIL_HOST'] ?? 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = $_ENV['MAIL_USERNAME'] ?? '';
            $mail->Password   = $_ENV['MAIL_PASSWORD'] ?? '';
            $mail->SMTPSecure = $_ENV['MAIL_ENCRYPTION'] ?? PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = (int)($_ENV['MAIL_PORT'] ?? 587);

            // Sender
            $mail->setFrom(
                $_ENV['MAIL_FROM'] ?? 'noreply@anutextiles.com',
                $_ENV['MAIL_FROM_NAME'] ?? "Saas Books"
            );

            // Encoding
            $mail->CharSet = 'UTF-8';
            $mail->isHTML(true);

            return $mail;

        } catch (Exception $e) {
            error_log("Mailer configuration error: " . $e->getMessage());
            throw new Exception("Email configuration failed");
        }
    }

    public static function send($to, $subject, $body, $altBody = '') {
        try {
            $mail = self::getMailer();

            $mail->addAddress($to);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->AltBody = $altBody ?: strip_tags($body);

            $mail->send();
            return true;

        } catch (Exception $e) {
            error_log("Email send error: {$mail->ErrorInfo}", 3, __DIR__ . '/../logs/api_error.log');
            return false;
        }
    }

    public static function sendPasswordReset($email, $name, $resetToken) {
        $resetUrl = ($_ENV['APP_URL'] ?? 'http://localhost') . '/reset-password?token=' . $resetToken;
        $appName = $_ENV['APP_NAME'] ?? "Saas Books";

        $subject = "Password Reset Request - {$appName}";

        $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .container {
                    background-color: #f9f9f9;
                    border-radius: 10px;
                    padding: 30px;
                    border: 1px solid #ddd;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #4CAF50;
                }
                .header h1 {
                    color: #4CAF50;
                    margin: 0;
                }
                .content {
                    padding: 20px 0;
                }
                .button {
                    display: inline-block;
                    padding: 12px 30px;
                    background-color: #4CAF50;
                    color: white !important;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }
                .button:hover {
                    background-color: #45a049;
                }
                .token-box {
                    background-color: #fff;
                    border: 1px dashed #ccc;
                    padding: 15px;
                    border-radius: 5px;
                    font-family: monospace;
                    word-break: break-all;
                    margin: 15px 0;
                }
                .footer {
                    text-align: center;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                }
                .warning {
                    background-color: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>{$appName}</h1>
                    <p>Password Reset Request</p>
                </div>

                <div class='content'>
                    <p>Hello <strong>{$name}</strong>,</p>

                    <p>We received a request to reset your password. Click the button below to create a new password:</p>

                    <center>
                        <a href='{$resetUrl}' class='button'>Reset Password</a>
                    </center>

                    <p>Or copy and paste this link into your browser:</p>
                    <div class='token-box'>{$resetUrl}</div>

                    <div class='warning'>
                        <strong>⚠️ Important:</strong>
                        <ul style='margin: 5px 0;'>
                            <li>This link will expire in <strong>1 hour</strong></li>
                            <li>If you didn't request this, please ignore this email</li>
                            <li>Your password won't change until you create a new one</li>
                        </ul>
                    </div>

                    <p>For security reasons, this reset token is:</p>
                    <div class='token-box'>{$resetToken}</div>
                </div>

                <div class='footer'>
                    <p>This is an automated email from {$appName}. Please do not reply to this email.</p>
                    <p>&copy; " . date('Y') . " {$appName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";

        $altBody = "Hello {$name},\n\n"
                 . "We received a request to reset your password.\n\n"
                 . "Reset your password by visiting this link:\n{$resetUrl}\n\n"
                 . "Or use this token: {$resetToken}\n\n"
                 . "This link will expire in 1 hour.\n\n"
                 . "If you didn't request this, please ignore this email.\n\n"
                 . "Thanks,\n{$appName} Team";

        return self::send($email, $subject, $body, $altBody);
    }

    public static function sendWelcomeEmail($email, $name) {
        $appName = $_ENV['APP_NAME'] ?? "Saas Books";
        $subject = "Welcome to {$appName}!";

        $body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
                .header { text-align: center; color: #4CAF50; }
                .content { padding: 20px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Welcome to {$appName}!</h1>
                </div>
                <div class='content'>
                    <p>Hello <strong>{$name}</strong>,</p>
                    <p>Thank you for registering with {$appName}. We're excited to have you on board!</p>
                    <p>You can now log in to your account and start exploring our services.</p>
                    <p>If you have any questions, feel free to contact our support team.</p>
                    <p>Best regards,<br>{$appName} Team</p>
                </div>
            </div>
        </body>
        </html>
        ";

        $altBody = "Hello {$name},\n\nWelcome to {$appName}!\n\nThank you for registering. You can now log in and start using our services.\n\nBest regards,\n{$appName} Team";

        return self::send($email, $subject, $body, $altBody);
    }

    public static function testConnection() {
        try {
            $mail = self::getMailer();
            $mail->SMTPDebug = SMTP::DEBUG_SERVER;
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}
