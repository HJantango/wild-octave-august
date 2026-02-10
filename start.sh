#!/bin/sh
# Run schema sync before starting the server
echo "🔄 Syncing database schema..."
# Use node to run prisma directly (npx not available in production)
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "⚠️ Schema sync failed (non-fatal, continuing...)"
echo "🚀 Starting server..."
exec node server.js
