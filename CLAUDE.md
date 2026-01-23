# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Database Operations
- `npx prisma generate` - Generate Prisma client after schema changes
- `npm run db:push` - Push schema changes to database (development)
- `npm run db:migrate` - Create and run new migration (development)
- `npm run db:migrate:deploy` - Deploy migrations (production)
- `npm run db:seed` - Seed database with default data

### Code Quality
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without making changes

## Architecture Overview

### Application Structure
This is a Next.js 14 App Router application for managing a health food shop/cafe with six core systems:

1. **Sales Analytics & Ordering** - Upload and analyze Square POS CSV exports, generate smart order suggestions with 6-week analysis
2. **Invoice Processing** - Multi-modal OCR/LLM-powered PDF invoice processing with automated item recognition
3. **Item Management** - Comprehensive inventory tracking with automated pricing calculations, price history, and SKU support
4. **Ordering Calendar System** - Vendor order schedules with automatic order generation based on frequency (weekly, bi-weekly, fortnightly, monthly)
5. **Cafe Ordering Schedule** - Weekly visual calendar for cafe-specific vendor orders with regular, fortnightly, and on-demand ordering
6. **Roster Management** - Staff scheduling system with public holidays, wage calculations, and SMS notifications with roster images

### Key Technical Components

**Invoice Processing Pipeline:**
1. PDF upload → Multi-page PDF-to-image conversion → LLM vision parsing (Anthropic Claude Haiku)
2. OCR fallback with Tesseract.js or Azure Cognitive Services
3. Smart unit cost corrections and GST detection with vendor-specific rules
4. Pack size detection and quantity calculations with correction algorithms
5. Automated pricing with category-based markups and validation
6. Receiving workflow with item checking and missing item reporting

**Database Schema (PostgreSQL with Prisma):**
- `vendors` - Supplier information with contact details and order settings
- `items` - Product catalog with SKU, price history, and inventory tracking
- `inventory_items` - Current stock levels with min/max thresholds and reorder points
- `invoices` - Invoice processing and receiving workflow with rectification support
- `invoice_line_items` - Individual products with pricing calculations
- `sales_reports` - Square POS data imports with aggregation
- `purchase_orders` - Order suggestions and purchase order management
- `vendor_order_schedules` - Recurring order schedules (weekly, bi-weekly, fortnightly, monthly, bi-monthly)
- `scheduled_orders` - Auto-generated orders based on schedules with public holiday filtering
- `public_holidays` - NSW public holidays for order scheduling
- `roster_*` - Staff scheduling with public holidays and wage calculations
- `settings` - Configuration and category markups

**Authentication & Security:**
- Single-user system with ACCESS_TOKEN environment variable
- Next.js middleware protects all routes except `/login` and `/api/auth/login`
- Token-based session management with cookie storage

### Critical Files & Logic

**Invoice Processing:**
- `src/lib/fresh-llm-invoice-parser.ts` - Anthropic Claude vision model for multi-page invoice parsing
- `src/lib/ocr/` - OCR service abstraction with Tesseract and Azure adapters
- `src/app/api/invoices/[id]/process/route.ts` - Main processing orchestration with fallback logic
- `src/lib/pricing.ts` - Decimal.js-based pricing calculations with vendor-specific corrections
- `src/lib/invoice-parser.ts` - Legacy OCR-based text parsing with pattern matching

**Ordering System:**
- `src/app/orders/page.tsx` - 6-week sales analysis with editable stock and order suggestions
- `src/app/orders/extended/page.tsx` - Extended 26-week (6-month) sales analysis with long-term order frequencies
- `src/app/api/orders/analyze-sales/route.ts` - Sales CSV parsing with SKU/name matching and order calculations
- `src/app/api/items/import-mpl/route.ts` - Square MPL import that creates/updates items with SKU, costs, and shelf labels
- `src/app/ordering/purchase-orders/[id]/page.tsx` - Purchase order detail view with edit mode for drafts and export capabilities
- `src/app/api/purchase-orders/[id]/route.ts` - Purchase order CRUD with line item updates and total recalculation
- `src/app/api/purchase-orders/route.ts` - List and create purchase orders with vendor and line item data
- `src/app/ordering/vendor-schedules/page.tsx` - Vendor order schedule management
- `src/app/ordering/calendar/page.tsx` - Calendar view for scheduled orders
- `src/app/ordering/cafe-schedule/page.tsx` - Cafe-specific weekly ordering schedule with regular, fortnightly, and on-demand items
- `src/app/ordering/christmas-closures/page.tsx` - Christmas/New Year supplier closure tracking with completion checkboxes
- `src/app/orders/missing-products/page.tsx` - Sales summary analysis for products across all vendors with print optimization
- `src/app/api/vendor-schedules/route.ts` - CRUD operations for vendor schedules
- `src/app/api/scheduled-orders/generate/route.ts` - Auto-generates orders based on schedules with holiday filtering
- `src/app/api/inventory/[id]/stock/route.ts` - Update inventory stock levels

