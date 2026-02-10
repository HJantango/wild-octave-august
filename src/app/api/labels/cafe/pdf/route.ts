import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

// Convert hex color to RGB (0-1 range)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 1, g: 1, b: 1 };
}

// Convert mm to points (1mm = 2.834645669 points)
function mmToPt(mm: number): number {
  return mm * 2.834645669;
}

const DARK_GREEN = '#054921';
const darkGreenRgb = hexToRgb(DARK_GREEN);

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

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Use standard fonts (custom fonts can be added later)
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Create A4 page
    const page = pdfDoc.addPage([mmToPt(210), mmToPt(297)]);
    const pageHeight = mmToPt(297);
    const margin = mmToPt(5);
    const labelWidth = mmToPt(100);
    const labelHeight = mmToPt(71.75);

    // Draw labels (max 8 per page)
    const pageLabels = labels.slice(0, 8);
    
    pageLabels.forEach((label, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      
      const x = margin + col * labelWidth;
      const y = pageHeight - margin - (row + 1) * labelHeight;
      
      // Draw background
      const bgColor = hexToRgb(label.bgColor);
      page.drawRectangle({
        x,
        y,
        width: labelWidth,
        height: labelHeight,
        color: rgb(bgColor.r, bgColor.g, bgColor.b),
      });

      const centerX = x + labelWidth / 2;
      const labelCenterY = y + labelHeight / 2;
      
      // Calculate content heights for vertical centering
      const organicHeight = label.organic ? mmToPt(10) : 0;
      const nameHeight = mmToPt(14);
      const badgesHeight = (label.vegan || label.glutenFree) ? mmToPt(10) : 0;
      const ingredientsHeight = label.ingredients ? mmToPt(8) : 0;
      const priceHeight = label.price ? mmToPt(12) : 0;
      
      const totalContentHeight = organicHeight + nameHeight + badgesHeight + ingredientsHeight + priceHeight;
      
      // Start from top of centered content
      let currentY = labelCenterY + totalContentHeight / 2;

      // "Organic" text (italic style)
      if (label.organic) {
        const organicText = 'Organic';
        const organicSize = mmToPt(8);
        const organicWidth = timesItalic.widthOfTextAtSize(organicText, organicSize);
        page.drawText(organicText, {
          x: centerX - organicWidth / 2,
          y: currentY - organicSize,
          size: organicSize,
          font: timesItalic,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        currentY -= mmToPt(10);
      }

      // Item name (bold, uppercase)
      const itemName = (label.name || 'Item Name').toUpperCase();
      const nameSize = mmToPt(9);
      const maxNameWidth = labelWidth - mmToPt(10);
      
      let displayName = itemName;
      let nameWidth = timesBold.widthOfTextAtSize(displayName, nameSize);
      
      if (nameWidth > maxNameWidth) {
        while (nameWidth > maxNameWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -4) + '...';
          nameWidth = timesBold.widthOfTextAtSize(displayName, nameSize);
        }
      }
      
      page.drawText(displayName, {
        x: centerX - nameWidth / 2,
        y: currentY - nameSize,
        size: nameSize,
        font: timesBold,
        color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
      });
      currentY -= mmToPt(14);

      // Dietary badges
      const badges: string[] = [];
      if (label.vegan) badges.push('VEGAN');
      if (label.glutenFree) badges.push('GF');
      
      if (badges.length > 0) {
        const badgeSize = mmToPt(3.5);
        const pillHeight = mmToPt(6);
        const pillPadding = mmToPt(4);
        const pillGap = mmToPt(4);
        
        // Calculate total width
        let totalWidth = 0;
        badges.forEach((badge, i) => {
          totalWidth += helveticaBold.widthOfTextAtSize(badge, badgeSize) + pillPadding * 2;
          if (i < badges.length - 1) totalWidth += pillGap;
        });
        
        let badgeX = centerX - totalWidth / 2;
        
        badges.forEach((badge) => {
          const textWidth = helveticaBold.widthOfTextAtSize(badge, badgeSize);
          const pillWidth = textWidth + pillPadding * 2;
          
          // Draw pill background
          page.drawRectangle({
            x: badgeX,
            y: currentY - pillHeight,
            width: pillWidth,
            height: pillHeight,
            color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
          });
          
          // Draw badge text
          page.drawText(badge, {
            x: badgeX + pillPadding,
            y: currentY - pillHeight + (pillHeight - badgeSize) / 2,
            size: badgeSize,
            font: helveticaBold,
            color: rgb(1, 1, 1),
          });
          
          badgeX += pillWidth + pillGap;
        });
        
        currentY -= mmToPt(10);
      }

      // Ingredients (smaller, uppercase)
      if (label.ingredients) {
        const ingredientsText = label.ingredients.toUpperCase();
        const ingredientsSize = mmToPt(2.8);
        const maxIngWidth = labelWidth - mmToPt(10);
        
        let displayIng = ingredientsText;
        let ingWidth = helvetica.widthOfTextAtSize(displayIng, ingredientsSize);
        
        if (ingWidth > maxIngWidth) {
          while (ingWidth > maxIngWidth && displayIng.length > 3) {
            displayIng = displayIng.slice(0, -4) + '...';
            ingWidth = helvetica.widthOfTextAtSize(displayIng, ingredientsSize);
          }
        }
        
        page.drawText(displayIng, {
          x: centerX - ingWidth / 2,
          y: currentY - ingredientsSize,
          size: ingredientsSize,
          font: helvetica,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        currentY -= mmToPt(8);
      }

      // Price badge
      if (label.price) {
        const priceText = `$${parseFloat(label.price).toFixed(2)}`;
        const priceSize = mmToPt(6);
        const priceWidth = helveticaBold.widthOfTextAtSize(priceText, priceSize);
        const pricePillWidth = priceWidth + mmToPt(12);
        const pricePillHeight = mmToPt(8);
        
        page.drawRectangle({
          x: centerX - pricePillWidth / 2,
          y: currentY - pricePillHeight,
          width: pricePillWidth,
          height: pricePillHeight,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        
        page.drawText(priceText, {
          x: centerX - priceWidth / 2,
          y: currentY - pricePillHeight + (pricePillHeight - priceSize) / 2,
          size: priceSize,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
      }
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
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
