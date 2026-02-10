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
  return { r: 1, g: 1, b: 1 }; // White default
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

    // Create PDF document - A4 size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([mmToPt(210), mmToPt(297)]); // A4 in points

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Page dimensions
    const pageWidth = mmToPt(210);
    const pageHeight = mmToPt(297);
    const margin = mmToPt(5);
    
    // Label dimensions: 100mm × 71.75mm
    const labelWidth = mmToPt(100);
    const labelHeight = mmToPt(71.75);

    // Draw labels (max 8 per page)
    const pageLabels = labels.slice(0, 8);
    
    pageLabels.forEach((label, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      
      // Calculate position (PDF origin is bottom-left)
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

      // Center point for text
      const centerX = x + labelWidth / 2;
      let currentY = y + labelHeight - mmToPt(12); // Start from top with padding

      // "Organic" text
      if (label.organic) {
        const organicText = 'Organic';
        const organicSize = mmToPt(6);
        const organicWidth = helvetica.widthOfTextAtSize(organicText, organicSize);
        page.drawText(organicText, {
          x: centerX - organicWidth / 2,
          y: currentY,
          size: organicSize,
          font: helvetica,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        currentY -= mmToPt(8);
      }

      // Item name (uppercase)
      const itemName = (label.name || 'Item Name').toUpperCase();
      const nameSize = mmToPt(7);
      const nameWidth = helveticaBold.widthOfTextAtSize(itemName, nameSize);
      
      // Wrap text if too long
      const maxWidth = labelWidth - mmToPt(10);
      if (nameWidth > maxWidth) {
        // Simple truncation for now
        const truncated = itemName.slice(0, Math.floor(itemName.length * (maxWidth / nameWidth))) + '...';
        const truncWidth = helveticaBold.widthOfTextAtSize(truncated, nameSize);
        page.drawText(truncated, {
          x: centerX - truncWidth / 2,
          y: currentY,
          size: nameSize,
          font: helveticaBold,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
      } else {
        page.drawText(itemName, {
          x: centerX - nameWidth / 2,
          y: currentY,
          size: nameSize,
          font: helveticaBold,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
      }
      currentY -= mmToPt(10);

      // Dietary badges
      const badges: string[] = [];
      if (label.vegan) badges.push('VEGAN');
      if (label.glutenFree) badges.push('GF');
      
      if (badges.length > 0) {
        const badgeSize = mmToPt(3);
        const badgeHeight = mmToPt(5);
        const badgePadding = mmToPt(3);
        const badgeGap = mmToPt(2);
        
        // Calculate total width of badges
        let totalBadgeWidth = 0;
        badges.forEach((badge, i) => {
          totalBadgeWidth += helveticaBold.widthOfTextAtSize(badge, badgeSize) + badgePadding * 2;
          if (i < badges.length - 1) totalBadgeWidth += badgeGap;
        });
        
        let badgeX = centerX - totalBadgeWidth / 2;
        
        badges.forEach((badge) => {
          const textWidth = helveticaBold.widthOfTextAtSize(badge, badgeSize);
          const pillWidth = textWidth + badgePadding * 2;
          
          // Draw pill background
          page.drawRectangle({
            x: badgeX,
            y: currentY - badgeHeight / 2,
            width: pillWidth,
            height: badgeHeight,
            color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
          });
          
          // Draw badge text
          page.drawText(badge, {
            x: badgeX + badgePadding,
            y: currentY - badgeSize / 2,
            size: badgeSize,
            font: helveticaBold,
            color: rgb(1, 1, 1),
          });
          
          badgeX += pillWidth + badgeGap;
        });
        
        currentY -= mmToPt(8);
      }

      // Ingredients
      if (label.ingredients) {
        const ingredientsText = label.ingredients.toUpperCase();
        const ingredientsSize = mmToPt(2.5);
        const ingredientsWidth = helvetica.widthOfTextAtSize(ingredientsText, ingredientsSize);
        const maxIngWidth = labelWidth - mmToPt(10);
        
        const displayText = ingredientsWidth > maxIngWidth 
          ? ingredientsText.slice(0, Math.floor(ingredientsText.length * (maxIngWidth / ingredientsWidth))) + '...'
          : ingredientsText;
        const displayWidth = helvetica.widthOfTextAtSize(displayText, ingredientsSize);
        
        page.drawText(displayText, {
          x: centerX - displayWidth / 2,
          y: currentY,
          size: ingredientsSize,
          font: helvetica,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        currentY -= mmToPt(6);
      }

      // Price badge
      if (label.price) {
        const priceText = `$${parseFloat(label.price).toFixed(2)}`;
        const priceSize = mmToPt(5);
        const priceWidth = helveticaBold.widthOfTextAtSize(priceText, priceSize);
        const pricePillWidth = priceWidth + mmToPt(8);
        const pricePillHeight = mmToPt(7);
        
        // Draw pill background
        page.drawRectangle({
          x: centerX - pricePillWidth / 2,
          y: currentY - pricePillHeight / 2,
          width: pricePillWidth,
          height: pricePillHeight,
          color: rgb(darkGreenRgb.r, darkGreenRgb.g, darkGreenRgb.b),
        });
        
        // Draw price text
        page.drawText(priceText, {
          x: centerX - priceWidth / 2,
          y: currentY - priceSize / 3,
          size: priceSize,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
      }
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF
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
