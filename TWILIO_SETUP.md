# Twilio SMS Setup for Roster Notifications

This document explains how to set up Twilio to send roster SMS notifications with images to staff.

## Features

When a roster is published, the system will automatically:
- Generate a PNG image of the roster
- Send the roster image via SMS to all staff members who:
  - Have shifts on that roster
  - Have a valid phone number in their profile
- Track SMS sending results (success/failure)

You can also manually resend SMS using the "📱 Send SMS" button on published rosters.

## Setup Instructions

### 1. Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free trial account
3. Complete phone verification

### 2. Get Your Twilio Credentials

1. After signing in, go to your [Twilio Console Dashboard](https://console.twilio.com/)
2. Copy the following from your dashboard:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)

### 3. Get a Twilio Phone Number

1. In the Twilio Console, go to **Phone Numbers** > **Manage** > **Buy a number**
2. Search for a number in your country (Australia: +61)
3. Make sure the number has **SMS** and **MMS** capabilities (required for sending images)
4. Purchase the number (free trial gives you credit)
5. Copy your new Twilio phone number (format: `+61412345678`)

### 4. Configure Environment Variables

Add these three environment variables to your `.env` file:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+61412345678
```

**Important:**
- Replace `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual Account SID
- Replace `your_auth_token_here` with your actual Auth Token
- Replace `+61412345678` with your Twilio phone number in E.164 format (with country code)

### 5. Add Phone Numbers to Staff Profiles

1. Go to **Settings** > **Staff Management**
2. Edit each staff member and add their mobile phone number
3. Phone numbers can be in any of these formats:
   - `0412345678` (will be converted to +61412345678)
   - `+61412345678`
   - `61412345678`

### 6. Test the System

1. Create a test roster with one or two shifts
2. Make sure the staff members have phone numbers in their profiles
3. Publish the roster
4. Check the console logs to confirm SMS were sent
5. Staff should receive an SMS with the roster image attached

## How It Works

### Automatic Sending (On Publish)

When you change a roster status to **Published**:
1. System generates a high-quality PNG image of the roster
2. Finds all staff with shifts on that roster
3. Filters to only staff with valid phone numbers
4. Sends MMS (multimedia message) with:
   - Personalized greeting: "Hi [Name]! Your roster for the week of..."
   - Full roster image as PNG attachment
5. Returns results showing how many SMS were sent successfully

### Manual Resending

After a roster is published, you'll see a **📱 Send SMS** button that allows you to:
- Resend the roster SMS if someone didn't receive it
- Send to staff who added their phone number after initial publish
- Retry if there were failures

## Pricing

### Twilio Free Trial
- $15 USD credit included
- MMS (with image) costs approximately $0.02-0.04 per message to Australian numbers
- ~375-750 messages with trial credit

### Twilio Paid Plans
After trial credit runs out:
- **Phone Number**: ~$1 USD/month
- **MMS to Australian mobiles**: ~$0.02-0.04 USD per message
- **Example**: 10 staff × 52 weeks = 520 messages/year ≈ $20-30 USD/year

## Phone Number Format

The system automatically converts Australian phone numbers to the correct format:

| You Enter      | System Converts To |
|----------------|-------------------|
| 0412345678     | +61412345678     |
| 61412345678    | +61412345678     |
| +61412345678   | +61412345678     |

## Troubleshooting

### "Twilio credentials not configured" error
- Check that all three environment variables are set in `.env`
- Restart the development server after adding variables

### SMS not sending
- Verify phone numbers are valid Australian mobile numbers (04xx xxx xxx)
- Check Twilio console for error logs: [https://console.twilio.com/](https://console.twilio.com/)
- Ensure your Twilio number has MMS capabilities

### "Failed to generate roster image" error
- This usually means Puppeteer couldn't launch the browser
- On production servers, you may need to install additional dependencies
- Check the server logs for detailed error messages

### MMS images not displaying
- Ensure the Twilio phone number you purchased has **MMS capability**
- Some carriers block MMS from unknown senders - test with your own number first
- MMS may take 1-2 minutes to deliver depending on carrier

## Security Notes

- **NEVER commit your `.env` file to git** - it contains sensitive credentials
- Twilio Auth Token is like a password - keep it secret
- Rotate your Auth Token periodically in the Twilio console
- Monitor your Twilio usage dashboard to detect any unusual activity

## Support

If you need help:
- Twilio Support: [https://support.twilio.com/](https://support.twilio.com/)
- Twilio Docs: [https://www.twilio.com/docs/sms](https://www.twilio.com/docs/sms)
