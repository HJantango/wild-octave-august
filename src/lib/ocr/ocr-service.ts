import { OCRAdapter, OCRResult, OCRConfig } from './types';
import { TesseractAdapter } from './tesseract-adapter';
import { AzureAdapter } from './azure-adapter';

export class OCRService {
  private adapter: OCRAdapter;

  constructor(config?: OCRConfig) {
    const provider = config?.provider || process.env.OCR_PROVIDER || 'tesseract';
    
    switch (provider) {
      case 'azure':
        if (!config?.azure?.endpoint || !config?.azure?.apiKey) {
          const endpoint = process.env.AZURE_OCR_ENDPOINT;
          const apiKey = process.env.AZURE_OCR_KEY;
          
          if (!endpoint || !apiKey) {
            console.warn('Azure OCR credentials not found, falling back to Tesseract');
            this.adapter = new TesseractAdapter(config?.tesseract);
            break;
          }
          
          this.adapter = new AzureAdapter({
            endpoint,
            apiKey,
            ...config?.azure,
          });
        } else {
          this.adapter = new AzureAdapter(config.azure);
        }
        break;
        
      case 'tesseract':
      default:
        this.adapter = new TesseractAdapter(config?.tesseract);
        break;
    }

    if (!this.adapter.isConfigured()) {
      throw new Error(`OCR adapter ${this.adapter.getName()} is not properly configured`);
    }
  }

  async processDocument(buffer: Buffer): Promise<OCRResult> {
    console.log(`Processing document with ${this.adapter.getName()} OCR adapter`);
    
    const startTime = Date.now();
    const result = await this.adapter.processDocument(buffer);
    const processingTime = Date.now() - startTime;

    console.log(`OCR processing completed in ${processingTime}ms with confidence: ${result.confidence.toFixed(2)}%`);
    
    return result;
  }

  getAdapterName(): string {
    return this.adapter.getName();
  }

  isConfigured(): boolean {
    return this.adapter.isConfigured();
  }
}

// Singleton instance for server-side usage
let ocrServiceInstance: OCRService | null = null;

export function getOCRService(): OCRService {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService();
  }
  return ocrServiceInstance;
}