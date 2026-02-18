import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

interface CafeLabel {
  id: string;
  name: string;
  organic: boolean;
  vegan: boolean;
  glutenFree: boolean;
  ingredients: string;
  price: string;
  bgColor: string;
}

const DARK_GREEN = '#054921';

function generateLabelHtml(label: CafeLabel, index: number): string {
  const hasDietaryTags = label.vegan || label.glutenFree;
  
  // Calculate position: 2 columns × 4 rows
  // Each label: 100mm wide × 71.75mm tall
  const col = index % 2;
  const row = Math.floor(index / 2);
  const left = col * 100; // 0 or 100mm
  const top = row * 71.75; // 0, 71.75, 143.5, 215.25mm

  const badges = [];
  if (label.vegan) badges.push('VEGAN');
  if (label.glutenFree) badges.push('GF');

  return `
    <div style="
      position: absolute;
      left: ${left}mm;
      top: ${top}mm;
      width: 100mm;
      height: 71.75mm;
      background-color: ${label.bgColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 5mm;
      box-sizing: border-box;
    ">
      ${label.organic ? `
        <p style="
          font-family: 'Dancing Script', cursive;
          font-size: 7mm;
          color: ${DARK_GREEN};
          margin: 0 0 1mm 0;
          line-height: 1.1;
        ">Organic</p>
      ` : ''}
      
      <h2 style="
        font-family: 'Playfair Display', Georgia, serif;
        font-weight: 800;
        font-size: 8mm;
        color: ${DARK_GREEN};
        text-transform: uppercase;
        line-height: 1.1;
        margin: 1mm 0 2mm 0;
        letter-spacing: 0.02em;
        max-width: 90mm;
        word-break: break-word;
      ">${label.name || 'Item Name'}</h2>
      
      ${hasDietaryTags ? `
        <div style="display: flex; gap: 2mm; margin-bottom: 2mm;">
          ${badges.map(badge => `
            <span style="
              background-color: ${DARK_GREEN};
              color: #fff;
              font-family: Arial, sans-serif;
              font-size: 3mm;
              font-weight: 700;
              padding: 1mm 3mm;
              border-radius: 999px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            ">${badge}</span>
          `).join('')}
        </div>
      ` : ''}
      
      ${label.ingredients ? `
        <p style="
          font-family: Arial, sans-serif;
          font-size: 2.5mm;
          color: ${DARK_GREEN};
          text-transform: uppercase;
          letter-spacing: 0.06em;
          line-height: 1.3;
          max-width: 90mm;
          margin: 0;
          opacity: 0.85;
        ">${label.ingredients}</p>
      ` : ''}
      
      ${label.price ? `
        <span style="
          background-color: ${DARK_GREEN};
          color: #fff;
          font-family: Arial, sans-serif;
          font-size: 5mm;
          font-weight: 800;
          padding: 1.5mm 5mm;
          border-radius: 999px;
          margin-top: 3mm;
        ">$${parseFloat(label.price).toFixed(2)}</span>
      ` : ''}
    </div>
  `;
}

function generatePageHtml(labels: CafeLabel[]): string {
  const pageLabels = labels.slice(0, 8);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      </style>
    </head>
    <body>
      <div style="
        width: 210mm;
        height: 297mm;
        padding: 5mm;
        box-sizing: border-box;
        position: relative;
        background: white;
      ">
        <div style="position: relative; width: 200mm; height: 287mm;">
          ${pageLabels.map((label, index) => generateLabelHtml(label, index)).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { labels } = body as { labels: CafeLabel[] };

    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No labels provided' },
        { status: 400 }
      );
    }

    const html = generatePageHtml(labels);

    // Launch Puppeteer (use system Chromium on Railway)
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();
    
    // Set content and wait for fonts to load
    await page.setContent(html, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });
    
    // Extra wait for fonts
    await page.evaluateHandle('document.fonts.ready');
    
    // Small extra delay for font rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cafe-labels.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
