# Vendor Order Reminders

Automated reminder system for vendor orders with upcoming deadlines.

## Overview

The vendor order reminder system checks for orders that are due today and have deadlines approaching. It can send WhatsApp-formatted messages to alert staff about orders that need to be placed.

## Usage

### CLI Script

```bash
# Check for orders with deadlines in the next 2 hours (default)
npm run reminders

# Check for orders in the next 3 hours
npm run reminders -- --hours 3

# Show ALL orders due today (regardless of deadline)
npm run reminders:all

# Output as JSON
npm run reminders:json
```

### API Endpoint

```
GET /api/reports/vendor-reminders
```

Query parameters:
- `hoursAhead` (default: 2) - How many hours ahead to look for deadlines
- `includeNoDeadline` (default: false) - Include orders with no specific deadline time
- `includeAll` (default: false) - Include all orders due today

### Exit Codes

The CLI script uses exit codes for automation:
- `0` - Success, reminders were output
- `1` - Error occurred
- `2` - No reminders needed (all clear)

## Example Output

### WhatsApp Format

```
🚨 *VENDOR ORDER REMINDER*
Thursday 10:30 AM AEDT

🔴 *ORDER NOW*
• *Flannerys* — 28min left (11:00 AM)
  📦 Delivery: Friday

🟡 *Coming Up*
• *United Organics* — 1h 30m (12:00 PM)
  📦 Delivery: Saturday
  _Order extra coconut oil_

📋 *Also Due Today*
• *Local Organics* — no deadline
```

### JSON Format

```json
{
  "timestamp": "2025-01-30T10:30:00.000Z",
  "today": "Thursday",
  "hoursAhead": 2,
  "reminders": [
    {
      "vendorName": "Flannerys",
      "orderDeadline": "11:00 AM",
      "timeRemaining": "28min",
      "minutesUntil": 28,
      "deliveryDay": "Friday",
      "notes": null,
      "isOverdue": false,
      "priority": "urgent"
    }
  ]
}
```

## Priority Levels

- **urgent** (🔴): Overdue OR deadline within 30 minutes
- **soon** (🟡): Deadline within 2 hours
- **today** (📋): Due today with later deadline or no specific deadline

## Clawdbot Cron Setup

To automatically send reminders, set up cron jobs in Clawdbot:

```
# Check at 8am, 10am, 12pm, 2pm AEDT for orders due within 2 hours
0 21,23 * * 1-5  # 8am, 10am AEDT (UTC-11)
0 1,3 * * 2-6    # 12pm, 2pm AEDT (UTC-11)
```

Example cron job text:
```
Run `cd ~/wild-octave-august && npm run reminders` and if there's output (exit code 0), send it to Heath via WhatsApp as vendor order reminders.
```

## Vendor Schedule Setup

Reminders work with the vendor order schedules configured at:
`/ordering/vendor-schedules`

Each schedule should have:
- **Order Day**: Which day of the week orders are placed
- **Order Deadline**: Time by which the order must be submitted (e.g., "11:00 AM")
- **Delivery Day**: Expected delivery day (optional, shown in reminders)
- **Notes**: Any special instructions (shown in reminders)

## Files

- **API**: `src/app/api/reports/vendor-reminders/route.ts`
- **Script**: `scripts/vendor-order-reminders.ts`
- **Docs**: `docs/VENDOR-REMINDERS.md`
