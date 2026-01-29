# Wild Octave Daily Sales Digest

Automated daily sales summary sent to Heath via WhatsApp each morning.

## Features

- **Total Sales**: Yesterday's revenue
- **Transaction Count**: Number of orders
- **Average Basket Size**: Revenue / orders
- **Top 5 Sellers**: Best-selling items by revenue
- **Week-over-Week Comparison**: vs same day last week
- **Anomaly Detection**: Flags unusual spikes or dips

## Components

### API Endpoint

`GET /api/reports/daily-digest`

Query parameters:
- `date` (optional): YYYY-MM-DD format, defaults to yesterday (AEDT)
- `compare` (optional): Set to 'false' to skip last week comparison

Returns JSON:
```json
{
  "success": true,
  "data": {
    "date": "2025-01-28",
    "dateDisplay": "Tuesday, 28 January 2025",
    "totalSales": 1234.56,
    "totalOrders": 42,
    "avgBasketSize": 29.39,
    "topSellers": [...],
    "comparison": {...},
    "anomalies": [...]
  }
}
```

### CLI Script

```bash
# Output formatted message to stdout
npm run digest

# Specific date
npm run digest -- --date 2025-01-28

# With raw JSON debug output
npm run digest:json
```

## WhatsApp Message Format

```
🌿 *Wild Octave Daily Digest*
📅 Tuesday, 28 January 2025

💵 *Total Sales:* $1,234.56
🧾 *Orders:* 42
🛒 *Avg Basket:* $29.39
📊 *vs Last Week:* +$156.78 (+14%) ↑

🏆 *Top 5 Sellers*
🥇 Organic Coffee — 23x ($115.00)
🥈 Sourdough Loaf — 18x ($90.00)
🥉 Almond Milk — 15x ($75.00)
4️⃣ Granola 500g — 12x ($60.00)
5️⃣ Fresh Juice — 10x ($50.00)

💡 *Highlights*
📈 Sales up 14% vs last week!
```

## Setting Up Clawdbot Cron

Add this cron job to send the digest at 7am AEDT daily:

```
# In Clawdbot (via /cron add):
0 20 * * * Generate the Wild Octave daily sales digest for yesterday and send it to Heath.
```

Note: 7am AEDT = 8pm UTC (previous day)

The cron job should:
1. Run `npm run digest` in the wild-octave-august directory
2. Capture the output
3. Send via WhatsApp to Heath

Alternatively, Henry can check the API endpoint directly:
```
curl https://wild-octave.railway.app/api/reports/daily-digest
```

## Environment Variables

Required (set in Railway):
- `SQUARE_ACCESS_TOKEN`: Square API access token
- `SQUARE_ENVIRONMENT`: 'production' or 'sandbox'
- `SQUARE_LOCATION_ID`: Default location (optional)

## Future Enhancements

- [ ] Include payment method breakdown
- [ ] Add previous day comparison (not just week)
- [ ] Category-level sales breakdown
- [ ] Weather correlation (busy when sunny?)
- [ ] Predicted vs actual comparison
