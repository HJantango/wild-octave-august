import { OCRAdapter, OCRResult, OCRPageResult, AzureConfig } from './types';

export class AzureAdapter extends OCRAdapter {
  private config: AzureConfig;

  constructor(config: AzureConfig) {
    super();
    this.config = {
      version: '2023-02-01-preview',
      ...config,
    };
  }

  getName(): string {
    return 'azure';
  }

  isConfigured(): boolean {
    return !!(this.config.endpoint && this.config.apiKey);
  }

  async processDocument(buffer: Buffer): Promise<OCRResult> {
    if (!this.isConfigured()) {
      throw new Error('Azure OCR is not properly configured. Missing endpoint or API key.');
    }

    try {
      // Submit document for analysis
      const operationLocation = await this.submitDocument(buffer);
      
      // Poll for results
      const result = await this.pollForResults(operationLocation);
      
      return this.parseAzureResponse(result);

    } catch (error) {
      throw new Error(`Azure OCR processing failed: ${error}`);
    }
  }

  private async submitDocument(buffer: Buffer): Promise<string> {
    const url = `${this.config.endpoint}/formrecognizer/v${this.config.version}/layout/analyze`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.apiKey,
        'Content-Type': 'application/pdf',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OCR submission failed: ${response.status} ${errorText}`);
    }

    const operationLocation = response.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No operation location returned from Azure OCR');
    }

    return operationLocation;
  }

  private async pollForResults(operationLocation: string): Promise<any> {
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Azure OCR polling failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'succeeded') {
        return result.analyzeResult;
      } else if (result.status === 'failed') {
        throw new Error(`Azure OCR analysis failed: ${result.error?.message}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Azure OCR polling timeout');
  }

  private parseAzureResponse(analyzeResult: any): OCRResult {
    const pages: OCRPageResult[] = [];
    let totalText = '';
    let totalConfidence = 0;

    for (const page of analyzeResult.pages || []) {
      const lines = page.lines?.map((line: any) => ({
        text: line.content,
        confidence: line.confidence || 0.5,
        boundingBox: line.boundingBox ? {
          x: Math.min(...line.boundingBox.filter((_: any, i: number) => i % 2 === 0)),
          y: Math.min(...line.boundingBox.filter((_: any, i: number) => i % 2 === 1)),
          width: Math.max(...line.boundingBox.filter((_: any, i: number) => i % 2 === 0)) - 
                 Math.min(...line.boundingBox.filter((_: any, i: number) => i % 2 === 0)),
          height: Math.max(...line.boundingBox.filter((_: any, i: number) => i % 2 === 1)) - 
                  Math.min(...line.boundingBox.filter((_: any, i: number) => i % 2 === 1)),
        } : undefined,
      })) || [];

      const pageText = lines.map((line: any) => line.text).join('\n');
      const pageConfidence = lines.reduce((sum: number, line: any) => sum + line.confidence, 0) / Math.max(lines.length, 1);

      const pageResult: OCRPageResult = {
        pageNumber: page.pageNumber,
        text: pageText,
        confidence: pageConfidence,
        lines,
      };

      pages.push(pageResult);
      totalText += pageText + '\n';
      totalConfidence += pageConfidence;
    }

    const averageConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;

    return {
      text: totalText.trim(),
      confidence: averageConfidence,
      pages,
    };
  }
}