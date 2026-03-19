# Ledgerwise Outstanding API

## Overview
The Ledgerwise Outstanding API provides a Tally-like view of outstanding bills and receipts/payments for any ledger (Sundry Debtors or Sundry Creditors).

## Endpoint
```
GET /api/v1/masters/ledgers.php?outstanding={ledger_id}
```

## Authentication
- **Required**: Yes (JWT Token in Authorization header)
- **Header**: `Authorization: Bearer {token}`

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `outstanding` | Integer | Yes | The ID of the ledger to get outstanding for |

## Response Format

### For Sundry Debtors Ledger
```json
{
    "success": true,
    "message": "Ledgerwise outstanding retrieved successfully",
    "data": {
        "ledger": {
            "id": 1,
            "name": "Customer Name",
            "group_id": 2,
            "group_name": "Sundry Debtors",
            "nature": "Asset",
            "opening_balance": 0,
            "opening_type": "Dr",
            "bill_by_bill": true,
            "gst_applicable": true,
            "gst_number": "27AABCT1234H1Z0",
            "address": "Customer Address",
            "phone": "9876543210",
            "email": "customer@example.com",
            "created_at": "2025-01-23T10:00:00"
        },
        "outstanding": {
            "ledger_type": "Sundry Debtors",
            "outstanding_bills": [
                {
                    "allocation_id": 101,
                    "bill_no": "INV-001",
                    "bill_date": "2025-01-15",
                    "bill_amount": 50000.00,
                    "pending_amount": 50000.00,
                    "voucher_id": 1,
                    "voucher_no": "S-001",
                    "voucher_date": "2025-01-15",
                    "voucher_type": "Sales",
                    "type": "Bill",
                    "age_days": 8
                },
                {
                    "allocation_id": 102,
                    "bill_no": "INV-002",
                    "bill_date": "2025-01-20",
                    "bill_amount": 30000.00,
                    "pending_amount": 20000.00,
                    "voucher_id": 2,
                    "voucher_no": "S-002",
                    "voucher_date": "2025-01-20",
                    "voucher_type": "Sales",
                    "type": "Bill",
                    "age_days": 3
                }
            ],
            "receipts": [
                {
                    "allocation_id": 103,
                    "bill_no": "RCP-001",
                    "bill_date": "2025-01-22",
                    "receipt_amount": 10000.00,
                    "pending_amount": 0,
                    "voucher_id": 3,
                    "voucher_no": "R-001",
                    "voucher_date": "2025-01-22",
                    "voucher_type": "Receipt",
                    "type": "Receipt",
                    "age_days": 1
                }
            ],
            "total_outstanding": 70000.00,
            "total_receipts": 10000.00
        }
    }
}
```

### For Sundry Creditors Ledger
```json
{
    "success": true,
    "message": "Ledgerwise outstanding retrieved successfully",
    "data": {
        "ledger": {
            "id": 5,
            "name": "Supplier Name",
            "group_id": 3,
            "group_name": "Sundry Creditors",
            "nature": "Liability",
            "opening_balance": 0,
            "opening_type": "Cr",
            "bill_by_bill": true,
            "gst_applicable": true,
            "gst_number": "27AABCS5678H2Z0",
            "address": "Supplier Address",
            "phone": "9876543211",
            "email": "supplier@example.com",
            "created_at": "2025-01-23T10:00:00"
        },
        "outstanding": {
            "ledger_type": "Sundry Creditors",
            "outstanding_bills": [
                {
                    "allocation_id": 201,
                    "bill_no": "PO-001",
                    "bill_date": "2025-01-10",
                    "bill_amount": 100000.00,
                    "pending_amount": 100000.00,
                    "voucher_id": 10,
                    "voucher_no": "P-001",
                    "voucher_date": "2025-01-10",
                    "voucher_type": "Purchase",
                    "type": "Bill",
                    "age_days": 13
                },
                {
                    "allocation_id": 202,
                    "bill_no": "PO-002",
                    "bill_date": "2025-01-18",
                    "bill_amount": 75000.00,
                    "pending_amount": 50000.00,
                    "voucher_id": 11,
                    "voucher_no": "P-002",
                    "voucher_date": "2025-01-18",
                    "voucher_type": "Purchase",
                    "type": "Bill",
                    "age_days": 5
                }
            ],
            "payments": [
                {
                    "allocation_id": 203,
                    "bill_no": "PMT-001",
                    "bill_date": "2025-01-20",
                    "payment_amount": 25000.00,
                    "pending_amount": 0,
                    "voucher_id": 12,
                    "voucher_no": "PMT-001",
                    "voucher_date": "2025-01-20",
                    "voucher_type": "Payment",
                    "type": "Payment",
                    "age_days": 3
                }
            ],
            "total_outstanding": 150000.00,
            "total_payments": 25000.00
        }
    }
}
```

## Error Responses

### Ledger Not Found
```json
{
    "success": false,
    "message": "Ledger not found",
    "data": null
}
```
**Status Code**: 404

### Invalid Ledger Type
```json
{
    "success": false,
    "message": "This ledger type does not have outstanding tracking",
    "data": null
}
```
**Status Code**: 400

### Unauthorized
```json
{
    "success": false,
    "message": "Unauthorized",
    "data": null
}
```
**Status Code**: 401

## Usage Examples

