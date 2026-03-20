# API v2 Documentation

## Overview
API v2 provides enhanced endpoints with improved data structure and additional features.

---

## 1. Item API (`/api/v2/item.php`)

Enhanced item management with additional fields like S.no, Lot No, Counts, Colour, Cones, Grams, Gross Weight, and Net Weight.

### Endpoints

#### GET - List Items
```
GET /api/v2/item.php?page=1&limit=50
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `search` (optional): Search in name, item_code, lot_no, hsn_code
- `item_group_id` (optional): Filter by item group
- `status` (optional): Filter by status (active, inactive, discontinued)

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "s_no": 1,
        "item_group_id": 3,
        "item_group_name": "Synthetic Fabrics",
        "name": "Cotton Yarn 40s",
        "item_code": "YARN-001",
        "lot_no": "LOT2024001",
        "counts": "40",
        "colour": "White",
        "cones": 50,
        "grams": 1000.5,
        "gross_weight": 50.25,
        "net_weight": 49950.75,
        "hsn_code": "5205",
        "unit_name": "Kilogram",
        "opening_stock": 100.000,
        "standard_price": 450.00,
        "status": "active"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

#### GET - Single Item
```
GET /api/v2/item.php?id=1
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "s_no": 1,
    "item_group_id": 3,
    "name": "Cotton Yarn 40s",
    "item_code": "YARN-001",
    "lot_no": "LOT2024001",
    "counts": "40",
    "colour": "White",
    "cones": 50,
    "grams": 1000.5,
    "gross_weight": 50.25,
    "net_weight": 49950.75,
    "hsn_code": "5205",
    "unit_id": 4,
    "opening_stock": 100.000,
    "standard_price": 450.00,
    "status": "active"
  }
}
```

#### POST - Create Item
```
POST /api/v2/item.php
```

**Request Body:**
```json
{
  "name": "Cotton Yarn 40s",
  "item_code": "YARN-001",
  "lot_no": "LOT2024001",
  "counts": "40",
  "colour": "White",
  "cones": 50,
  "grams": 1000.5,
  "gross_weight": 50.25,
  "item_group_id": 3,
  "hsn_code": "5205",
  "unit_id": 4,
  "opening_stock": 100.000,
  "standard_price": 450.00
}
```

**Auto-calculated Field:**
- `net_weight` = `(cones * grams) - gross_weight`

**Response:**
```json
{
  "status": "success",
  "message": "Item created successfully",
  "data": {
    "id": 1,
    "s_no": 1,
    "name": "Cotton Yarn 40s",
    "net_weight": 49950.75
  }
}
```

#### PUT - Update Item
```
PUT /api/v2/item.php
```

**Request Body:**
```json
{
  "id": 1,
  "name": "Cotton Yarn 40s Updated",
  "cones": 60,
  "grams": 1200.5,
  "gross_weight": 55.00
}
```

**Note:** `net_weight` is auto-recalculated on update.

#### DELETE - Delete Item
```
DELETE /api/v2/item.php
```

**Request Body:**
```json
{
  "id": 1
}
```

**Note:** Performs soft delete (sets status to 'inactive').

---

## 2. Ledger Statement API (`/api/v2/ledger-statement.php`)

View complete ledger statement with all transactions, running balance, and opening/closing balance.

### Endpoint

#### GET - Ledger Statement
```
GET /api/v2/ledger-statement.php?ledger_id=5&from_date=2024-01-01&to_date=2024-12-31
```

**Query Parameters:**
- `ledger_id` (required): Ledger ID for statement
- `from_date` (optional): Start date (YYYY-MM-DD)
- `to_date` (optional): End date (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Entries per page (default: 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "ledger": {
      "id": 5,
      "name": "ABC Traders",
      "group_name": "Sundry Debtors",
      "group_nature": "Asset",
      "address": "123 Main Street, Mumbai",
      "phone": "9876543210",
      "email": "abc@example.com",
      "gst_number": "27XXXXX1234X1Z5"
    },
    "statement": {
      "opening_balance": 5000.00,
      "opening_type": "Dr",
      "entries": [
        {
          "id": 101,
          "voucher_id": 45,
          "voucher_type": "Sales",
          "voucher_no": "INV-001",
          "voucher_date": "2024-01-15",
          "reference_no": "REF-001",
          "party_name": "ABC Traders",
          "bill_reference": "BILL-001",
          "description": "Sale of Cotton Fabric",
          "debit": 10000.00,
          "credit": 0,
          "balance": 15000.00,
          "balance_type": "Dr"
        },
        {
          "id": 102,
          "voucher_id": 52,
          "voucher_type": "Receipt",
          "voucher_no": "RCP-001",
          "voucher_date": "2024-01-20",
          "reference_no": null,
          "party_name": "ABC Traders",
          "bill_reference": "BILL-001",
          "description": "Payment received",
          "debit": 0,
          "credit": 5000.00,
          "balance": 10000.00,
          "balance_type": "Dr"
        }
      ],
      "closing_balance": 10000.00,
      "closing_type": "Dr",
      "total_debit": 10000.00,
      "total_credit": 5000.00
    },
    "filters": {
      "from_date": "2024-01-01",
      "to_date": "2024-12-31"
    },
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 100,
      "pages": 1
    }
  }
}
```

