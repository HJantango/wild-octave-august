import twilio from 'twilio';

interface SMSResult {
  success: boolean;
  recipientPhone: string;
  recipientName: string;
  messageSid?: string;
  error?: string;
}

/**
 * Sends an MMS message with the roster image to a phone number
 */
export async function sendRosterSMS(
  phoneNumber: string,
  recipientName: string,
  rosterImageBuffer: Buffer,
  weekStartDate: Date
): Promise<SMSResult> {
  try {
    // Validate environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.'
      );
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Format the week date for the message
    const weekFormatted = weekStartDate.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Create message body
    const messageBody = `Hi ${recipientName}! 📅 Your roster for the week of ${weekFormatted} has been published. Please check your email or the roster board at work for details. - Wild Octave Organics`;

    // Send SMS (text only - Twilio requires public URLs for MMS which we don't have set up yet)
    const message = await client.messages.create({
      body: messageBody,
      from: fromNumber,
      to: phoneNumber,
    });

    console.log(`✅ SMS sent to ${recipientName} (${phoneNumber}): ${message.sid}`);

    return {
      success: true,
      recipientPhone: phoneNumber,
      recipientName,
      messageSid: message.sid,
    };
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${recipientName} (${phoneNumber}):`, error);

    return {
      success: false,
      recipientPhone: phoneNumber,
      recipientName,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sends roster SMS to multiple recipients
 */
export async function sendRosterSMSBatch(
  recipients: Array<{ phone: string; name: string }>,
  rosterImageBuffer: Buffer,
  weekStartDate: Date
): Promise<SMSResult[]> {
  const results: SMSResult[] = [];

  // Send SMSes sequentially to avoid rate limiting
  // Twilio free tier has rate limits, so we add small delays
  for (const recipient of recipients) {
    const result = await sendRosterSMS(
      recipient.phone,
      recipient.name,
      rosterImageBuffer,
      weekStartDate
    );

    results.push(result);

    // Small delay to avoid hitting rate limits (100ms)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Validates a phone number format (basic validation)
 * Accepts formats like: +61412345678, 0412345678, etc.
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;

  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check if it's a valid Australian mobile number
  // Accepts: +61412345678, 61412345678, 0412345678
  const australianMobileRegex = /^(\+?61|0)[4-5]\d{8}$/;

  return australianMobileRegex.test(cleaned);
}

/**
 * Normalizes phone number to E.164 format for Twilio
 * Converts Australian numbers like 0412345678 to +61412345678
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // If starts with 0, replace with +61
  if (cleaned.startsWith('0')) {
    cleaned = '+61' + cleaned.substring(1);
  }

  // If starts with 61 but not +, add +
  if (cleaned.startsWith('61') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // If doesn't start with +, assume it needs +61
  if (!cleaned.startsWith('+')) {
    cleaned = '+61' + cleaned;
  }

  return cleaned;
}