**API Architecture:**
- Route handlers in `src/app/api/` following RESTful conventions
- `src/lib/api-utils.ts` - Common response formatting and validation utilities
- `src/lib/validations.ts` - Zod schemas for request/response validation
- Middleware at `src/middleware.ts` for authentication and route protection

**Frontend Patterns:**
- React Query (TanStack Query) for data fetching, caching, and optimistic updates
- Custom hooks in `src/hooks/` for business logic and state management
- Tailwind CSS with Radix UI components in `src/components/ui/`
- React Hook Form + Zod for type-safe form handling

**Data Models & Relationships:**
- `prisma/schema.prisma` - Complete database schema with complex relationships
- Price history tracking across items with automated change detection
- Vendor-specific settings for order management and processing rules
- Audit trails for invoice processing, rectification, and receiving workflow

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `ACCESS_TOKEN` - Authentication token
- `OCR_PROVIDER` - "tesseract" or "azure"

**Critical for Production:**
- `ANTHROPIC_API_KEY` - For LLM invoice parsing (strongly recommended)
- `NODE_ENV` - Set to "production" for production deployment

**Optional:**
- `AZURE_OCR_ENDPOINT` and `AZURE_OCR_KEY` - If using Azure OCR instead of Tesseract
- `GST_RATE` - Default 0.10 (10% GST)
- `SQUARE_APPLICATION_ID`, `SQUARE_ACCESS_TOKEN` - For Square POS integration
- `SMTP_*` - Email configuration for vendor notifications
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - For SMS roster notifications (see TWILIO_SETUP.md)

### Invoice Processing Business Logic

**Vendor-Specific Rules:**
- Beach & Bush: GST detection based on Ex GST = Inc GST price equality
- Horizon Foods: Aggressive quantity corrections for pack size errors
- Different vendors have different invoice formats requiring specialized parsing

**Unit Cost Corrections:**
- Conservative approach: only corrects obvious mathematical errors
- Pack quantity detection (e.g., "6 x 4" = 24 individual units)
- GST auto-correction based on price relationships

**Receiving Workflow:**
- Staff can check items as received/checked-in
- Missing items reporting with automated vendor emails
- PDF watermarking system for accounting workflow

### Key Business Rules

**Category Markups (configurable in settings):**
- House: 1.65x, Bulk: 1.75x, Groceries: 1.65x, etc.
- Automatic pricing calculation: unit cost → markup → sell price (ex/inc GST)

**Pack Size Detection:**
- Patterns like "x12", "/6", "pack of 24", "dozen"
- Smart quantity calculations for bulk orders

**Sales Data Integration:**
- Square POS "Item Sales Detail" CSV imports
- Automated item matching and price history tracking
- Revenue and margin analysis with date filtering

**Ordering System:**
- **6-Week Sales Analysis** (`/orders`) - Upload 6 weeks of Square sales CSVs for smart order suggestions
- **Extended 6-Month Analysis** (`/orders/extended`) - Upload up to 26 weeks of sales data for long-term trends with additional order frequencies (8 weeks, 12 weeks/quarterly, 26 weeks/6 months)
- **Item Matching** - Primary: SKU-based matching between sales CSV and MPL database, fallback to exact name matching
- **Smart Suggestions** - Formula: `(avg weekly sales × order frequency) - current stock`
- **Editable Stock Levels** - Update "On Hand" quantities directly in order screen, auto-recalculates suggestions
- **Pack Size Support** - Configure pack sizes (6, 12, 24) per item with automatic quantity rounding
- **Margin Analysis** - Shows dollar margin values for each item based on cost/sell prices
- **Print-Ready Orders** - Grouped by shelf location for efficient picking
- **MPL Integration** - Master Product List imports create/update items with costs, prices, SKUs, and shelf labels
- **Order Frequency Options** - Semi-weekly (0.5), Weekly, Bi-weekly, Monthly, 6 Weeks, 8 Weeks, 12 Weeks (Quarterly), 26 Weeks (6 Months)
- **Order Field Behavior** - Order quantity fields remain empty (not prepopulated) when changing frequency - users manually enter order quantities
- **Compact UI** - Minimized column widths, checkmark indicators for shelf/SKU presence, abbreviated headers to fit all data without horizontal scrolling
- **Empty Order Removal** - One-click button to remove all line items without order quantities
- **Separate Save/Load** - Each analysis page (6-week and extended) has independent localStorage for saved analyses

