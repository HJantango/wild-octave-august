// DYMO Label Printing Utilities
// Uses DYMO Connect JavaScript SDK (loaded from local web service)

declare global {
  interface Window {
    dymo: {
      label: {
        framework: {
          init: () => Promise<void>;
          getPrinters: () => Array<{ name: string; printerType: string; isConnected: boolean }>;
          openLabelXml: (xml: string) => any;
          printLabel: (printerName: string, printParamsXml: string, labelXml: string, labelSetXml: string) => void;
        };
      };
    };
  }
}

export interface ShelfLabel {
  productName: string;
  price: string;
}

// Track if SDK is loaded
let sdkLoaded = false;
let sdkLoadPromise: Promise<boolean> | null = null;

// Load DYMO JavaScript SDK from local web service
async function loadDymoSdk(): Promise<boolean> {
  if (sdkLoaded && window.dymo?.label?.framework) {
    return true;
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve) => {
    // Try HTTPS first, then HTTP
    const urls = [
      'https://127.0.0.1:41951/DYMO/DLS/Printing/JavaScript/dymo.connect.framework.js',
      'http://127.0.0.1:41950/DYMO/DLS/Printing/JavaScript/dymo.connect.framework.js',
    ];

    let loaded = false;
    let attempts = 0;

    const tryLoad = (url: string) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      script.onload = async () => {
        if (loaded) return;
        loaded = true;
        console.log('[DYMO] SDK loaded from', url);
        
        // Initialize the framework
        try {
          if (window.dymo?.label?.framework?.init) {
            await window.dymo.label.framework.init();
            console.log('[DYMO] Framework initialized');
          }
          sdkLoaded = true;
          resolve(true);
        } catch (err) {
          console.error('[DYMO] Framework init failed:', err);
          resolve(false);
        }
      };
      
      script.onerror = () => {
        attempts++;
        console.log(`[DYMO] Failed to load from ${url}`);
        if (attempts >= urls.length) {
          resolve(false);
        }
      };
      
      document.head.appendChild(script);
    };

    // Try both URLs
    urls.forEach(tryLoad);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!loaded) {
        console.log('[DYMO] SDK load timeout');
        resolve(false);
      }
    }, 5000);
  });

  return sdkLoadPromise;
}

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

  // Simple label XML for 25x25mm label
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
export async function checkDymoService(): Promise<{ available: boolean; printers: string[]; error?: string }> {
  try {
    const loaded = await loadDymoSdk();
    if (!loaded) {
      return { 
        available: false, 
        printers: [], 
        error: 'Could not load DYMO SDK. Make sure DYMO Connect is running with Web Service enabled.' 
      };
    }

    const printers = window.dymo.label.framework.getPrinters();
    console.log('[DYMO] Printers found:', printers);
    
    const printerNames = printers
      .filter((p: any) => p.printerType === 'LabelWriterPrinter' && p.isConnected)
      .map((p: any) => p.name);
    
    if (printerNames.length === 0) {
      return { 
        available: true, 
        printers: [], 
        error: 'DYMO service running but no label printers connected.' 
      };
    }

    return { available: true, printers: printerNames };
  } catch (error) {
    console.error('[DYMO] Service check failed:', error);
    return { 
      available: false, 
      printers: [], 
      error: `DYMO check failed: ${error}` 
    };
  }
}

// Print a single label using the SDK
export async function printLabel(label: ShelfLabel, printerName: string): Promise<boolean> {
  try {
    if (!window.dymo?.label?.framework) {
      const loaded = await loadDymoSdk();
      if (!loaded) return false;
    }

    const labelXml = createLabelXml(label);
    console.log('[DYMO] Printing to', printerName, ':', label.productName, label.price);
    
    // Open the label and print
    const labelObj = window.dymo.label.framework.openLabelXml(labelXml);
    labelObj.print(printerName);
    
    return true;
  } catch (error) {
    console.error('[DYMO] Print failed:', error);
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
    
    // Small delay between prints
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
