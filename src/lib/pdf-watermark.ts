import nodemailer from 'nodemailer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface SendEmailOptions {
  to: string;
  invoiceNumber: string;
  vendorName: string;
  totalAmount: number;
  attachments: EmailAttachment[];
}

export async function addWatermarkToPdf(
  originalPdfBuffer: Buffer,
  invoiceNumber: string,
  options?: { includeReceived?: boolean }
): Promise<{ enteredPdf: Buffer; sentPdf: Buffer }> {
  // Load the original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Create ENTERED version
  const enteredDoc = await PDFDocument.load(originalPdfBuffer);
  const enteredPages = enteredDoc.getPages();
  
  // Create SENT version
  const sentDoc = await PDFDocument.load(originalPdfBuffer);
  const sentPages = sentDoc.getPages();

  // Add ENTERED watermark
  enteredPages.forEach((page) => {
    const { width, height } = page.getSize();
    
    // Add RECEIVED watermark if items are received
    if (options?.includeReceived) {
      page.drawText('RECEIVED', {
        x: width - 150,
        y: height - 50,
        size: 20,
        font: helveticaBold,
        color: rgb(0.1, 0.6, 0.1), // Green color
        opacity: 0.8,
      });
    }
    
    // Main ENTERED stamp
    page.drawText('ENTERED', {
      x: width - 150,
      y: options?.includeReceived ? height - 80 : height - 80,
      size: 24,
      font: helveticaBold,
      color: rgb(0.8, 0.1, 0.1), // Red color
      opacity: 0.8,
    });
    
    // Subtitle
    page.drawText('into Square', {
      x: width - 150,
      y: options?.includeReceived ? height - 105 : height - 105,
      size: 12,
      font: helvetica,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.8,
    });
  });

  // Add SENT watermark
  sentPages.forEach((page) => {
    const { width, height } = page.getSize();
    
    // Add RECEIVED watermark if items are received
    if (options?.includeReceived) {
      page.drawText('RECEIVED', {
        x: width - 150,
        y: height - 50,
        size: 20,
        font: helveticaBold,
        color: rgb(0.1, 0.6, 0.1), // Green color
        opacity: 0.8,
      });
    }
    
    // Main SENT stamp
    page.drawText('SENT', {
      x: width - 150,
      y: options?.includeReceived ? height - 80 : height - 80,
      size: 24,
      font: helveticaBold,
      color: rgb(0.8, 0.1, 0.1), // Red color
      opacity: 0.8,
    });
    
    // Subtitle
    page.drawText('to DEXT', {
      x: width - 150,
      y: options?.includeReceived ? height - 105 : height - 105,
      size: 12,
      font: helvetica,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.8,
    });
  });

  const enteredPdf = Buffer.from(await enteredDoc.save());
  const sentPdf = Buffer.from(await sentDoc.save());

  return { enteredPdf, sentPdf };
}

export async function sendInvoiceEmail(options: SendEmailOptions): Promise<void> {
  // Create transporter (configure with your email settings)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || 'invoices@wildoctave.com',
    to: options.to,
    subject: `Invoice ${options.invoiceNumber} - ${options.vendorName} - $${options.totalAmount.toFixed(2)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #3B82F6); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">🧾 Invoice Processed</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Ready for DEXT processing</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-left: 4px solid #059669;">
          <h3 style="color: #1e293b; margin: 0 0 15px 0;">Invoice Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Invoice Number:</td>
              <td style="padding: 8px 0; color: #1e293b;">${options.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Vendor:</td>
              <td style="padding: 8px 0; color: #1e293b;">${options.vendorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Total Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">$${options.totalAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; margin: 0 0 15px 0;">
            This invoice has been processed through our AI-powered system and is ready for DEXT.
          </p>
          
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px; margin: 15px 0;">
            <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">📎 Attachments</h4>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin: 5px 0;"><strong>ENTERED</strong> version - Shows items have been entered into Square</li>
              <li style="margin: 5px 0;"><strong>SENT</strong> version - Shows invoice has been sent to DEXT</li>
            </ul>
          </div>

          <p style="color: #64748b; font-size: 14px; margin: 15px 0 0 0; font-style: italic;">
            Generated automatically by Wild Octave Organics Invoice Management System
          </p>
        </div>
      </div>
    `,
    attachments: options.attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType
    }))
  };

  await transporter.sendMail(mailOptions);
}