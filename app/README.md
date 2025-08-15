
# Wild Octave Organics Invoice Processing System

A comprehensive Next.js 14 application for processing health food invoices with Square API integration, automated inventory management, and intelligent product linking.

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Access Application**
   - Main App: http://localhost:3000
   - Square Admin: http://localhost:3000/square

## 📋 Features

- **Invoice Processing**: Upload and process PDF invoices with OCR
- **Square Integration**: Real-time inventory sync and product management
- **Product Linking**: Intelligent matching of invoice items to Square products
- **Automated Sync**: Daily inventory synchronization at 5am AEST
- **Webhook Support**: Real-time updates from Square
- **Admin Dashboard**: Complete Square integration management
- **Category Management**: Automated product categorization with markup
- **Stock Management**: Track received stock and inventory levels

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, Radix UI, Shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **API Integration**: Square API v2
- **Authentication**: NextAuth.js
- **File Processing**: React Dropzone
- **Charts**: Plotly.js, Chart.js

## 📁 Project Structure

```
app/
├── api/                    # API routes
│   ├── square/            # Square API endpoints
│   ├── invoices/          # Invoice processing
│   └── categories/        # Category management
├── app/                   # Next.js app directory
├── components/            # React components
├── lib/                   # Utility libraries
├── prisma/               # Database schema
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

## 🔧 Configuration

See `docs/PROJECT_DOCUMENTATION.md` for detailed setup instructions.

## 📖 Documentation

- [Complete Project Documentation](docs/PROJECT_DOCUMENTATION.md)
- [Environment Configuration](docs/ENV_TEMPLATE.example)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)

## 🤝 Support

For issues or questions, refer to the troubleshooting section in the project documentation.

---

**Version**: 1.0.0  
**Last Updated**: August 4, 2025
