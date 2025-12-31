# Square API Setup for Wild Octave Organics

To connect your dashboard to real Square data (instead of mock data), you need to set up Square API credentials.

## 🔑 Getting Your Square API Credentials

### Step 1: Access Square Developer Dashboard
1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Log in with your Square account (same account as Wild Octave Organics)

### Step 2: Create or Access Your Application
1. If you don't have an app, click **"Create App"**tex
2. Choose **"Build with APIs and SDKs"**
3. Name it something like "Wild Octave Dashboard"
4. Select your business location

### Step 3: Get Your Credentials
1. In your app dashboard, go to the **"Credentials"** tab
2. You'll see two environments:
   - **Sandbox** (for testing with fake data)
   - **Production** (for real business data)

**For Real Data (Production):**
- Copy your **Application ID**
- Copy your **Production Access Token**

**For Testing (Sandbox):**
- Copy your **Application ID**  
- Copy your **Sandbox Access Token**

### Step 4: Update Your .env File
Edit `/Users/heathjansse/Desktop/wild/.env`:

```bash
# Square API Configuration
SQUARE_APPLICATION_ID="your_actual_application_id_here"
SQUARE_ACCESS_TOKEN="your_actual_access_token_here"
SQUARE_ENVIRONMENT="production"  # Use "production" for real data, "sandbox" for testing
```

**Important Notes:**
- Use **"production"** environment and **Production Access Token** to see your real $366,726.78 data
- Use **"sandbox"** environment for testing with fake data
- Keep your access token secret and never commit it to git

### Step 5: Restart the Development Server
After updating the .env file:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🔍 Testing the Connection

Once you've updated your credentials:

1. **Visit the dashboard** at http://localhost:3000
2. **Check the connection status** - you should see "Square Connected" in green
3. **View real data** - your actual sales data should now appear instead of the mock $36.54

## 📊 Expected Results

With real credentials, you should see:
- ✅ **Real revenue data** ($366,726.78 total instead of mock $36.54)
- ✅ **Actual Wild Octave Organics products** (not just mock smoothies)
- ✅ **Historical sales data** from 2025
- ✅ **Real customer orders** and transactions
- ✅ **Accurate analytics** and insights

## 🚨 Troubleshooting

**If you see "Square API connection failed":**
1. Double-check your Application ID and Access Token
2. Ensure you're using the right environment (production vs sandbox)
3. Verify your Square account has the necessary permissions
4. Check the browser console and server logs for detailed error messages

**If you still see mock data ($36.54):**
1. Make sure you restarted the development server after updating .env
2. Check that SQUARE_ENVIRONMENT is set to "production"
3. Verify your access token is the Production token (not Sandbox)

**Common Issues:**
- Using Sandbox token with production environment (or vice versa)
- Typos in the .env file
- Not restarting the server after changes
- Missing permissions for the access token

## 🔐 Security Notes

- Never commit your real access token to version control
- Use environment variables for all sensitive data
- Consider using different tokens for development vs production deployments
- Regularly rotate your access tokens for security

---

Once you've completed these steps, your dashboard will show real Wild Octave Organics data instead of the mock smoothie orders!