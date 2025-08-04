
# API Reference - Wild Octave Organics

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Authentication
Most endpoints require authentication via session cookies or API tokens.

## Endpoints

### Invoice Management

#### Process Invoice
Upload and process a PDF invoice.

```http
POST /api/process-invoice
Content-Type: multipart/form-data
```

**Parameters:**
- `file` (file): PDF invoice file
- `vendor` (string): Vendor name

**Response:**
```json
{
  "success": true,
  "invoiceId": "clx123...",
  "lineItems": [
    {
      "id": "item123",
      "productName": "Organic Almonds",
      "quantity": 10,
      "unitPrice": 15.50,
      "totalPrice": 155.00
    }
  ]
}
```

#### Get Invoices
Retrieve list of processed invoices.

```http
GET /api/invoices?page=1&limit=10&vendor=VendorName&startDate=2025-01-01&endDate=2025-12-31
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10, max: 100)
- `vendor` (string): Filter by vendor name
- `startDate` (string): Start date (YYYY-MM-DD)
- `endDate` (string): End date (YYYY-MM-DD)

### Square Integration

#### Sync with Square
Trigger synchronization with Square API.

```http
POST /api/square/sync
Content-Type: application/json
```

**Body:**
```json
{
  "syncType": "products" | "inventory" | "all",
  "force": false
}
```

#### Get Square Products
Retrieve products from Square catalog.

```http
GET /api/square/products?search=organic&category=supplements&limit=50
```

#### Create Product Link
Link an invoice item to a Square product.

```http
POST /api/square/product-links
Content-Type: application/json
```

**Body:**
```json
{
  "invoiceProductName": "Organic Almonds 1kg",
  "squareProductId": "square_product_id",
  "confidence": 0.95,
  "isManualLink": true
}
```

### Category Management

#### Get Categories
```http
GET /api/categories
```

#### Assign Category
```http
POST /api/assign-category
Content-Type: application/json
```

**Body:**
```json
{
  "lineItemId": "clx123...",
  "categoryId": "cat123..."
}
```

### Webhooks

#### Square Webhooks
Receive webhook events from Square.

```http
POST /api/square/webhooks
Content-Type: application/json
X-Square-Signature: <signature>
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": true,
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

## Rate Limiting

- 100 requests per 15-minute window per IP
- 1000 requests per hour for authenticated users
- Webhook endpoints have higher limits

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
