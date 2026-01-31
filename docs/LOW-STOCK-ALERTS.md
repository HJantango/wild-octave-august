# Low Stock Alerts

Proactive inventory monitoring that identifies items running low based on current stock levels and recent sales velocity.

## Overview

The low stock alert system:
- Analyzes inventory levels against reorder points
- Calculates sales velocity from recent Square sales data
- Predicts days of stock remaining
- Groups alerts by priority (critical, warning, watch)
- Suggests reorder quantities

## API Endpoint

### GET `/api/reports/low-stock`

Returns items that need attention based on stock levels and sales patterns.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `daysAhead` | number | 7 | Days of sales history to analyze |
| `urgencyDays` | number | 14 | Show items with less than N days of stock |
| `includeNoStock` | boolean | false | Include items with no inventory tracking |
| `vendorId` | string | - | Filter by specific vendor |
| `category` | string | - | Filter by item category |

#### Response

```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-31T10:00:00.000Z",
    "timezone": "AEDT (UTC+11)",
    "periodAnalyzed": "Last 7 days",
    "items": [
      {
        "itemId": "abc123",
        "name": "Organic Almonds 500g",
        "category": "Nuts & Seeds",
        "vendorId": "vendor123",
        "vendorName": "Real Foods",
        "currentStock": 5,
        "reorderPoint": 10,
        "minimumStock": 5,
        "avgDailySales": 2.5,
        "daysOfStockRemaining": 2.0,
        "suggestedReorderQty": 70,
        "priority": "critical",
        "reason": "⏰ Only 2.0 days of stock!",
        "lastSoldDate": "2025-01-30"
      }
    ],
    "summary": {
      "total": 15,
      "critical": 3,
      "warning": 5,
      "watch": 7
    }
  }
}
```

## CLI Script

### Usage

```bash
# WhatsApp-formatted output (default)
npm run stock

# Raw JSON output
npm run stock -- --json

# Analyze more days of sales history
npm run stock -- --days 14

# Only show critical items
npm run stock -- --urgent
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Alerts found (action needed) |
| 1 | Error occurred |
| 2 | No alerts (stock levels healthy) |

## Priority Levels

| Priority | Condition |
|----------|-----------|
| 🚨 Critical | Out of stock, below reorder point, or < 3 days remaining |
| ⚠️ Warning | < 7 days of stock remaining |
| 👀 Watch | < 14 days of stock remaining |
| ✅ OK | Stock levels healthy |

## Suggested Reorder Quantity

The system suggests reorder quantities to bring stock up to ~30 days based on current sales velocity:

```
suggested = max(0, ceil((30 - currentDaysOfStock) × avgDailySales))
```

## Clawdbot Integration

Set up a daily cron job to check stock and send alerts:

```bash
# Check daily at 8am AEDT
clawdbot cron add --schedule "0 21 * * *" --text "Run npm run stock in wild-octave-august and send results if any alerts found"
```

The script outputs WhatsApp-ready formatting with:
- Priority summary
- Item details with stock levels
- Vendor grouping for easy ordering
- Suggested quantities

## Data Sources

- **Inventory levels**: `InventoryItem` table (currentStock, reorderPoint)
- **Sales velocity**: `SquareDailySales` table (daily sales from Square API)
- **Item metadata**: `Item` table (name, category, vendor)

## Requirements

- Database with inventory data populated
- Square sales sync running to populate `SquareDailySales`
- Items must have `InventoryItem` records for tracking

## Notes

- Items without inventory tracking are skipped by default
- Sales velocity uses simple average (no seasonal adjustment yet)
- Matching uses case-insensitive item name comparison
- All times are AEDT (UTC+11)
