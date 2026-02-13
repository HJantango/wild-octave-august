// DYMO Label Printing Utilities
// Works with DYMO Connect Web Service (must be running locally)

declare global {
  interface Window {
    dymo: any;
  }
}

// DYMO Web Service endpoints
const DYMO_WS_URL = 'https://127.0.0.1:41951/DYMO/DLS/Printing';
const DYMO_WS_URL_HTTP = 'http://127.0.0.1:41950/DYMO/DLS/Printing';

export interface ShelfLabel {
  productName: string;
  price: string;
}

// 25mm x 25mm (1" x 1") label template
// Product name at top, price at bottom (large & bold)
function createLabelXml(label: ShelfLabel): string {
  // Escape XML special characters
  const escapeXml = (str: string) => 
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&apos;');

  const productName = escapeXml(label.productName);
  const price = escapeXml(label.price);

  return `<?xml version="1.0" encoding="utf-8"?>
<DesktopLabel Version="1">
  <DYMOLabel Version="3">
    <Description>Shelf Price Label</Description>
    <Orientation>Landscape</Orientation>
    <LabelName>Small Square</LabelName>
    <InitialLength>0</InitialLength>
    <BorderStyle>SolidLine</BorderStyle>
    <DYMORect>
      <DYMOPoint>
        <X>0</X>
        <Y>0</Y>
      </DYMOPoint>
      <Size>
        <Width>254</Width>
        <Height>254</Height>
      </Size>
    </DYMORect>
    <BorderColor>
      <SolidColorBrush>
        <Color A="1" R="0" G="0" B="0"></Color>
      </SolidColorBrush>
    </BorderColor>
    <BorderThickness>0</BorderThickness>
    <Show_Border>False</Show_Border>
    <ObjectInfo>
      <TextObject>
        <Name>ProductName</Name>
        <ForeColor>
          <SolidColorBrush>
            <Color A="1" R="0" G="0" B="0"></Color>
          </SolidColorBrush>
        </ForeColor>
        <BackColor>
          <SolidColorBrush>
            <Color A="0" R="1" G="1" B="1"></Color>
          </SolidColorBrush>
        </BackColor>
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <GroupID>-1</GroupID>
        <IsOutlined>False</IsOutlined>
        <HorizontalAlignment>Center</HorizontalAlignment>
        <VerticalAlignment>Top</VerticalAlignment>
        <TextFitMode>ShrinkToFit</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String xml:space="preserve">${productName}</String>
            <Attributes>
              <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100"/>
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="5" Y="5" Width="244" Height="140"/>
    </ObjectInfo>
    <ObjectInfo>
      <TextObject>
        <Name>Price</Name>
        <ForeColor>
          <SolidColorBrush>
            <Color A="1" R="0" G="0" B="0"></Color>
          </SolidColorBrush>
        </ForeColor>
        <BackColor>
          <SolidColorBrush>
            <Color A="0" R="1" G="1" B="1"></Color>
          </SolidColorBrush>
        </BackColor>
        <LinkedObjectName></LinkedObjectName>
        <Rotation>Rotation0</Rotation>
        <IsMirrored>False</IsMirrored>
        <IsVariable>False</IsVariable>
        <GroupID>-1</GroupID>
        <IsOutlined>False</IsOutlined>
        <HorizontalAlignment>Center</HorizontalAlignment>
        <VerticalAlignment>Bottom</VerticalAlignment>
        <TextFitMode>ShrinkToFit</TextFitMode>
        <UseFullFontHeight>True</UseFullFontHeight>
        <Verticalized>False</Verticalized>
        <StyledText>
          <Element>
            <String xml:space="preserve">${price}</String>
            <Attributes>
              <Font Family="Arial" Size="14" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
              <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100"/>
            </Attributes>
          </Element>
        </StyledText>
      </TextObject>
      <Bounds X="5" Y="145" Width="244" Height="104"/>
    </ObjectInfo>
  </DYMOLabel>
</DesktopLabel>`;
}

// Check if DYMO Web Service is available
export async function checkDymoService(): Promise<{ available: boolean; printers: string[]; error?: string; endpoint?: string }> {
  // Try HTTPS first (preferred), then HTTP
  const endpoints = [DYMO_WS_URL, DYMO_WS_URL_HTTP];
  
  for (const baseUrl of endpoints) {
    try {
      console.log(`[DYMO] Trying ${baseUrl}/GetPrinters...`);
      const response = await fetch(`${baseUrl}/GetPrinters`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const text = await response.text();
        console.log('[DYMO] Response:', text.substring(0, 200));
        // Parse printer list from XML response
        const printerMatches = text.match(/<Name>([^<]+)<\/Name>/g) || [];
        const printers = printerMatches.map(m => m.replace(/<\/?Name>/g, ''));
        console.log('[DYMO] Found printers:', printers);
        return { available: true, printers, endpoint: baseUrl };
      } else {
        console.log(`[DYMO] ${baseUrl} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`[DYMO] ${baseUrl} failed:`, error);
    }
  }
  
  return { 
    available: false, 
    printers: [], 
    error: 'Could not connect to DYMO Web Service on ports 41951 (HTTPS) or 41950 (HTTP). Make sure DYMO Connect is running and Web Service is enabled in Settings.' 
  };
}

// Print a single label
export async function printLabel(label: ShelfLabel, printerName?: string): Promise<boolean> {
  try {
    const labelXml = createLabelXml(label);
    
    const params = new URLSearchParams();
    params.append('printerName', printerName || '');
    params.append('labelXml', labelXml);
    params.append('labelSetXml', '');
    
    let response;
    try {
      response = await fetch(`${DYMO_WS_URL}/PrintLabel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch {
      response = await fetch(`${DYMO_WS_URL_HTTP}/PrintLabel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    }
    
    return response.ok;
  } catch (error) {
    console.error('Print failed:', error);
    return false;
  }
}

// Print multiple labels
export async function printLabels(
  labels: ShelfLabel[], 
  printerName?: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < labels.length; i++) {
    const result = await printLabel(labels[i], printerName);
    if (result) {
      success++;
    } else {
      failed++;
    }
    onProgress?.(i + 1, labels.length);
    
    // Small delay between prints to not overwhelm the printer
    if (i < labels.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return { success, failed };
}

// Format price for label
export function formatPriceForLabel(price: number): string {
  return `$${price.toFixed(2)}`;
}
