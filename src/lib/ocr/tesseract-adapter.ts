import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import { OCRAdapter, OCRResult, OCRPageResult, TesseractConfig } from './types';

export class TesseractAdapter extends OCRAdapter {
  private config: TesseractConfig;

  constructor(config: TesseractConfig = {}) {
    super();
    this.config = {
      language: 'eng',
      oem: 3,
      psm: 6,
      ...config,
    };
  }

  getName(): string {
    return 'tesseract';
  }

  isConfigured(): boolean {
    return true; // Tesseract doesn't require external API keys
  }

  async processDocument(buffer: Buffer): Promise<OCRResult> {
    try {
      console.log('OCR processDocument called with buffer size:', buffer.length);
      
      // Debug: Check the actual file signature
      const first4Bytes = Array.from(buffer.subarray(0, 4));
      const first4AsChars = first4Bytes.map(b => String.fromCharCode(b)).join('');
      const first4AsHex = first4Bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('First 4 bytes as array:', first4Bytes);
      console.log('First 4 bytes as chars:', first4AsChars);
      console.log('First 4 bytes as hex:', first4AsHex);
      
      // Check if the buffer is a PDF - check for "%PDF" in ASCII
      const isPdf = first4AsChars === '%PDF';
      console.log('File type detected - isPDF:', isPdf);

      if (isPdf) {
        console.log('Processing as PDF...');
        // Process PDF by converting to images
        return await this.processPdf(buffer);
      } else {
        // Validate that this is an image format
        const isImage = this.isImageBuffer(buffer);
        console.log('File type detected - isImage:', isImage);
        
        if (!isImage) {
          console.log('Unsupported file format detected');
          return {
            text: 'Unsupported file format. Please upload image files (PNG, JPG, GIF, etc.).',
            confidence: 0,
            pages: [{
              pageNumber: 1,
              text: 'Unsupported file format. Please upload image files (PNG, JPG, GIF, etc.).',
              confidence: 0,
              lines: []
            }]
          };
        }
        
        console.log('Processing as image...');
        return await this.processImage(buffer);
      }
    } catch (error) {
      console.error('OCR processDocument error:', error);
      throw new Error(`Tesseract OCR processing failed: ${error}`);
    }
  }

