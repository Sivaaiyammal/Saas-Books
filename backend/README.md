# Anu's Textiles Backend API 🧵

> A secure, production-ready REST API built with PHP, PDO, and JWT authentication for managing a textiles business.

[![PHP Version](https://img.shields.io/badge/PHP-7.4%2B-blue)](https://www.php.net/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Authentication Flow](#authentication-flow)
- [Adding New Endpoints](#adding-new-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)
- [Security Best Practices](#security-best-practices)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

This backend API provides a complete solution for managing a textiles business, including:
- User authentication and authorization
- Product and inventory management
- Sales tracking and reporting
- Customer management
- Role-based access control

**Technology Stack:**
- **Language**: PHP 7.4+
- **Database**: MySQL 5.7+ / MariaDB 10.3+
- **Authentication**: JWT (JSON Web Tokens)
- **Database Access**: PDO (PHP Data Objects)
- **Dependencies**: Composer packages (Firebase JWT, phpdotenv)

---

## ✨ Features

### Security
- ✅ JWT-based authentication (access & refresh tokens)
- ✅ Password hashing with Bcrypt (cost factor 12)
- ✅ Rate limiting for login attempts (5 attempts per 15 minutes)
- ✅ SQL injection protection via PDO prepared statements
- ✅ XSS protection with input sanitization
- ✅ CORS configuration
- ✅ Secure HTTP headers

### Authentication & Authorization
- ✅ User signup and login
- ✅ Password reset functionality
- ✅ Role-based access control (Super Admin, Admin, Manager, User, Guest)
- ✅ JWT token refresh mechanism
- ✅ Token expiry management

### Business Features
- ✅ Product management with stock tracking
- ✅ Sales creation with automatic stock deduction
- ✅ Customer management
- ✅ Inventory tracking and alerts
- ✅ Category management
- ✅ Stock movement history

### Developer Experience
- ✅ Consistent API response format
- ✅ Comprehensive input validation
- ✅ Error logging and debugging
- ✅ Environment-based configuration
- ✅ Easy to extend and maintain

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **PHP** >= 7.4 (with extensions: pdo, pdo_mysql, mbstring, json, openssl)
- **MySQL** >= 5.7 or **MariaDB** >= 10.3
- **Composer** (PHP dependency manager)
- **Apache/Nginx** web server
- **Git** (for version control)

**Check your PHP version:**
```bash
php -v
```

**Check required PHP extensions:**
```bash
php -m | grep -E 'pdo|pdo_mysql|mbstring|json|openssl'
```

**Check Composer:**
```bash
composer --version
```

---

## 🚀 Installation

Follow these steps to set up the project on your local machine:

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd anu-s-textiles/backend
```

### Step 2: Install Dependencies

```bash
composer install
```

This will install:
- `firebase/php-jwt` - JWT token handling
- `vlucas/phpdotenv` - Environment variable management

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Application Settings
APP_ENV=local
APP_DEBUG=true

# Database Configuration
DB_HOST=localhost
DB_NAME=anu_textiles
DB_USER=root
DB_PASS=your_database_password

# JWT Configuration
JWT_SECRET=<generate-using-command-below>
JWT_EXPIRY=3600
JWT_REFRESH_EXPIRY=2592000
```

### Step 4: Generate JWT Secret

```bash
php generate-secret.php
```

Copy one of the generated secrets and paste it into your `.env` file as `JWT_SECRET`.

### Step 5: Create Database

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE anu_textiles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### Step 6: Import Database Schema

```bash
mysql -u root -p anu_textiles < database/schema.sql
```

This will create:
- Users table
- Products table
- Sales and sale_items tables
- Categories table
- Customers table
- Stock movements table
- Login attempts table (for rate limiting)

### Step 7: Set Permissions

```bash
# Set proper permissions
chmod -R 755 .
chmod -R 777 logs/

# Ensure vendor directory is readable
chmod -R 755 vendor/
```

### Step 8: Configure Web Server

#### Apache (.htaccess already configured)

Make sure `mod_rewrite` and `mod_headers` are enabled:
```bash
sudo a2enmod rewrite headers
sudo systemctl restart apache2
```

Your `.htaccess` file is already configured with:
- Security headers
- CORS settings
- File access restrictions

#### Nginx (Optional)

If using Nginx, add this to your server block:

```nginx
location ~ \.php$ {
    try_files $uri =404;
    fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
}

location ~ /\.env {
    deny all;
}
```

### Step 9: Verify Installation

Test the API is accessible:

```bash
curl http://localhost/anu-s-textiles/backend/api/v1/auth/login.php
```

You should see a JSON error response (since no credentials were provided), confirming the API is working.

---

## 🏗️ Architecture

This API follows a **layered architecture** pattern:

```
┌─────────────────────────────────────────┐
│         API Endpoints (Controllers)      │
│  - Handle HTTP requests/responses        │
│  - Route to appropriate logic            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            Middleware Layer              │
│  - Authentication (JWT verification)     │
│  - Authorization (role checking)         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Business Logic (Helpers)        │
│  - Validation, Authentication            │
│  - JWT handling, Stock management        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Data Access Layer (PDO)          │
│  - Database connections                  │
│  - Prepared statements                   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│              MySQL Database              │
└─────────────────────────────────────────┘
```

### Key Design Patterns

1. **Singleton Pattern**: Database connection (single instance)
2. **Helper Classes**: Reusable utility functions
3. **Middleware Pattern**: Authentication/authorization
4. **Repository Pattern**: Data access abstraction
5. **API Response Standardization**: Consistent JSON responses

## API Endpoints

### Authentication

#### 1. Signup
```http
POST /api/v1/auth/signup.php
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "phone": "9876543210"
}
```

#### 2. Login
```http
POST /api/v1/auth/login.php
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "tokens": {
      "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
      "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
      "tokenType": "Bearer",
      "expiresIn": 3600
    }
  }
}
```

#### 3. Get Current User
```http
GET /api/v1/auth/me.php
Authorization: Bearer <access_token>
```

#### 4. Logout
```http
POST /api/v1/auth/logout.php
Authorization: Bearer <access_token>
```

#### 5. Forgot Password
```http
POST /api/v1/auth/forgot-password.php
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### 6. Reset Password
```http
POST /api/v1/auth/reset-password.php
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "password": "NewPassword123",
  "password_confirmation": "NewPassword123"
}
```

### Sales

#### Create Sale
```http
POST /api/v1/sales/create.php
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "customer_name": "Jane Smith",
  "customer_phone": "9876543210",
  "customer_email": "jane@example.com",
  "total_amount": 5000,
  "payment_method": "upi",
  "payment_status": "completed",
  "notes": "Bulk order",
  "items": [
    {
      "product_id": 1,
      "product_name": "Cotton Fabric",
      "quantity": 10,
      "price": 500
    }
  ]
}
```

## Security Features

### 1. Password Requirements
- Minimum 8 characters
- Must contain uppercase letters
- Must contain lowercase letters
- Must contain numbers

### 2. JWT Tokens
- **Access Token**: Short-lived (1 hour)
- **Refresh Token**: Long-lived (30 days)
- Tokens include user ID, email, and role

### 3. Rate Limiting
- Maximum 5 failed login attempts
- 15-minute lockout period

### 4. SQL Injection Protection
- All queries use prepared statements with PDO
- Input sanitization and validation

---

## 📁 Project Structure

```
backend/
│
├── 📁 api/                        # API Endpoints
│   └── v1/                        # Version 1
│       ├── auth/                  # Authentication endpoints
│       │   ├── signup.php         # User registration
│       │   ├── login.php          # User login
│       │   ├── me.php             # Get current user
│       │   ├── logout.php         # User logout
│       │   ├── forgot-password.php # Request password reset
│       │   └── reset-password.php  # Reset password
│       └── sales/                 # Sales endpoints
│           └── create.php         # Create new sale
│
├── 📁 config/                     # Configuration files
│   ├── db.php                     # PDO database connection
│   └── env.php                    # Environment variables loader
│
├── 📁 database/                   # Database files
│   └── schema.sql                 # Database schema and seed data
│
├── 📁 helpers/                    # Helper classes
│   ├── apiResponse.php            # Standardized API responses
│   ├── auth.php                   # Authentication utilities
│   ├── jwt.php                    # JWT token management
│   ├── validator.php              # Input validation & sanitization
│   └── stock.php                  # Stock/inventory management
│
├── 📁 middleware/                 # Middleware
│   └── auth.php                   # JWT authentication middleware
│
├── 📁 logs/                       # Application logs
│   ├── api_error.log              # API error logs
│   └── sql_error.log              # SQL error logs
│
├── 📁 vendor/                     # Composer dependencies (gitignored)
│
├── 📄 .env                        # Environment variables (gitignored)
├── 📄 .env.example                # Environment template
├── 📄 .gitignore                  # Git ignore rules
├── 📄 .htaccess                   # Apache configuration
├── 📄 composer.json               # Composer dependencies
├── 📄 composer.lock               # Locked dependency versions
├── 📄 generate-secret.php         # JWT secret generator
└── 📄 README.md                   # This file
```

### File Responsibilities

#### Config Files
- **`config/db.php`**: Establishes PDO database connection with error handling
- **`config/env.php`**: Loads environment variables from `.env` file using vlucas/phpdotenv

#### Helper Classes
- **`helpers/apiResponse.php`**: Provides static methods for consistent JSON responses
- **`helpers/auth.php`**: Password hashing, verification, rate limiting, role checking
- **`helpers/jwt.php`**: JWT token generation, verification, and refresh logic
- **`helpers/validator.php`**: Input validation rules and sanitization functions
- **`helpers/stock.php`**: Stock availability checking and inventory management

#### Middleware
- **`middleware/auth.php`**: Validates JWT tokens and loads user data for protected routes

#### API Endpoints
All endpoints follow RESTful conventions and return standardized JSON responses.

---

## 🗄️ Database Schema

The database consists of the following tables:

### Core Tables

#### `users`
Stores user accounts and authentication data.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(100) | User's full name |
| email | VARCHAR(100) | Unique email address |
| password | VARCHAR(255) | Bcrypt hashed password |
| phone | VARCHAR(15) | Contact number |
| role | ENUM | User role (super_admin, admin, manager, user, guest) |
| status | ENUM | Account status (active, inactive, suspended) |
| reset_token | VARCHAR(64) | Password reset token |
| reset_token_expiry | DATETIME | Reset token expiration |
| last_login | DATETIME | Last login timestamp |
| created_at | DATETIME | Account creation timestamp |

#### `products`
Product catalog and inventory.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(200) | Product name |
| description | TEXT | Product description |
| sku | VARCHAR(50) | Unique product code |
| category | VARCHAR(100) | Product category |
| price | DECIMAL(10,2) | Selling price |
| cost_price | DECIMAL(10,2) | Cost price |
| stock_quantity | INT | Available stock |
| low_stock_threshold | INT | Alert threshold |
| status | ENUM | Product status |

#### `sales`
Sales transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | Foreign key to users |
| customer_name | VARCHAR(100) | Customer name |
| customer_phone | VARCHAR(15) | Customer phone |
| total_amount | DECIMAL(10,2) | Total sale amount |
| payment_method | ENUM | Payment method |
| payment_status | ENUM | Payment status |
| created_at | DATETIME | Sale timestamp |

#### `sale_items`
Individual items in each sale.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| sale_id | INT | Foreign key to sales |
| product_id | INT | Foreign key to products |
| product_name | VARCHAR(200) | Product name (snapshot) |
| quantity | INT | Quantity sold |
| price | DECIMAL(10,2) | Unit price |
| subtotal | DECIMAL(10,2) | Line total |

### Supporting Tables

- **`categories`**: Product categorization
- **`customers`**: Customer information
- **`stock_movements`**: Inventory tracking history
- **`login_attempts`**: Failed login tracking for rate limiting

### Database Relationships

```
users (1) ────< (N) sales
sales (1) ────< (N) sale_items
products (1) ────< (N) sale_items
products (1) ────< (N) stock_movements
categories (1) ────< (N) products
```

---

## 📡 API Documentation

### Base URL

```
http://localhost/anu-s-textiles/backend/api/v1
```

### Default Admin Credentials

```
Email: admin@anutextiles.com
Password: Admin@123
```

⚠️ **Important**: Change the default password immediately after first login!

---

## 🔐 Authentication Flow

Understanding how authentication works in this API:

### 1. User Registration Flow

```
┌─────────┐         ┌─────────┐         ┌──────────┐
│ Client  │────────>│   API   │────────>│ Database │
└─────────┘         └─────────┘         └──────────┘
     │                   │                     │
     │  POST /signup     │                     │
     │  (credentials)    │                     │
     │──────────────────>│                     │
     │                   │ Validate input      │
     │                   │ Hash password       │
     │                   │ Insert user         │
     │                   │────────────────────>│
     │                   │<────────────────────│
     │                   │ Generate JWT tokens │
     │<──────────────────│                     │
     │  200 OK           │                     │
     │  (user + tokens)  │                     │
```

### 2. Login Flow

```
┌─────────┐         ┌─────────┐         ┌──────────┐
│ Client  │────────>│   API   │────────>│ Database │
└─────────┘         └─────────┘         └──────────┘
     │                   │                     │
     │  POST /login      │                     │
     │  (email+password) │                     │
     │──────────────────>│                     │
     │                   │ Check rate limit    │
     │                   │────────────────────>│
     │                   │ Verify credentials  │
     │                   │────────────────────>│
     │                   │<────────────────────│
     │                   │ Generate JWT tokens │
     │<──────────────────│                     │
     │  200 OK           │                     │
     │  (user + tokens)  │                     │
```

### 3. Authenticated Request Flow

```
┌─────────┐         ┌────────────┐         ┌─────────┐         ┌──────────┐
│ Client  │────────>│ Middleware │────────>│   API   │────────>│ Database │
└─────────┘         └────────────┘         └─────────┘         └──────────┘
     │                     │                      │                   │
     │  GET /me            │                      │                   │
     │  Authorization:     │                      │                   │
     │  Bearer <token>     │                      │                   │
     │────────────────────>│                      │                   │
     │                     │ Extract token        │                   │
     │                     │ Verify JWT           │                   │
     │                     │ Decode payload       │                   │
     │                     │ Load user data       │                   │
     │                     │─────────────────────────────────────────>│
     │                     │<─────────────────────────────────────────│
     │                     │────────────────────>│                   │
     │                     │                      │ Process request   │
     │<────────────────────────────────────────────                   │
     │  200 OK                                    │                   │
     │  (user data)                               │                   │
```

### JWT Token Structure

**Access Token Payload:**
```json
{
  "iat": 1673827200,
  "exp": 1673830800,
  "iss": "localhost",
  "sub": 1,
  "email": "user@example.com",
  "role": "user",
  "type": "access"
}
```

**Token Types:**
- **Access Token**: Used for API requests, expires in 1 hour
- **Refresh Token**: Used to get new access tokens, expires in 30 days

---

## 🔧 Adding New Endpoints

Follow this guide to add new API endpoints:

### Step 1: Create the Endpoint File

Create a new PHP file in the appropriate directory:

```bash
# Example: Create a new product listing endpoint
touch api/v1/products/list.php
```

### Step 2: Endpoint Template

```php
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../helpers/apiResponse.php';
require_once __DIR__ . '/../../../middleware/auth.php';

// For protected endpoints, authenticate user
$user = AuthMiddleware::authenticate();

// For public endpoints, skip authentication

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Method not allowed', 405);
}

try {
    // Your business logic here
    $stmt = $pdo->prepare("SELECT * FROM products WHERE status = 'active'");
    $stmt->execute();
    $products = $stmt->fetchAll();

    ApiResponse::success([
        'products' => $products
    ], 'Products retrieved successfully');

} catch (PDOException $e) {
    error_log("Error: " . $e->getMessage(), 3, __DIR__ . '/../../../logs/api_error.log');
    ApiResponse::serverError('Failed to retrieve products');
}
?>
```

### Step 3: Add Validation (if needed)

```php
require_once __DIR__ . '/../../../helpers/validator.php';

$input = json_decode(file_get_contents('php://input'), true);

$rules = [
    'name' => 'required|min:2|max:200',
    'price' => 'required|numeric',
    'stock' => 'required|integer'
];

$errors = Validator::validate($input, $rules);

if (!empty($errors)) {
    ApiResponse::validationError($errors);
}
```

### Step 4: Test Your Endpoint

```bash
curl -X GET \
  http://localhost/anu-s-textiles/backend/api/v1/products/list.php \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

---

## 🧪 Testing

### Manual Testing with cURL

#### Test Signup
```bash
curl -X POST \
  http://localhost/anu-s-textiles/backend/api/v1/auth/signup.php \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test@123",
    "phone": "9876543210"
  }'
```

#### Test Login
```bash
curl -X POST \
  http://localhost/anu-s-textiles/backend/api/v1/auth/login.php \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@anutextiles.com",
    "password": "Admin@123"
  }'
```

#### Test Protected Endpoint
```bash
# Save the token from login response
TOKEN="your-access-token-here"

curl -X GET \
  http://localhost/anu-s-textiles/backend/api/v1/auth/me.php \
  -H 'Authorization: Bearer '$TOKEN
```

#### Test Create Sale
```bash
curl -X POST \
  http://localhost/anu-s-textiles/backend/api/v1/sales/create.php \
  -H 'Authorization: Bearer '$TOKEN \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "John Doe",
    "customer_phone": "9876543210",
    "total_amount": 5000,
    "payment_method": "cash",
    "items": [
      {
        "product_id": 1,
        "product_name": "Cotton Fabric",
        "quantity": 10,
        "price": 500
      }
    ]
  }'
```

### Testing with Postman

1. **Import Collection**: Create a new Postman collection
2. **Set Environment Variables**:
   - `BASE_URL`: `http://localhost/anu-s-textiles/backend/api/v1`
   - `ACCESS_TOKEN`: (set after login)

3. **Create Requests**:
   - Add requests for each endpoint
   - Use `{{BASE_URL}}` and `{{ACCESS_TOKEN}}` variables

4. **Automated Tests**: Add test scripts in Postman:

```javascript
// Test script for login endpoint
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has access token", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data.tokens.accessToken).to.be.a('string');
    pm.environment.set("ACCESS_TOKEN", jsonData.data.tokens.accessToken);
});
```

---

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Database connection failed"

**Symptoms**: Getting 500 error with database connection message

**Solutions**:
1. Check database credentials in `.env`
2. Verify MySQL service is running:
   ```bash
   sudo systemctl status mysql
   ```
3. Check database exists:
   ```bash
   mysql -u root -p -e "SHOW DATABASES LIKE 'anu_textiles';"
   ```
4. Grant proper permissions:
   ```sql
   GRANT ALL PRIVILEGES ON anu_textiles.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

#### Issue 2: "Invalid token" or "Token has expired"

**Symptoms**: 401 Unauthorized error on protected endpoints

**Solutions**:
1. Check token hasn't expired (1 hour for access tokens)
2. Verify token format: `Bearer <token>`
3. Ensure JWT_SECRET in `.env` matches the one used to generate token
4. Check Authorization header is being sent:
   ```bash
   curl -v -H "Authorization: Bearer $TOKEN" ...
   ```

#### Issue 3: "Composer dependencies not found"

**Symptoms**: Class not found errors for Firebase\JWT or Dotenv

**Solutions**:
1. Install Composer dependencies:
   ```bash
   cd backend
   composer install
   ```
2. Check `vendor/autoload.php` exists
3. Verify `require_once` paths are correct

#### Issue 4: "Permission denied" on logs

**Symptoms**: Cannot write to log files

**Solutions**:
```bash
chmod -R 777 backend/logs/
# Or create log files manually
touch backend/logs/api_error.log backend/logs/sql_error.log
chmod 666 backend/logs/*.log
```

#### Issue 5: CORS errors in browser

**Symptoms**: Frontend can't access API due to CORS

**Solutions**:
1. Check `.htaccess` has CORS headers
2. For specific origins, update `.htaccess`:
   ```apache
   Header set Access-Control-Allow-Origin "https://yourdomain.com"
   ```
3. Ensure Apache mod_headers is enabled:
   ```bash
   sudo a2enmod headers
   sudo systemctl restart apache2
   ```

### Debugging Tips

#### Enable Debug Mode

In `.env`:
```env
APP_DEBUG=true
```

This will show detailed error messages in API responses.

#### Check Error Logs

```bash
# View API errors
tail -f backend/logs/api_error.log

# View SQL errors
tail -f backend/logs/sql_error.log

# View Apache errors
tail -f /var/log/apache2/error.log
```

#### Test Database Connection

```bash
php -r "
require 'backend/config/env.php';
try {
    \$pdo = new PDO('mysql:host='.\$_ENV['DB_HOST'].';dbname='.\$_ENV['DB_NAME'], \$_ENV['DB_USER'], \$_ENV['DB_PASS']);
    echo 'Database connection successful!';
} catch (PDOException \$e) {
    echo 'Connection failed: ' . \$e->getMessage();
}
"
```

---

## 💼 Development Workflow

### Branching Strategy

```
main (production)
  │
  ├── develop (integration)
  │     │
  │     ├── feature/user-profile
  │     ├── feature/inventory-alerts
  │     └── bugfix/login-rate-limit
  │
  └── hotfix/critical-security-patch
```

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write code
   - Test locally
   - Add validation
   - Update documentation

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add product search endpoint"
   ```

4. **Test Thoroughly**
   - Test all affected endpoints
   - Check error handling
   - Verify database changes
   - Test edge cases

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Conventions

```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes (formatting)
refactor: Code refactoring
test: Adding tests
chore: Maintenance tasks
```

---

## 🔒 Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env` file to Git
- ✅ Use different secrets for each environment
- ✅ Rotate JWT secrets periodically (every 6-12 months)
- ✅ Use strong, random JWT secrets (minimum 64 characters)

### 2. Password Security
- ✅ Enforce strong password requirements
- ✅ Use Bcrypt with cost factor 12 or higher
- ✅ Never store plain-text passwords
- ✅ Implement password reset with expiring tokens

### 3. Rate Limiting
- ✅ Limit login attempts (5 per 15 minutes)
- ✅ Implement API rate limiting for production
- ✅ Monitor suspicious activity
- ✅ Use CAPTCHA for repeated failures

### 4. Input Validation
- ✅ Validate all user inputs
- ✅ Sanitize data before database operations
- ✅ Use parameterized queries (PDO)
- ✅ Validate file uploads (if implemented)

### 5. Token Management
- ✅ Use short-lived access tokens (1 hour)
- ✅ Implement token refresh mechanism
- ✅ Invalidate tokens on logout
- ✅ Consider implementing token blacklisting

### 6. HTTPS in Production
```apache
# Force HTTPS (add to .htaccess in production)
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### 7. Database Security
- ✅ Use least privilege principle for database users
- ✅ Don't use root account in production
- ✅ Regular backups
- ✅ Encrypt sensitive data at rest

### 8. Error Handling
- ✅ Never expose stack traces in production
- ✅ Log errors securely
- ✅ Return generic error messages to clients
- ✅ Monitor error logs regularly

### 9. File Permissions
```bash
# Recommended permissions
chmod 644 *.php                    # PHP files
chmod 755 api/ config/ helpers/    # Directories
chmod 600 .env                     # Environment file
chmod 777 logs/                    # Log directory
```

### 10. Security Headers (Already in .htaccess)
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block

---

## ❓ FAQ

### Q: How do I add a new user role?

**A:** Modify the `users` table ENUM and update the role hierarchy in `helpers/auth.php`:

```php
public static function checkPermission($userRole, $requiredRole) {
    $roleHierarchy = [
        'super_admin' => 5,
        'admin' => 4,
        'your_new_role' => 3,  // Add here
        'manager' => 2,
        'user' => 1,
        'guest' => 0
    ];
    // ...
}
```

### Q: How can I change token expiry time?

**A:** Update `.env` file:

```env
JWT_EXPIRY=7200           # 2 hours
JWT_REFRESH_EXPIRY=604800 # 7 days
```

### Q: How do I add custom validation rules?

**A:** Extend the `Validator` class in `helpers/validator.php`:

```php
case 'custom_rule':
    if (!empty($value) && !your_validation_logic($value)) {
        return 'Custom error message';
    }
    break;
```

### Q: Can I use this API with a frontend framework?

**A:** Yes! The API is framework-agnostic. Works with:
- React / Next.js
- Vue.js / Nuxt.js
- Angular
- Vanilla JavaScript
- Mobile apps (React Native, Flutter)

Example fetch with React:
```javascript
const response = await fetch('http://localhost/anu-s-textiles/backend/api/v1/auth/login.php', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});
const data = await response.json();
```

### Q: How do I deploy to production?

**A:** Follow these steps:

1. Set up production server (VPS, shared hosting, etc.)
2. Install PHP 7.4+, MySQL, Apache/Nginx
3. Upload code via FTP/SFTP or Git
4. Run `composer install --no-dev --optimize-autoloader`
5. Create production `.env` file with secure credentials
6. Import database schema
7. Set proper file permissions
8. Enable HTTPS
9. Configure firewall
10. Set up automated backups

### Q: How do I backup the database?

**A:** Use mysqldump:

```bash
# Backup
mysqldump -u root -p anu_textiles > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p anu_textiles < backup_20240115.sql
```

### Q: Can I use PostgreSQL instead of MySQL?

**A:** Yes, with minimal changes:

1. Update DSN in `config/db.php`:
   ```php
   $dsn = "pgsql:host={$_ENV['DB_HOST']};dbname={$_ENV['DB_NAME']}";
   ```
2. Adjust SQL syntax (ENUM → CHECK constraints, NOW() → CURRENT_TIMESTAMP, etc.)
3. Update `database/schema.sql` for PostgreSQL

### Q: How do I enable email functionality for password reset?

**A:** You need to:

1. Configure SMTP in `.env`
2. Install PHPMailer: `composer require phpmailer/phpmailer`
3. Create email helper in `helpers/email.php`
4. Update `forgot-password.php` to send emails

---

## 📚 Additional Resources

- [PHP PDO Documentation](https://www.php.net/manual/en/book.pdo.php)
- [Firebase PHP-JWT](https://github.com/firebase/php-jwt)
- [JWT Introduction](https://jwt.io/introduction)
- [REST API Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 🤝 Contributing

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'feat: add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Code Style Guidelines

- Follow PSR-12 coding standards
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write reusable, modular code

### Pull Request Checklist

- [ ] Code follows project structure
- [ ] Added/updated documentation
- [ ] Tested all changes locally
- [ ] No security vulnerabilities introduced
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Database changes documented

---

## Error Handling

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": {}
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Server Error

---

## 📞 Support

If you encounter any issues or have questions:

1. **Check the [FAQ](#faq)** section first
2. **Review [Troubleshooting](#troubleshooting)** guide
3. **Check error logs** in `logs/` directory
4. **Search existing issues** in the repository
5. **Create a new issue** with detailed information

When reporting issues, include:
- PHP version (`php -v`)
- MySQL version (`mysql --version`)
- Error messages from logs
- Steps to reproduce
- Expected vs actual behavior

---

## 📝 License

**Proprietary License**

Copyright © 2024 Anu's Textiles. All rights reserved.

This software and associated documentation files are proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software is strictly prohibited without explicit written permission from Anu's Textiles.

---

## 👥 Credits

**Developed by:** Anu's Textiles Development Team

**Built with:**
- PHP 7.4+
- MySQL
- Composer
- Firebase PHP-JWT
- PHP-Dotenv

---

## 🚀 Quick Start Recap

```bash
# 1. Clone and install
git clone <repo-url>
cd anu-s-textiles/backend
composer install

# 2. Configure environment
cp .env.example .env
php generate-secret.php
# Update .env with credentials and JWT secret

# 3. Setup database
mysql -u root -p < database/schema.sql

# 4. Set permissions
chmod -R 755 .
chmod -R 777 logs/

# 5. Test installation
curl http://localhost/anu-s-textiles/backend/api/v1/auth/login.php
```

---

**Happy Coding! 🎉**

For any questions or contributions, please follow the [Contributing](#contributing) guidelines.
