# GST v1 APIs

## E-Way Bill APIs (CharteredInfo)

All endpoints require your backend JWT token in `Authorization: Bearer <token>`.

### 1) Access Token

- Endpoint: `POST /backend/api/v1/gst/ewaybill_access_token.php`
- Required JSON fields: `gstin`, `username`, `ewbpwd`

Example body:

```json
{
  "gstin": "33AAIFE9454A1ZN",
  "username": "earnestmin_API_buy",
  "ewbpwd": "eway@EMTS@123"
}
```

### 2) Create E-Way Bill

- Endpoint: `POST /backend/api/v1/gst/ewaybill_generate.php`
- Live mode required JSON fields: `gstin`, `ewbpwd`, `authtoken`, `payload`

Example body:

```json
{
  "gstin": "33AAIFE9454A1ZN",
  "ewbpwd": "eway@EMTS@123",
  "authtoken": "19ZDdk5XUDrjREpcQefL6ERHd",
  "payload": {
    "supplyType": "O",
    "subSupplyType": "1",
    "docType": "INV",
    "docNo": "EWB-A-091294",
    "docDate": "03/02/2026"
  }
}
```

### 3) Cancel E-Way Bill

- Endpoint: `POST /backend/api/v1/gst/ewaybill_cancel.php`
- Required JSON fields: `gstin`, `username`, `authtoken`, `payload`

Example body:

```json
{
  "gstin": "33AAIFE9454A1ZN",
  "username": "earnestmin_API_buy",
  "authtoken": "19ZDdk5XUDrjREpcQefL6ERHd",
  "payload": {
    "ewbNo": "531958904356",
    "cancelRsnCode": "2",
    "cancelRmrk": "for testing"
  }
}
```

### 4) Print E-Way Bill

- Endpoint: `GET /backend/api/v1/gst/ewaybill_print.php`
- Required query params: `gstin`, `username`, `authtoken`, `ewbNo`
- Also supports `POST` with JSON body containing same fields.

Example GET:

```text
/backend/api/v1/gst/ewaybill_print.php?gstin=33AAIFE9454A1ZN&username=earnestmin_API_buy&authtoken=TOKEN&ewbNo=531958904356
```

## Environment variables

Set these in `backend/.env`:

- `EWB_BASE_URL`
- `EWB_ASP_ID`
- `EWB_ASP_PASSWORD`
- `EWB_AUTH_ACTION`
- `EWB_TIMEOUT`