### cURL
```bash
# Get outstanding for Sundry Debtor (Customer)
curl -X GET "http://localhost/api/v1/masters/ledgers.php?outstanding=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Get outstanding for Sundry Creditor (Supplier)
curl -X GET "http://localhost/api/v1/masters/ledgers.php?outstanding=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### JavaScript/Fetch
```javascript
async function getLedgerOutstanding(ledgerId, token) {
  const response = await fetch(
    `/api/v1/masters/ledgers.php?outstanding=${ledgerId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Usage
const result = await getLedgerOutstanding(1, 'your_jwt_token');
console.log(result.data.outstanding);
```

## Frontend Integration Example

### React Component (Tally-like View)
```jsx
import React, { useState, useEffect } from 'react';

function LedgerOutstandingView({ ledgerId, token }) {
  const [outstanding, setOutstanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOutstanding();
  }, [ledgerId]);

  const fetchOutstanding = async () => {
    try {
      const response = await fetch(
        `/api/v1/masters/ledgers.php?outstanding=${ledgerId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setOutstanding(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch outstanding');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!outstanding) return <div>No data</div>;

  const { ledger, outstanding: data } = outstanding;
  const isSundryDebtor = data.ledger_type === 'Sundry Debtors';

  return (
    <div className="ledger-outstanding">
      <h2>{ledger.name} ({data.ledger_type})</h2>
      
      <div className="bills-section">
        <h3>{isSundryDebtor ? 'Sales Bills' : 'Purchase Bills'}</h3>
        <table>
          <thead>
            <tr>
              <th>Bill No</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Pending</th>
              <th>Age (Days)</th>
            </tr>
          </thead>
          <tbody>
            {data.outstanding_bills.map((bill) => (
              <tr key={bill.allocation_id}>
                <td>{bill.bill_no}</td>
                <td>{bill.bill_date}</td>
                <td>{bill.bill_amount.toFixed(2)}</td>
                <td>{bill.pending_amount.toFixed(2)}</td>
                <td>{bill.age_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><strong>Total Outstanding: {data.total_outstanding.toFixed(2)}</strong></p>
      </div>

      <div className="receipts-section">
        <h3>{isSundryDebtor ? 'Receipts' : 'Payments'}</h3>
        <table>
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Date</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(isSundryDebtor ? data.receipts : data.payments).map((item) => (
              <tr key={item.allocation_id}>
                <td>{item.bill_no}</td>
                <td>{item.bill_date}</td>
                <td>{(item.receipt_amount || item.payment_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><strong>Total {isSundryDebtor ? 'Receipts' : 'Payments'}: {(isSundryDebtor ? data.total_receipts : data.total_payments).toFixed(2)}</strong></p>
      </div>
    </div>
  );
}

export default LedgerOutstandingView;
```

## Key Features

✅ **Tally-like View**: Shows outstanding bills and receipts/payments similar to Tally ERP  
✅ **Smart Ledger Detection**: Automatically identifies ledger type and shows appropriate data  
✅ **Bill-by-Bill Tracking**: Displays individual bills with pending amounts  
✅ **Age Analysis**: Shows how old each bill is (calculated from bill_date)  
✅ **Transaction Totals**: Aggregates total outstanding and total receipts/payments  
✅ **Status Filtering**: Only shows posted vouchers  

## SQL Queries Used

### For Sundry Debtors - Outstanding Sales Bills
```sql
SELECT ba.*, v.*, DATEDIFF(CURDATE(), ba.bill_date) as age_days
FROM bill_allocations ba
INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
INNER JOIN vouchers v ON ve.voucher_id = v.id
WHERE ba.ledger_id = {ledger_id}
AND ba.type = 'New'
AND ba.pending_amount > 0
AND v.voucher_type = 'Sales'
AND v.status = 'posted'
ORDER BY ba.bill_date ASC
```

### For Sundry Debtors - Receipts Received
```sql
SELECT ba.*, v.*, DATEDIFF(CURDATE(), ba.bill_date) as age_days
FROM bill_allocations ba
INNER JOIN voucher_entries ve ON ba.voucher_entry_id = ve.id
INNER JOIN vouchers v ON ve.voucher_id = v.id
WHERE ba.ledger_id = {ledger_id}
AND ba.type = 'Against'
AND v.voucher_type = 'Receipt'
AND v.status = 'posted'
ORDER BY ba.bill_date DESC
```

## Similar Implementation for Sundry Creditors
The same queries apply but with:
- `v.voucher_type = 'Purchase'` for bills
- `v.voucher_type = 'Payment'` for payments

## Related Endpoints

- `GET /api/v1/masters/ledgers.php?id={id}` - Get single ledger details
- `GET /api/v1/masters/ledgers.php` - List all ledgers
- `GET /api/v1/vouchers/sales.php?party_id={id}` - List sales invoices for a party
- `GET /api/v1/vouchers/purchase.php?party_id={id}` - List purchase invoices for a party
- `GET /api/v1/vouchers/receipt.php?party_id={id}` - List receipts for a party
- `GET /api/v1/vouchers/payment.php?outstanding_for={id}` - Get outstanding bills for payment

## Notes

- The API requires authentication (JWT token)
- Only Sundry Debtors and Sundry Creditors ledgers are supported
- Bill-by-bill tracking must be enabled on the ledger for this feature to work
- Pending amounts are calculated based on bill allocations with type='New'
- Only 'posted' vouchers are included in the outstanding report
