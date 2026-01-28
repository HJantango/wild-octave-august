#!/bin/sh
# Run schema sync before starting the server
echo "🔄 Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "⚠️ Schema sync failed (non-fatal, continuing...)"
echo "🚀 Starting server..."
exec node server.js
