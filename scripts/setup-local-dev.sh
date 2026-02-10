#!/bin/bash
# =============================================
# Local Development Setup Script
# =============================================

set -e

echo "🦝 Wild Octave - Local Dev Setup"
echo "================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"

# Start the local database
echo ""
echo "📦 Starting local PostgreSQL database..."
docker compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 3

# Check if database is accepting connections
until docker exec wild-octave-local-db pg_isready -U localdev -d wildoctave_dev > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "✅ Database is ready"

# Run migrations
echo ""
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed with test data
echo ""
echo "🌱 Seeding database with test data..."
npx prisma db seed || echo "⚠️  No seed script configured (that's okay)"

echo ""
echo "================================="
echo "✅ Local development environment ready!"
echo ""
echo "To start developing:"
echo "  npm run dev"
echo ""
echo "To view database:"
echo "  npx prisma studio"
echo ""
echo "To stop database:"
echo "  docker compose down"
echo ""
echo "To reset database (delete all data):"
echo "  docker compose down -v"
echo "  ./scripts/setup-local-dev.sh"
echo "================================="
