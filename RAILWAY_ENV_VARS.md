# Railway Environment Variables

Copy these variables to your Railway project settings (Settings → Variables):

## Required Variables (Railway will auto-create DATABASE_URL)

```
NODE_ENV=production
ACCESS_TOKEN=your-secure-random-token-here
OCR_PROVIDER=tesseract
ANTHROPIC_API_KEY=your-anthropic-api-key-here
GST_RATE=0.10
MAX_FILE_SIZE_MB=50
NEXTAUTH_SECRET=your-nextauth-secret-here
SQUARE_APPLICATION_ID=your-square-application-id
SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_ENVIRONMENT=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=invoices@wildoctave.com
```

## Variables to Generate:

1. **ACCESS_TOKEN**: Generate a secure random string
   ```bash
   openssl rand -base64 32
   ```

2. **NEXTAUTH_SECRET**: Generate another secure random string
   ```bash
   openssl rand -base64 32
   ```

3. **NEXTAUTH_URL**: This will be your Railway app URL (e.g., https://your-app.up.railway.app)
   - Set this AFTER your first deployment when you know the URL

## Optional Variables (if you use email notifications):
```
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-specific-password
```

## Variables Auto-Created by Railway:
- `DATABASE_URL` - PostgreSQL connection string (automatically set when you add the database)

---

## Quick Setup Steps:

1. Go to your Railway project dashboard
2. Click on your service → Settings → Variables
3. Click "New Variable" and add each variable above
4. Or click "RAW Editor" and paste all variables at once