**Purchase Order Management:**
- **Draft Editing** (`/ordering/purchase-orders/[id]`) - Full edit capability for DRAFT status purchase orders
- **Edit Mode** - Add, remove, or modify line items before approval with real-time total calculations
- **Line Item Edits** - Edit name, quantity, unit cost, and notes for each item
- **Auto-Recalculation** - Subtotal, GST (10%), and total amounts update automatically when line items change
- **Delete Functionality** - Delete DRAFT purchase orders from both list page and detail page with confirmation dialogs
- **PDF Export** - Generate purchase orders with or without prices for vendor communication
- **Square Export** - Export purchase orders as CSV in Square's import format for direct upload to Square POS
- **Square Format** - Simple CSV with headers: Item name, Variation name, SKU, GTIN, Vendor code, Notes, Quantity, Unit cost
- **Status Workflow** - DRAFT → APPROVED → SENT → RECEIVED with edit restrictions (only DRAFT orders can be edited)
- **Location Configuration** - Purchase orders export with "Wild Octave Organics" as delivery location for Square imports

**Calendar System:**
- **Vendor Schedules** (`/ordering/vendor-schedules`) - Set recurring order days and frequencies per vendor
- **Frequencies** - Weekly, bi-weekly, fortnightly, monthly, bi-monthly with week offset support
- **Auto-Generation** - Automatically creates scheduled orders based on vendor schedules
- **Public Holiday Filtering** - Skips NSW public holidays when generating orders
- **Lead Time Tracking** - Configure days between order placement and expected delivery
- **Calendar View** (`/ordering/calendar`) - Visual calendar showing all upcoming orders by vendor

**Cafe Ordering Schedule:**
- **Weekly Calendar View** (`/ordering/cafe-schedule`) - Visual 7-day calendar showing all scheduled cafe vendor orders
- **Three Order Types**:
  - **Regular Weekly Schedule** - Vendors with specific days (e.g., Byron Bay Pies on Mon/Wed, Liz Jackson on Tue, Yummify on Sun)
  - **Fortnightly Orders** - Items ordered every two weeks (Byron Bay Brownies, Gigis, Zenfelds Coffee)
  - **On-Demand/Incidentals** - Items ordered as needed with specific triggers (e.g., "when down to 2", "when down to last bucket")
- **Compact Layout** - Designed to fit on a single printed page with optimized spacing and minimal margins
- **Print Optimization** - Special print CSS with smaller fonts (9pt tables), reduced gaps, and page-break prevention
- **Visual Design** - Color-coded sections with gradients (purple/pink for weekly, purple/indigo for fortnightly, orange/red for incidentals)
- **Editable Functionality** - Add, edit, or remove items from any schedule section with inline editing
- **Contact Methods** - Track how to order from each vendor (call, email, text, "she calls", "notify Jackie")
- **Triggers for Incidentals** - Specific stock levels or conditions that trigger ordering (e.g., "when down to 2", "when needed")
- **LocalStorage Persistence** - Schedule data saved locally to browser with save/load functionality
- **Pre-populated Data** - Includes initial setup with common cafe vendors:
  - Byron Bay Gourmet Pies (Mon/Wed)
  - Liz Jackson gluten-free cakes (Tue)
  - Yummify/Arianne (Sun)
  - Marlena samosas, Milks for café, Blue Bay Gourmet, All Good Foods Acaii, David Dahl, David Mango Chutney (all on-demand)

**Christmas/New Year Closures:**
- **Closure Tracking** (`/ordering/christmas-closures`) - Track supplier closures during Christmas/New Year period
- **Checkbox System** - Mark vendors as completed when final Christmas order is placed
- **Auto-Sorting** - Incomplete orders shown first, completed orders greyed out and pushed to bottom
- **Auto-Save** - Changes to completion status automatically saved to localStorage
- **Print-Optimized** - Checkboxes display properly in print view with custom print styles
- **Editable Dates** - Add, edit, or remove suppliers with last order dates, closure dates, opening dates, and special delivery dates
- **Visual Indicators** - Completed orders have grey background with reduced opacity
- **Data Persistence** - All closure data stored in browser localStorage