  private async processPdf(buffer: Buffer): Promise<OCRResult> {
    console.log('PDF processing requested with ImageMagick support');
    console.log('PDF buffer size:', buffer.length);
    
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Write PDF buffer to temporary file
      const tempPdfPath = path.join(process.cwd(), 'temp', `pdf_${Date.now()}.pdf`);
      fs.writeFileSync(tempPdfPath, buffer);
      console.log('PDF written to temp file:', tempPdfPath);
      
      // Convert PDF to images using pdf2pic with GraphicsMagick - optimized for OCR
      const convert = pdf2pic.fromPath(tempPdfPath, {
        density: 600,           // Higher DPI for better OCR
        saveFilename: "page",
        savePath: "./temp/",    
        format: "png",
        quality: 100,          // High quality
        width: 2480,           // A4 width at 600 DPI
        height: 3508           // A4 height at 600 DPI
      });

      console.log('Converting PDF to images...');
      
      // Get page count and convert all pages
      let pageCount = 1;
      try {
        const pdfContent = buffer.toString('latin1');
        const pageMatches = pdfContent.match(/\/Type\s*\/Page\s/g);
        pageCount = pageMatches ? pageMatches.length : 1;
        console.log(`PDF detected with ${pageCount} page(s)`);
      } catch (e) {
        console.log('Could not detect page count, defaulting to 1');
      }
      
      let allText = '';
      let totalConfidence = 0;
      let processedPages = 0;
      
      for (let page = 1; page <= pageCount; page++) {
        try {
          console.log(`Converting page ${page}/${pageCount}...`);
          const results = await convert(page);
          
          console.log(`Page ${page} conversion results:`, {
            exists: !!results,
            type: typeof results,
            keys: results ? Object.keys(results) : 'no results',
            hasBuffer: !!(results && results.buffer),
            bufferSize: results && results.buffer ? results.buffer.length : 'no buffer'
          });
          
          // Get image buffer for this page
          let imageBuffer: Buffer;
          
          if (results && results.buffer && results.buffer.length > 0) {
            imageBuffer = results.buffer;
            console.log(`Using buffer from pdf2pic result for page ${page}`);
          } else {
            // Try reading from the generated file
            const imagePath = path.join(process.cwd(), 'temp', `page.${page}.png`);
            console.log(`Attempting to read PNG from file: ${imagePath}`);
            
            try {
              imageBuffer = fs.readFileSync(imagePath);
              console.log(`Successfully read PNG from file for page ${page}, size:`, imageBuffer.length);
              
              // Clean up the generated image file
              fs.unlinkSync(imagePath);
            } catch (fileError) {
              console.error(`Failed to read generated PNG file for page ${page}:`, fileError);
              console.log(`Skipping page ${page} due to file read error`);
              continue;
            }
          }
          
          if (!imageBuffer || imageBuffer.length === 0) {
            console.log(`Page ${page} conversion failed - no image data available, skipping`);
            continue;
          }
          
          console.log(`Processing page ${page} with OCR...`);
          
          // Verify it's a valid PNG buffer
          const pngSignature = imageBuffer.subarray(0, 8);
          const isPng = pngSignature.toString('hex').toLowerCase().startsWith('89504e47');
          console.log(`Page ${page} is PNG:`, isPng);
          
          // Process this page with OCR
          const pageResult = await this.processImage(imageBuffer, page);
          
          // Accumulate text and confidence
          if (pageResult.text && pageResult.text.length > 0) {
            allText += (allText.length > 0 ? '\n\n--- PAGE BREAK ---\n\n' : '') + pageResult.text;
            totalConfidence += pageResult.confidence;
            processedPages++;
            console.log(`Page ${page} processed successfully, extracted ${pageResult.text.length} characters`);
          } else {
            console.log(`Page ${page} produced no text`);
          }
          
        } catch (pageError) {
          console.error(`Error processing page ${page}:`, pageError);
          console.log(`Skipping page ${page} due to processing error`);
          continue;
        }
      }
      
      // Clean up temp PDF file
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (e) {
        console.log('Could not clean up temp PDF file:', e);
      }
      
      if (processedPages === 0) {
        throw new Error('No pages could be processed successfully');
      }
      
      console.log(`Multi-page OCR completed: ${processedPages}/${pageCount} pages processed`);
      
      // Return combined result
      return {
        text: allText,
        confidence: totalConfidence / processedPages,
        pages: [{
          pageNumber: 1,
          text: allText,
          confidence: totalConfidence / processedPages,
          lines: []
        }]
      };
      
    } catch (error) {
      console.error('PDF processing error:', error);
      
      // If PDF processing fails, provide helpful guidance
      return {
        text: 'PDF_CONVERSION_REQUIRED',
        confidence: 0,
        pages: [{
          pageNumber: 1,
          text: `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please convert your PDF to a high-quality PNG or JPG image and upload that instead.`,
          confidence: 0,
          lines: []
        }]
      };
    }
  }

  private async processImage(buffer: Buffer, pageNumber: number = 1): Promise<OCRResult> {
    let worker;
    
    try {
      console.log('Creating Tesseract worker...');
      const startTime = Date.now();
      
      // Create worker with configuration for Node.js environment
      worker = await createWorker(this.config.language!, this.config.oem, {
        logger: m => console.log(m),
        tessedit_pageseg_mode: this.config.psm?.toString() || '6',
        preserve_interword_spaces: '1'
      });

      // Set only runtime parameters (not initialization-only parameters)
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()$@-/:&% \n\t',
      });

      console.log('Worker created, starting OCR recognition...');
      
      // Don't set parameters after initialization - they're already set
      const { data } = await worker.recognize(buffer);
      
      const endTime = Date.now();
      console.log('OCR processing completed in', endTime - startTime, 'ms');
      console.log('OCR confidence:', data.confidence);
      console.log('OCR text length:', data.text?.length || 0);
      console.log('OCR text preview (first 200 chars):', data.text?.substring(0, 200) || 'NO TEXT');
      
      // Check if we got valid OCR results
      if (data.confidence === 0 && (!data.text || data.text.trim().length === 0)) {
        console.log('OCR returned no results - likely PDF conversion issue');
        throw new Error('OCR processing failed - no text extracted from converted image');
      }

      const pageResult: OCRPageResult = {
        pageNumber,
        text: data.text,
        confidence: data.confidence,
        lines: data.lines?.map(line => ({
          text: line.text,
          confidence: line.confidence,
          boundingBox: line.bbox ? {
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0,
          } : undefined,
        })) || [],
      };

      return {
        text: data.text,
        confidence: data.confidence,
        pages: [pageResult],
      };

    } finally {
      if (worker) {
        console.log('Terminating Tesseract worker...');
        await worker.terminate();
      }
    }
  }

  private isImageBuffer(buffer: Buffer): boolean {
    // Check for common image file signatures
    const first8Bytes = Array.from(buffer.subarray(0, 8));
    const hexString = first8Bytes.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    
    console.log('Checking image signatures for hex:', hexString);
    
    // PNG: 89504E470D0A1A0A
    if (hexString.startsWith('89504e47')) {
      console.log('Detected as PNG');
      return true;
    }
    
    // JPEG: FFD8FF
    if (hexString.startsWith('ffd8ff')) {
      console.log('Detected as JPEG');
      return true;
    }
    
    // GIF: 474946
    if (hexString.startsWith('474946')) {
      console.log('Detected as GIF');
      return true;
    }
    
    // BMP: 424D
    if (hexString.startsWith('424d')) {
      console.log('Detected as BMP');
      return true;
    }
    
    // WEBP: 52494646 + WEBP
    if (hexString.startsWith('52494646')) {
      const webpCheck = Array.from(buffer.subarray(8, 12)).map(b => String.fromCharCode(b)).join('');
      if (webpCheck === 'WEBP') {
        console.log('Detected as WEBP');
        return true;
      }
    }
    
    console.log('No image format detected');
    return false;
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    // Simple PDF page count - look for /Count in PDF catalog
    const pdfContent = buffer.toString('latin1');
    const countMatch = pdfContent.match(/\/Count\s+(\d+)/);
    
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }

    // Fallback: count page objects
    const pageMatches = pdfContent.match(/\/Type\s*\/Page\s/g);
    return pageMatches ? pageMatches.length : 1;
  }
}