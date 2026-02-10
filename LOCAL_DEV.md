# Local Development Guide

## Quick Start

```bash
# 1. Start local database (requires Docker)
docker compose up -d

# 2. Run migrations & seed data
./scripts/setup-local-dev.sh

# 3. Start dev server
npm run dev
```

Open http://localhost:3000

## Test Credentials

- **Email:** test@test.local
- **Password:** testpassword123

## Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start local PostgreSQL |
| `docker compose down` | Stop database (keeps data) |
| `docker compose down -v` | Stop & delete all data |
| `npm run dev` | Start Next.js dev server |
| `npx prisma studio` | Open database viewer |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma db seed` | Re-seed test data |

## How It Works

### Safeguards Against Breaking Production

1. **Separate URLs** — Local uses `localhost:5433`, prod uses Railway's proxy
2. **Auto-detection** — Code will CRASH if you accidentally point dev at prod DB
3. **`.env.local` is gitignored** — Your local config never gets pushed

### Database URLs

| Environment | DATABASE_URL |
|-------------|--------------|
| Local Dev | `postgresql://localdev:localdev123@localhost:5433/wildoctave_dev` |
| Production | `postgresql://...@metro.proxy.rlwy.net:11178/railway` (Railway) |

## Workflow

```
1. Make code changes
2. Test locally (npm run dev)
3. Verify it works
4. Commit & push
5. Railway auto-deploys to production
```

## Troubleshooting

### "Cannot connect to database"
```bash
# Check if Docker is running
docker ps

# Restart the database
docker compose down && docker compose up -d
```

### "Production database connection blocked"
This means your `.env.local` is pointing at Railway. Fix it:
```bash
# Edit .env.local and ensure DATABASE_URL is:
DATABASE_URL="postgresql://localdev:localdev123@localhost:5433/wildoctave_dev"
```

### Reset everything
```bash
docker compose down -v
./scripts/setup-local-dev.sh
```