**Sales Summary Analysis:**
- **Cross-Vendor Analysis** (`/orders/missing-products`) - Analyze sales for ALL products regardless of vendor assignment
- **Square Integration** - Upload Square "Item Sales Summary" CSV exports
- **Database Matching** - Shows which products are in database (✓ green) vs not found (✗ red)
- **Order Recommendations** - Calculates 2-week order quantities based on weekly averages
- **Print Optimization** - Highly compressed print layout (7pt font, minimal padding) fits large datasets on 1-2 pages
- **Date Range Calculation** - Automatically calculates weeks from Square POS installation (May 8, 2025) to current date
- **Export Options** - Print-friendly view and CSV export functionality
- **Use Case** - Identify products that may need reordering even if assigned to different vendors

### Testing & Deployment

**Database:**
- Always run `npx prisma generate` after schema changes
- Use `npm run db:push` for development, migrations for production
- Seed data includes default category markups and settings

**Invoice Processing:**
- Test with sample PDFs in `src/app/sample-invoices/`
- Monitor processing logs for unit cost corrections and GST detection
- LLM responses are limited to 8192 tokens for Claude Haiku model
- System automatically falls back to OCR when LLM processing fails
- Processing continues with partial extractions - validation warnings don't block completion

**Production Deployment:**
- Railway or Docker deployment (Dockerfile included)
- Requires PostgreSQL database and file upload handling
- PDF processing requires system dependencies (handled in Docker)

## Important Implementation Notes

### Invoice Processing Architecture
The system uses a multi-layered approach for invoice processing:
1. **Primary**: LLM vision parsing with claude-3-5-haiku-20241022 for structured data extraction
2. **Fallback**: OCR text extraction with pattern matching when LLM fails
3. **Validation**: Smart validation that allows partial extractions to continue processing

### LLM Processing Enhancements
- Enhanced prompts specifically designed to prevent sample/demonstration responses
- Token limit management (8192 max for Haiku model)
- Validation logic that warns but doesn't block on mismatches
- Multi-page PDF support with page-by-page processing

### Vendor-Specific Processing Rules
Each vendor has customized processing logic in `src/app/api/invoices/[id]/process/route.ts`:
- **Horizon Foods**: Aggressive quantity corrections for pack size errors and GST detection
- **Beach & Bush**: GST detection based on price equality patterns
- **Little Valley**: Custom parsing for their invoice format
- Processing continues with extracted data even when counts don't match expectations

### Error Handling & Resilience
- System designed to never completely fail invoice processing
- Falls back through: LLM → OCR → Manual entry
- Comprehensive logging for debugging processing issues
- Validation warnings don't prevent invoice completion

### Ordering System Architecture

**Item Matching Strategy:**
The system uses a two-tier matching approach between Square sales CSV and MPL database:
1. **Primary**: SKU-based matching (faster, more reliable when available)
2. **Fallback**: Exact name matching (case-insensitive) when SKU is not present

**MPL Import Workflow:**
- `src/app/api/items/import-mpl/route.ts` now **creates** new items instead of just updating existing ones
- Extracts shelf location from Categories field: "Shelf Labels > Label Crackers" → "Crackers"
- Reads from "Default Vendor Code" field (not "SKU") - stores in database `sku` field for vendor code matching
- Updates inventory stock levels automatically
- Formula: cost → markup → sell price (ex/inc GST with 10% GST)

**Sales Analysis Flow:**
1. Upload 6 weeks of Square "Item Sales Detail" CSVs
2. System extracts: Item Name, SKU, Category, Vendor Name, Units Sold, Gross Sales
3. Aggregates sales across weeks to calculate average weekly sales
4. Matches items to database using SKU first, then name
5. Enriches with: cost price, sell price, margin %, shelf label, current stock
6. Calculates suggested order: `Math.max(0, Math.ceil(avgWeekly × orderFrequency) - currentStock)`

**Editable Stock Updates:**
- Stock input fields in `/orders` page update inventory in real-time
- On change: Updates local state immediately for responsive UI
- Background: Finds item by name → updates inventory via `/api/inventory/[id]/stock`
- Auto-recalculates suggested order quantities based on new stock level

**Calendar System Logic:**
- Vendor schedules define: order day, delivery day, frequency, week offset, lead time
- Auto-generation checks frequency and week offset to determine if order should be created
- Bi-weekly/fortnightly: `(weekCount % 2) === weekOffset`
- Monthly: `weekCount === 0 || (weekCount % 4) === weekOffset`
- Bi-monthly: `weekCount === 0 || (weekCount % 8) === weekOffset`
- Public holiday filtering prevents orders on NSW public holidays

**Print View Grouping:**
- Orders grouped by subcategory (shelf label) for efficient warehouse picking
- Uses actual subcategories from matched database items
- Dynamically extracts unique shelf labels from current order items