/**
 * Dymo 550 Turbo Label Printing Integration
 * Supports 25mm x 25mm labels with Item Name and Price (GST inclusive)
 */

// Dymo Connect Framework types
declare global {
  interface Window {
    dymo: {
      label: {
        framework: {
          init(): Promise<void>;
          checkEnvironment(): { isFrameworkInstalled: boolean; isWebServicePresent: boolean; };
          openLabelFile(labelXml: string): any;
          printLabel(printerName: string, printParamsXml: string, labelXml: string, labelSetXml: string): void;
          getPrinters(): any[];
        };
      };
    };
  }
}

export interface DymoLabelData {
  itemName: string;
  priceGST: number;
  currency?: string;
}

export class DymoPrintingService {
  private isInitialized = false;
  private readonly LABEL_SIZE = '25mm x 25mm';
  private readonly PRINTER_MODEL = 'DYMO LabelWriter 550 Turbo';

  // 25mm x 25mm label template optimized for product labels
  private readonly LABEL_TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>25mm x 25mm</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="1134" Height="1134" Rx="90" Ry="90" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>ITEM_NAME</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>Item Name</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="True" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="57" Y="57" Width="1020" Height="400" />
  </ObjectInfo>
  <ObjectInfo>
    <TextObject>
      <Name>ITEM_PRICE</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Bottom</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>$0.00</String>
          <Attributes>
            <Font Family="Arial" Size="12" Bold="True" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="57" Y="500" Width="1020" Height="577" />
  </ObjectInfo>
</DieCutLabel>`;

  async initialize(): Promise<boolean> {
    try {
      // Check if Dymo Connect is available
      if (!window.dymo?.label?.framework) {
        throw new Error('Dymo Connect Framework not found. Please install Dymo Connect software.');
      }

      // Initialize the framework
      await window.dymo.label.framework.init();
      
      // Check environment
      const env = window.dymo.label.framework.checkEnvironment();
      if (!env.isFrameworkInstalled) {
        throw new Error('Dymo Connect Framework is not installed.');
      }
      if (!env.isWebServicePresent) {
        throw new Error('Dymo Connect Web Service is not running.');
      }

      this.isInitialized = true;
      console.log('🏷️ Dymo printing service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Dymo printing:', error);
      return false;
    }
  }

  getAvailablePrinters(): string[] {
    if (!this.isInitialized) {
      console.warn('Dymo service not initialized');
      return [];
    }

    try {
      const printers = window.dymo.label.framework.getPrinters();
      const dymoprinters = printers.filter(p => 
        p.name.toLowerCase().includes('dymo') || 
        p.name.toLowerCase().includes('labelwriter')
      );
      
      console.log('🖨️ Found Dymo printers:', dymoprinters.map(p => p.name));
      return dymoprinters.map(p => p.name);
    } catch (error) {
      console.error('❌ Failed to get printers:', error);
      return [];
    }
  }

  findDymo550Printer(): string | null {
    const printers = this.getAvailablePrinters();
    
    // Look for Dymo 550 Turbo specifically
    const turbo550 = printers.find(p => 
      p.toLowerCase().includes('550') && 
      p.toLowerCase().includes('turbo')
    );
    
    if (turbo550) return turbo550;
    
    // Fallback to any Dymo 550
    const dymo550 = printers.find(p => p.toLowerCase().includes('550'));
    if (dymo550) return dymo550;
    
    // Fallback to first available Dymo printer
    return printers[0] || null;
  }

  async printLabel(labelData: DymoLabelData, printerName?: string): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('❌ Dymo service not initialized. Call initialize() first.');
      return false;
    }

    try {
      // Find printer
      const printer = printerName || this.findDymo550Printer();
      if (!printer) {
        throw new Error('No Dymo printer found. Please ensure your Dymo 550 Turbo is connected.');
      }

      // Format price with currency
      const currency = labelData.currency || '$';
      const formattedPrice = `${currency}${labelData.priceGST.toFixed(2)}`;
      
      // Truncate item name to fit 25mm label
      const truncatedName = labelData.itemName.length > 20 
        ? labelData.itemName.substring(0, 17) + '...'
        : labelData.itemName;

      // Create label data XML
      const labelSetXml = `<?xml version="1.0" encoding="utf-8"?>
<LabelSet Version="8.0" Units="twips">
  <LabelRecord>
    <Variable>
      <Name>ITEM_NAME</Name>
      <Value><![CDATA[${truncatedName}]]></Value>
    </Variable>
    <Variable>
      <Name>ITEM_PRICE</Name>
      <Value><![CDATA[${formattedPrice}]]></Value>
    </Variable>
  </LabelRecord>
</LabelSet>`;

      // Print parameters for Dymo 550 Turbo
      const printParamsXml = `<?xml version="1.0" encoding="utf-8"?>
<PrintParams Version="8.0" Units="twips">
  <PrintQuality>Text</PrintQuality>
  <MediaTracking>Web</MediaTracking>
  <PrintSpeed>Auto</PrintSpeed>
  <PrintDensity>Normal</PrintDensity>
  <PrintDirection>Auto</PrintDirection>
  <FlowDirection>LeftToRight</FlowDirection>
  <Alignment>Center</Alignment>
  <Copies>1</Copies>
  <TwinTurboRoll>Auto</TwinTurboRoll>
  <Collate>False</Collate>
  <PageCut>ChainMarks</PageCut>
  <CutReceipt>True</CutReceipt>
  <Waste>Default</Waste>
</PrintParams>`;

      // Print the label
      window.dymo.label.framework.printLabel(
        printer,
        printParamsXml,
        this.LABEL_TEMPLATE,
        labelSetXml
      );

      console.log(`🏷️ Printed label for "${truncatedName}" at ${formattedPrice} to ${printer}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to print label:', error);
      throw error;
    }
  }

  async printMultipleLabels(labels: DymoLabelData[], printerName?: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    
    for (let i = 0; i < labels.length; i++) {
      try {
        await this.printLabel(labels[i], printerName);
        result.success++;
        
        // Small delay between prints to avoid overwhelming the printer
        if (i < labels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`${labels[i].itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🏷️ Bulk print complete: ${result.success} success, ${result.failed} failed`);
    return result;
  }

  // Format item data for label printing
  formatItemForLabel(item: { name: string; sellIncGst?: number; sellExGst?: number; }): DymoLabelData {
    return {
      itemName: item.name,
      priceGST: item.sellIncGst || (item.sellExGst || 0) * 1.1, // Add 10% GST if only ex-GST price available
      currency: '$'
    };
  }
}

// Global instance
export const dymoService = new DymoPrintingService();