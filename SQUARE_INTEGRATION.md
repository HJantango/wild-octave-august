# Square Integration Documentation

## Overview

The Square integration connects your Wild Octave Organics dashboard to Square Point of Sale system using the MCP (Model Context Protocol) for real-time sales data, inventory management, and analytics.

## Features

### 🔄 Real-time Data Sync
- **Catalog Items**: Sync menu items, prices, and categories from Square
- **Orders**: Real-time order data with line items and customer information  
- **Payments**: Payment processing status and financial metrics
- **Sales Analytics**: Comprehensive sales reporting and insights

### 📊 Dashboard Integration
- **Live Sales Metrics**: Revenue, order count, average order value
- **Top Selling Items**: Real-time bestseller tracking
- **Payment Success Rate**: Transaction reliability monitoring
- **Inventory Updates**: Stock levels and product performance

## Setup

### 1. MCP Configuration

Add the Square MCP server to your `.claude.json`:

```json
{
  "mcpServers": {
    "mcp_square_api": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.squareup.com/sse"]
    }
  }
}
```

### 2. Install Dependencies

```bash
npm install mcp-remote
```

### 3. Environment Variables

Set up Square API credentials in your `.env.local`:

```env
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_APPLICATION_ID=your_square_application_id
SQUARE_ENVIRONMENT=production  # or sandbox
SQUARE_LOCATION_ID=your_default_location_id
```

## API Endpoints

### Sync Endpoint
`POST /api/square/sync`

Synchronizes data from Square to local database.

**Body Parameters:**
- `syncType`: 'catalog' | 'orders' | 'payments' | 'full'
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)  
- `locationId`: Square location ID (optional)

**Example:**
```bash
curl -X POST /api/square/sync \\
  -H "Content-Type: application/json" \\
  -d '{"syncType": "orders", "startDate": "2024-01-01T00:00:00Z"}'
```

### Real-time Endpoint
`GET /api/square/realtime`

Fetches live data directly from Square.

**Query Parameters:**
- `type`: 'catalog' | 'orders' | 'payments' | 'sales-summary'
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)
- `locationId`: Square location ID (optional)

**Example:**
```bash
curl "/api/square/realtime?type=sales-summary&startDate=2024-01-01T00:00:00Z"
```

## React Hooks

### useSquareSalesSummary
Real-time sales analytics with automatic refresh.

```tsx
import { useSquareSalesSummary } from '@/hooks/useSquare';

function SalesOverview() {
  const { data, isLoading } = useSquareSalesSummary({
    startDate: new Date('2024-01-01'),
    endDate: new Date()
  });

  return (
    <div>
      <h2>Revenue: {data?.overview.totalRevenue}</h2>
      <p>Orders: {data?.overview.totalOrders}</p>
    </div>
  );
}
```

### useSquareSync
Trigger manual data synchronization.

```tsx
import { useSquareSync } from '@/hooks/useSquare';

function SyncButton() {
  const syncMutation = useSquareSync();

  const handleSync = () => {
    syncMutation.mutate({
      syncType: 'full',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    });
  };

  return (
    <button onClick={handleSync} disabled={syncMutation.isPending}>
      {syncMutation.isPending ? 'Syncing...' : 'Sync Square Data'}
    </button>
  );
}
```

### useSquareOrders
Monitor recent orders in real-time.

```tsx
import { useSquareOrders } from '@/hooks/useSquare';

function RecentOrders() {
  const { data } = useSquareOrders({
    startDate: new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
  });

  return (
    <div>
      {data?.orders.map(order => (
        <div key={order.id}>
          Order #{order.id}: ${order.totalAmount}
        </div>
      ))}
    </div>
  );
}
```

## Components

### SquareDashboard
Complete Square integration dashboard with real-time metrics.

```tsx
import { SquareDashboard } from '@/components/square/SquareDashboard';

function SquarePage() {
  return (
    <DashboardLayout>
      <SquareDashboard />
    </DashboardLayout>
  );
}
```

## Data Flow

1. **MCP Connection**: Service connects to Square MCP endpoint
2. **API Requests**: Fetch data using Square REST API via MCP
3. **Data Processing**: Transform Square data to match local schema
4. **Database Sync**: Store relevant data in PostgreSQL via Prisma
5. **Real-time Updates**: React Query manages cache and auto-refresh
6. **UI Updates**: Components automatically reflect latest data

## Data Models

### SquareItem
```typescript
interface SquareItem {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  };
  variations: Array<{
    id: string;
    name: string;
    priceMoney: {
      amount: number;
      currency: string;
    };
  }>;
  updatedAt: string;
  createdAt: string;
}
```

### SquareOrder
```typescript
interface SquareOrder {
  id: string;
  locationId: string;
  orderSource: { name: string };
  lineItems: Array<{
    catalogObjectId?: string;
    variationName?: string;
    name: string;
    quantity: string;
    totalMoney: { amount: number; currency: string };
  }>;
  totalMoney: { amount: number; currency: string };
  createdAt: string;
  updatedAt: string;
}
```

## Security Considerations

- **API Keys**: Store Square credentials securely in environment variables
- **Rate Limiting**: Implement appropriate request throttling
- **Data Privacy**: Ensure customer data compliance with privacy laws
- **Access Control**: Restrict Square API access to authorized users only

## Monitoring & Analytics

### Real-time Metrics
- Revenue tracking with automatic refresh (30s intervals)
- Order volume monitoring
- Payment success rates
- Top-selling items analysis
- Average order value calculations

### Historical Analysis  
- Sales trends over time
- Product performance comparison
- Customer behavior insights
- Revenue forecasting data

## Troubleshooting

### Common Issues

1. **MCP Connection Failed**
   - Verify MCP server configuration in `.claude.json`
   - Check network connectivity to Square MCP endpoint
   - Ensure `mcp-remote` package is installed

2. **API Authentication Error**
   - Verify Square access token in environment variables
   - Check token permissions and expiration
   - Ensure correct Square environment (sandbox/production)

3. **Data Sync Issues**
   - Review API rate limits and adjust sync frequency
   - Check for data format changes in Square API
   - Monitor error logs in sync operations

### Debug Mode
Enable debug logging by setting:
```env
DEBUG_SQUARE=true
```

## Future Enhancements

- **Inventory Management**: Two-way stock level synchronization
- **Customer Data**: Sync customer profiles and loyalty programs  
- **Webhooks**: Real-time event notifications from Square
- **Multi-location**: Support for multiple store locations
- **Advanced Analytics**: Machine learning insights and predictions

## Support

For issues related to Square integration:
1. Check the console logs for detailed error messages
2. Verify Square API status at status.squareup.com
3. Review MCP connection logs
4. Contact Square developer support if API issues persist