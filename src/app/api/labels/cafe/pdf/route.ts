import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

const DARK_GREEN = '#054921';

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

// Generate HTML for the label sheet
function generateLabelHTML(labels: CafeLabel[]): string {
  // Take first 8 labels
  const pageLabels = labels.slice(0, 8);
  
  const labelHTML = pageLabels.map((label, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const left = 5 + col * 100; // 5mm margin + column offset
    const top = 5 + row * 71.75; // 5mm margin + row offset
    
    const hasDietaryTags = label.vegan || label.glutenFree;
    
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
            ${label.vegan ? `
              <span style="
                background-color: ${DARK_GREEN};
                color: #fff;
                font-size: 3mm;
                font-weight: 700;
                padding: 1mm 3mm;
                border-radius: 999px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
              ">Vegan</span>
            ` : ''}
            ${label.glutenFree ? `
              <span style="
                background-color: ${DARK_GREEN};
                color: #fff;
                font-size: 3mm;
                font-weight: 700;
                padding: 1mm 3mm;
                border-radius: 999px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
              ">GF</span>
            ` : ''}
          </div>
        ` : ''}
        
        ${label.ingredients ? `
          <p style="
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
            font-size: 5mm;
            font-weight: 800;
            padding: 1.5mm 5mm;
            border-radius: 999px;
            margin-top: 3mm;
          ">$${parseFloat(label.price).toFixed(2)}</span>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          background: white;
        }
        .page {
          width: 210mm;
          height: 297mm;
          position: relative;
          background: white;
        }
      </style>
    </head>
    <body>
      <div class="page">
        ${labelHTML}
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

    // Generate HTML
    const html = generateLabelHTML(labels);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Set content and wait for fonts to load
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF with exact A4 dimensions
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    // Return PDF
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cafe-labels.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
