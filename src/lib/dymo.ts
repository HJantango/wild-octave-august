// DYMO Label Printing Utilities
// Uses direct REST API calls to DYMO Web Service

export interface ShelfLabel {
  productName: string;
  price: string;
}

// DYMO Web Service endpoints - try both HTTPS and HTTP
const ENDPOINTS = [
  'https://127.0.0.1:41951/DYMO/DLS/Printing',
  'https://localhost:41951/DYMO/DLS/Printing',
  'http://127.0.0.1:41950/DYMO/DLS/Printing',
  'http://localhost:41950/DYMO/DLS/Printing',
];

let workingEndpoint: string | null = null;

// 25mm x 25mm (1" x 1") label template for shelf prices
function createLabelXml(label: ShelfLabel): string {
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

// Try to connect to DYMO Web Service
async function tryEndpoint(endpoint: string): Promise<{ ok: boolean; printers: string[] }> {
  try {
    console.log(`[DYMO] Trying ${endpoint}...`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${endpoint}/GetPrinters`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`[DYMO] ${endpoint} responded:`, text.substring(0, 100));
      
      // Parse printer names from XML
      const printerMatches = text.match(/<Name>([^<]+)<\/Name>/g) || [];
      const printers = printerMatches.map(m => m.replace(/<\/?Name>/g, ''));
      
      return { ok: true, printers };
    }
    
    console.log(`[DYMO] ${endpoint} returned status ${response.status}`);
    return { ok: false, printers: [] };
  } catch (error: any) {
    console.log(`[DYMO] ${endpoint} failed:`, error.message || error);
    return { ok: false, printers: [] };
  }
}

// Check if DYMO Web Service is available
export async function checkDymoService(): Promise<{ available: boolean; printers: string[]; error?: string; endpoint?: string }> {
  // Try all endpoints in parallel
  const results = await Promise.all(ENDPOINTS.map(async (endpoint) => {
    const result = await tryEndpoint(endpoint);
    return { endpoint, ...result };
  }));
  
  // Find the first working endpoint
  const working = results.find(r => r.ok && r.printers.length > 0);
  
  if (working) {
    workingEndpoint = working.endpoint;
    console.log(`[DYMO] Using endpoint: ${workingEndpoint}`);
    return { 
      available: true, 
      printers: working.printers,
      endpoint: working.endpoint 
    };
  }
  
  // Check if service is up but no printers
  const serviceUp = results.find(r => r.ok);
  if (serviceUp) {
    workingEndpoint = serviceUp.endpoint;
    return {
      available: true,
      printers: [],
      error: 'DYMO service running but no printers connected',
      endpoint: serviceUp.endpoint
    };
  }
  
  return { 
    available: false, 
    printers: [], 
    error: 'Cannot connect to DYMO Web Service. Make sure DYMO Connect is running with Web Service enabled. Check browser console (F12) for CORS errors.' 
  };
}

// Print a single label
export async function printLabel(label: ShelfLabel, printerName: string): Promise<boolean> {
  if (!workingEndpoint) {
    const check = await checkDymoService();
    if (!check.available) return false;
  }

  try {
    const labelXml = createLabelXml(label);
    console.log(`[DYMO] Printing "${label.productName}" - ${label.price} to ${printerName}`);
    
    const params = new URLSearchParams();
    params.append('printerName', printerName);
    params.append('labelXml', labelXml);
    params.append('labelSetXml', '');
    
    const response = await fetch(`${workingEndpoint}/PrintLabel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    if (response.ok) {
      console.log('[DYMO] Print success');
      return true;
    } else {
      console.log('[DYMO] Print failed:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('[DYMO] Print error:', error);
    return false;
  }
}

// Print multiple labels
export async function printLabels(
  labels: ShelfLabel[], 
  printerName: string,
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
    
    // Delay between prints
    if (i < labels.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return { success, failed };
}

// Format price for label
export function formatPriceForLabel(price: number): string {
  return `$${price.toFixed(2)}`;
}
