import nodemailer from 'nodemailer';

interface MissingItemsEmailOptions {
  vendorEmail: string;
  vendorName: string;
  invoiceNumber: string;
  missingItems: string[];
  notes?: string;
}

export async function sendMissingItemsEmail(options: MissingItemsEmailOptions) {
  const { vendorEmail, vendorName, invoiceNumber, missingItems, notes } = options;

  // Create reusable transporter using SMTP settings
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Create email content
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Missing Items Notification</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Invoice #${invoiceNumber}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
        <p style="font-size: 16px; color: #495057; margin: 0 0 20px 0;">
          Dear <strong>${vendorName}</strong>,
        </p>
        
        <p style="font-size: 14px; color: #6c757d; margin: 0 0 20px 0;">
          We have received your recent delivery for Invoice <strong>#${invoiceNumber}</strong>, however, 
          the following items appear to be missing from the shipment:
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #dc3545; font-size: 16px;">Missing Items:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${missingItems.map(item => `<li style="margin: 5px 0; color: #495057;">${item}</li>`).join('')}
          </ul>
        </div>
        
        ${notes ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">Additional Notes:</h4>
            <p style="margin: 0; color: #856404; font-size: 14px;">${notes}</p>
          </div>
        ` : ''}
        
        <p style="font-size: 14px; color: #6c757d; margin: 20px 0;">
          Could you please check your records and arrange for the missing items to be sent at your earliest convenience? 
          If these items were intentionally omitted or are on backorder, please let us know so we can update our records accordingly.
        </p>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; color: #0c5460;">
            <strong>📧 This is an automated notification from Wild Octave invoice processing system.</strong><br>
            Please reply to this email with any questions or updates regarding the missing items.
          </p>
        </div>
        
        <p style="font-size: 14px; color: #495057; margin: 30px 0 0 0;">
          Thank you for your prompt attention to this matter.
        </p>
        
        <p style="font-size: 14px; color: #495057; margin: 10px 0 0 0;">
          Best regards,<br>
          <strong>Wild Octave Team</strong>
        </p>
      </div>
    </div>
  `;

  const textContent = `
Missing Items Notification - Invoice #${invoiceNumber}

Dear ${vendorName},

We have received your recent delivery for Invoice #${invoiceNumber}, however, the following items appear to be missing from the shipment:

Missing Items:
${missingItems.map(item => `- ${item}`).join('\n')}

${notes ? `\nAdditional Notes:\n${notes}\n` : ''}

Could you please check your records and arrange for the missing items to be sent at your earliest convenience? If these items were intentionally omitted or are on backorder, please let us know so we can update our records accordingly.

This is an automated notification from Wild Octave invoice processing system.
Please reply to this email with any questions or updates regarding the missing items.

Thank you for your prompt attention to this matter.

Best regards,
Wild Octave Team
  `;

  // Send email
  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: vendorEmail,
    subject: `Missing Items - Invoice #${invoiceNumber} - ${vendorName}`,
    text: textContent,
    html: htmlContent,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Missing items email sent:', info.messageId);
  
  return info;
}