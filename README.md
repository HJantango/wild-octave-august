# Health Food Shop/Cafe Dashboard

A full-stack Next.js application for managing a health food shop and cafe with sales analytics, invoice processing, and inventory management.

## 🚀 Features

### Core Functionality
- **Sales Analytics Dashboard**: Upload and analyze Square POS "Item Sales Detail" CSV exports
- **Invoice Processing System**: OCR-powered PDF invoice processing with smart item recognition
- **Item Management**: Comprehensive inventory with price history tracking
- **Automated Pricing**: Category-based markup calculations with GST handling
- **Authentication**: Simple single-user access token system

### Technical Features
- **OCR Integration**: Pluggable OCR system (Tesseract.js + Azure Cognitive Services)
- **Smart Data Processing**: Automatic pack size detection and price calculations
- **Real-time Updates**: Price change indicators and history tracking
- **Export Capabilities**: CSV export for items and invoices
- **Railway Ready**: Optimized for Railway deployment with PostgreSQL

## 🛠 Tech Stack

### Frontend
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **React Query** (TanStack Query) for data fetching/caching
- **Recharts** for data visualization
- **React Hook Form** + **Zod** for forms and validation

### Backend
- **Next.js API Routes** (server actions & route handlers)
- **Prisma ORM** with PostgreSQL
- **TypeScript** throughout
- **Zod** for validation

### OCR & File Processing
- **Tesseract.js** (default OCR provider)
- **Azure Cognitive Services** (configurable alternative)
- **PDF processing** with sharp and pdf2pic
- **File upload** handling with validation

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database (local or Railway)

### Step-by-Step Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd wild
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env` and configure your environment variables:
   ```bash
   cp .env .env.local
   ```
   
   Required variables:
   ```env
   # Database (Railway will provide this in production)
   DATABASE_URL="your-postgresql-connection-string"
   
   # Authentication
   ACCESS_TOKEN="your-secure-access-token-here"
   
   # OCR Provider (tesseract or azure)
   OCR_PROVIDER="tesseract"
   
   # Optional: Azure OCR (only if OCR_PROVIDER=azure)
   AZURE_OCR_ENDPOINT="your-azure-endpoint"
   AZURE_OCR_KEY="your-azure-key"
   
   # GST Configuration
   GST_RATE="0.10"
   ```

3. **Database Setup**:
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations (for production database)
   npx prisma migrate deploy
   
   # OR push schema (for development)
   npx prisma db push
   
   # Seed with default data
   npm run db:seed
   ```

4. **Development Server**:
   ```bash
   npm run dev
   ```
   
   Visit [http://localhost:3000](http://localhost:3000)

## 🚢 Deployment

### Railway Deployment

1. **Create Railway Project**:
   - Connect your GitHub repository to Railway
   - Add PostgreSQL service
   - Railway will provide `DATABASE_URL` automatically

2. **Environment Variables**:
   Set these in Railway dashboard:
   ```env
   NODE_ENV=production
   ACCESS_TOKEN=your-production-access-token
   OCR_PROVIDER=tesseract
   GST_RATE=0.10
   ```

3. **Deploy**:
   - Railway will automatically detect the Dockerfile
   - Run database migrations: `npx prisma migrate deploy`
   - Seed the database: `npm run db:seed`

### Docker Deployment

```bash
# Build image
docker build -t health-food-dashboard .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your-database-url" \
  -e ACCESS_TOKEN="your-access-token" \
  health-food-dashboard
```

## 📊 Usage Guide

### Initial Setup

1. **Login**: Use your `ACCESS_TOKEN` to authenticate
2. **Configure Settings**: Set category markups in `/settings`
3. **Add Vendors**: Create vendor records for invoice processing

### Sales Analytics

1. **Export Data**: Download "Item Sales Detail" CSV from Square POS
2. **Upload CSV**: Use the sales analytics page to upload reports
3. **View Analytics**: Interactive charts with filters for date, category, and items

### Invoice Processing

1. **Upload PDF**: Drag and drop invoice PDFs
2. **OCR Processing**: System extracts vendor, items, quantities, and prices
3. **Review & Edit**: Manually verify and correct extracted data
4. **Approve**: Finalize invoice to update item costs and pricing

### Item Management

1. **Browse Items**: Filter by category, vendor, or search terms
2. **Price History**: View cost changes and price evolution
3. **Bulk Updates**: Export to CSV, edit, and re-import

## 🏗 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── login/             # Authentication pages
│   └── (dashboard)/       # Protected dashboard pages
├── components/            # React components
│   ├── layout/           # Layout components
│   └── ui/               # UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── auth.ts           # Authentication utilities
│   ├── pricing.ts        # Pricing calculations
│   ├── validations.ts    # Zod schemas
│   ├── api-utils.ts      # API helpers
│   └── ocr/              # OCR service & adapters
└── middleware.ts         # Next.js middleware

prisma/
├── schema.prisma         # Database schema
├── migrations/           # Database migrations
└── seed.ts              # Database seeding
```

## 📋 API Reference

### Authentication
- `POST /api/auth/login` - Authenticate with access token
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/me` - Get current user status

### Items Management
- `GET /api/items` - List items with pagination/filtering
- `POST /api/items` - Create new item
- `GET /api/items/[id]` - Get item details with history
- `PATCH /api/items/[id]` - Update item
- `DELETE /api/items/[id]` - Delete item

### Invoice Processing  
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Upload invoice PDF
- `GET /api/invoices/[id]` - Get invoice details
- `PATCH /api/invoices/[id]` - Update invoice
- `POST /api/invoices/[id]/commit` - Finalize invoice

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update setting
- `PATCH /api/settings` - Bulk update settings

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format with Prettier
npm run type-check      # TypeScript type checking

# Database
npm run db:push         # Push schema to database
npm run db:migrate      # Run migrations
npm run db:generate     # Generate Prisma client
npm run db:seed         # Seed database
```

### Category Markups (Default)

| Category | Markup | Description |
|----------|--------|-------------|
| House | 1.65 | Store brand products |
| Bulk | 1.75 | Bulk items |
| Fruit & Veg | 1.75 | Fresh produce |
| Fridge & Freezer | 1.5 | Refrigerated items |
| Naturo | 1.65 | Natural products |
| Groceries | 1.65 | Dry goods |
| Drinks Fridge | 1.65 | Beverages |
| Supplements | 1.65 | Health supplements |
| Personal Care | 1.65 | Toiletries |
| Fresh Bread | 1.5 | Bakery items |

### Pack Size Detection

The system automatically detects pack sizes using patterns like:
- `/12`, `x12`, `pack of 12`, `doz`, `dozen`
- `/6`, `x6`, `pack of 6`
- `/24`, `x24`, `pack of 24`
- Custom patterns configurable in settings

## 🐛 Troubleshooting

### Common Issues

**OCR Not Working**: 
- Ensure Tesseract is installed (handled in Docker)
- For Azure OCR, verify endpoint and key configuration

**Database Connection Issues**:
- Verify `DATABASE_URL` is correctly set
- Run `npx prisma migrate deploy` for production

**Authentication Problems**:
- Check `ACCESS_TOKEN` environment variable
- Clear browser cookies and try again

**File Upload Failures**:
- Ensure uploaded files are valid PDFs
- Check file size limits (50MB default)

### Logs and Debugging

- Server logs show OCR processing status
- Client-side errors appear in browser console
- Database queries logged with Prisma debug mode

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the API documentation

---

Built with ❤️ for small business success
