# Deploy Wild Octave Organics to Railway

## Prerequisites
- [x] Railway CLI installed
- [ ] Railway account created
- [ ] Git repository initialized

---

## Step-by-Step Deployment

### 1. Login to Railway
```bash
railway login
```
This will open your browser. Sign up or login to Railway.

### 2. Initialize Railway Project
Choose one of these methods:

**Method A: Via Web Dashboard (Recommended)**
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo" or "Empty Project"
3. Connect your GitHub account if using GitHub
4. Or create an empty project to deploy via CLI

**Method B: Via CLI**
```bash
cd /Users/heathjansse/Desktop/wild
railway init
```
Follow the prompts to create a new project.

### 3. Add PostgreSQL Database
In your Railway project dashboard:
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically provision the database
3. The `DATABASE_URL` environment variable is automatically created

### 4. Link Your Local Project (if using CLI method)
```bash
railway link
```
Select your project from the list.

### 5. Set Environment Variables

Go to your Railway project dashboard → Service → Settings → Variables

Click "RAW Editor" and paste these variables:

```
NODE_ENV=production
ACCESS_TOKEN=generate-with-openssl-rand-base64-32
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
OCR_PROVIDER=tesseract
ANTHROPIC_API_KEY=your-anthropic-api-key-here
GST_RATE=0.10
MAX_FILE_SIZE_MB=50
SQUARE_APPLICATION_ID=your-square-application-id
SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_ENVIRONMENT=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=invoices@wildoctave.com
```

**IMPORTANT:** Copy your actual API keys from your local `.env` file when setting up Railway.

**Note:** The `DATABASE_URL` is automatically set by Railway when you add PostgreSQL.

**Optional Email Variables (if you need email notifications):**
```
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-specific-password
```

### 6. Deploy Your Application

**Method A: Deploy via GitHub (Recommended for continuous deployment)**
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```
2. In Railway dashboard: Settings → Connect GitHub repository
3. Railway will automatically deploy on every push

**Method B: Deploy via CLI**
```bash
railway up
```
This will build and deploy your application using the Dockerfile.

### 7. Run Database Migrations
After the first deployment, run migrations:

```bash
railway run npx prisma migrate deploy
```

Or via Railway dashboard:
1. Go to your service
2. Click "Deploy Logs" or "Settings"
3. Add a build command: `npx prisma generate && npx prisma migrate deploy`

### 8. Set NEXTAUTH_URL (After First Deployment)
1. Once deployed, Railway will give you a URL like: `https://wild-octave-production-xxxx.up.railway.app`
2. Go back to Variables and add:
   ```
   NEXTAUTH_URL=https://your-actual-railway-url.up.railway.app
   ```
3. Replace with your actual Railway URL

### 9. Verify Deployment
1. Open your Railway app URL
2. You should see the login page
3. Login with your ACCESS_TOKEN

---

## Useful Railway CLI Commands

```bash
# View logs
railway logs

# Open project in browser
railway open

# Run commands in Railway environment
railway run <command>

# Connect to database
railway connect postgres

# Check deployment status
railway status
```

---

## Troubleshooting

### Build Fails
- Check the build logs in Railway dashboard
- Ensure all dependencies are in package.json
- Verify Dockerfile syntax

### Database Connection Issues
- Verify DATABASE_URL is set (should be automatic)
- Run migrations: `railway run npx prisma migrate deploy`
- Check Prisma schema matches your database

### Environment Variables
- Double-check all required variables are set
- Ensure no trailing spaces or quotes
- NEXTAUTH_URL must match your Railway domain

### File Uploads
Railway has ephemeral filesystem. For production, consider:
- Using Railway Volumes for persistent storage
- Or external storage like AWS S3 or Cloudinary

---

## Post-Deployment Setup

1. **Seed Database** (optional):
   ```bash
   railway run npm run db:seed
   ```

2. **Configure Custom Domain** (optional):
   - In Railway dashboard: Settings → Domains
   - Add your custom domain and update DNS records

3. **Set up monitoring**:
   - Railway provides built-in metrics
   - View in: Project → Metrics tab

4. **Enable auto-deployments**:
   - Connect GitHub repository for automatic deployments on push

---

## Cost Considerations

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month base + usage
- **PostgreSQL**: ~$5/month for 8GB storage
- **Bandwidth**: First 100GB free

Total estimated cost: ~$10-15/month for small usage

---

## Important Notes

- Railway uses the Dockerfile for deployment automatically
- The app includes Tesseract OCR and ImageMagick for invoice processing
- First build may take 5-10 minutes due to image processing dependencies
- DATABASE_URL is automatically injected by Railway
- Logs are available in the Railway dashboard

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your deployment uses Docker, so check Dockerfile if you need to customize
