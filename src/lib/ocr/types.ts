export interface OCRResult {
  text: string;
  confidence: number;
  pages: OCRPageResult[];
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  lines: OCRLineResult[];
}

export interface OCRLineResult {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRConfig {
  provider: 'tesseract' | 'azure';
  tesseract?: TesseractConfig;
  azure?: AzureConfig;
}

export interface TesseractConfig {
  language?: string;
  oem?: number;
  psm?: number;
}

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  version?: string;
}

export abstract class OCRAdapter {
  abstract processDocument(buffer: Buffer, config?: any): Promise<OCRResult>;
  abstract getName(): string;
  abstract isConfigured(): boolean;
}