### Features

1. **Opening Balance Calculation**
   - Uses ledger's opening balance if no from_date
   - Calculates opening balance from previous transactions if from_date is provided

2. **Running Balance**
   - Each entry shows current balance after the transaction
   - Balance type (Dr/Cr) is calculated dynamically

3. **Date Filtering**
   - Filter transactions by date range
   - Opening balance adjusts based on from_date

4. **Pagination**
   - Supports paginated results for large statements
   - Default 100 entries per page

5. **Transaction Details**
   - Voucher type (Sales, Purchase, Receipt, Payment, etc.)
   - Voucher number and date
   - Party name (if applicable)
   - Bill reference for bill-by-bill tracking
   - Debit and Credit amounts
   - Running balance with Dr/Cr type

6. **Summary**
   - Opening balance and type
   - Closing balance and type
   - Total debit and credit for the period

---

## 3. Notifications API (`/api/v2/notifications.php`)

Manage in-app notifications with unread tracking.

### Endpoints

#### GET - List Notifications
```
GET /api/v2/notifications.php?company_id=1&page=1&limit=20
```

**Query Parameters:**
- `company_id` (optional): Company scope
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 20)
- `unread_only` (optional): `true` to fetch unread only

**Response (example):**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "id": 2,
        "title": "Low Stock Alert",
        "message": "Item Grey Fabric Roll is low in stock",
        "notification_type": "warning",
        "company_id": 5,
        "is_read": false,
        "read_at": null,
        "created_at": "2026-02-16 11:41:44",
        "meta": {
          "module": "stock",
          "priority": "high"
        }
      }
    ],
    "unread_count": 1,
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

#### POST - Create Notification
```
POST /api/v2/notifications.php
```

**Request Body:**
```json
{
  "company_id": 1,
  "title": "Low Stock Alert",
  "message": "Item Grey Fabric Roll is low in stock",
  "notification_type": "warning",
  "meta": {
    "module": "stock",
    "priority": "high"
  }
}
```

#### GET - Notification Count
```
GET /api/v2/notifications.php?company_id=1&count_only=true
```

**Response:**
```json
{
  "success": true,
  "message": "Notification counts retrieved successfully",
  "data": {
    "total": 1,
    "unread": 1
  }
}
```

#### PUT - Mark One Notification as Read
```
PUT /api/v2/notifications.php
```

**Request Body:**
```json
{
  "id": 2
}
```

#### PUT - Mark All Notifications as Read
```
PUT /api/v2/notifications.php
```

**Request Body:**
```json
{
  "mark_all": true,
  "company_id": 1
}
```

#### DELETE - Delete Notification
```
DELETE /api/v2/notifications.php
```

**Request Body:**
```json
{
  "id": 2
}
```

---

## Authentication

All API v2 endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Error Responses

### Validation Error (400)
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "name": ["Name is required"],
    "cones": ["Cones must be a number"]
  }
}
```

### Not Found (404)
```json
{
  "status": "error",
  "message": "Item not found"
}
```

### Server Error (500)
```json
{
  "status": "error",
  "message": "Failed to process request. Please try again."
}
```

---

## Changelog

### v2.1.0
- Added Notifications API (`/api/v2/notifications.php`) with list, count, create, mark-read, and delete support
- Added Dashboard API (`/api/v2/dashboard.php`) with KPI cards and monthly chart datasets
- Added estimate discount method support (`%` and `₹`) with explicit response fields for UI binding

### v2.0.0
- Added Item API with enhanced fields (S.no, Lot No, Counts, Colour, Cones, Grams, Gross Weight, Net Weight)
- Added Ledger Statement API with running balance and date filtering
- Auto-calculation of net_weight in Item API
- Improved pagination and search functionality
