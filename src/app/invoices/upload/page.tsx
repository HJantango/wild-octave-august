'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { InvoiceProcessingLoader } from '@/components/ui/invoice-processing-loader';
import { useUploadInvoice, useProcessInvoice } from '@/hooks/useInvoices';

interface ProcessingStep {
  id: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  duration?: number;
}

export default function InvoiceUploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { 
      id: 'upload', 
      title: 'Upload File', 
      subtitle: 'Securely uploading invoice document',
      status: 'pending',
      duration: 2
    },
    { 
      id: 'ocr', 
      title: 'AI Vision Processing', 
      subtitle: 'Claude Vision AI analyzing document structure',
      status: 'pending',
      duration: 15
    },
    { 
      id: 'parse', 
      title: 'Extract Line Items & Brands', 
      subtitle: 'Intelligent product identification and categorization',
      status: 'pending',
      duration: 8
    },
    { 
      id: 'process', 
      title: 'Calculate Pricing', 
      subtitle: 'Applying markup and GST calculations',
      status: 'pending',
      duration: 3
    },
  ]);

  const uploadMutation = useUploadInvoice();
  const processMutation = useProcessInvoice();

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    // Reset all steps when new file selected
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined })));
    setUploadedInvoiceId(null);
    
    // Auto-process the invoice immediately after file selection
    setTimeout(() => {
      handleUpload(file);
    }, 100);
  };

  const handleUpload = async (fileToProcess?: File) => {
    const file = fileToProcess || selectedFile;
    if (!file) return;

    try {
      // Step 1: Upload
      updateStepStatus('upload', 'processing', 'Uploading file...');
      
      const uploadResult = await uploadMutation.mutateAsync(file);
      const invoiceId = uploadResult.data.id;
      setUploadedInvoiceId(invoiceId);
      
      updateStepStatus('upload', 'completed', 'File uploaded successfully');
      
      // Step 2-4: Process (LLM + Parse + Pricing)  
      updateStepStatus('ocr', 'processing', 'Analyzing invoice with Claude Vision AI...');
      
      const processResult = await processMutation.mutateAsync(invoiceId);
      
      updateStepStatus('ocr', 'completed', 'AI vision analysis complete');
      updateStepStatus('parse', 'completed', `Extracted ${processResult.data.lineItemsCount} line items with brands`);
      updateStepStatus('process', 'completed', `Processing complete - ${(processResult.data.confidence * 100).toFixed(0)}% confidence`);
      
      // Auto-redirect to review page after successful processing
      setTimeout(() => {
        router.push(`/invoices/${invoiceId}`);
      }, 2000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      // Mark the appropriate step as failed
      if (!uploadedInvoiceId) {
        updateStepStatus('upload', 'error', errorMessage);
      } else {
        updateStepStatus('ocr', 'error', errorMessage);
      }
    }
  };

  const isProcessing = steps.some(step => step.status === 'processing');
  const isCompleted = steps.every(step => step.status === 'completed');
  const hasError = steps.some(step => step.status === 'error');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Gradient style matching dashboard */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Upload Invoice</h1>
                <p className="text-blue-100 text-lg">
                  Process supplier invoices with AI-powered vision technology
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  Intelligent brand extraction • Automatic pricing calculations • 40+ invoice formats supported
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
                  <span className="text-sm font-medium">Supported Formats:</span>
                </div>
                <div className="text-right text-sm opacity-90">
                  PDF, PNG, JPG, JPEG • Max 50MB
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Select Invoice File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  maxSize={50}
                  disabled={isProcessing}
                />

                {selectedFile && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-900">Selected File:</div>
                    <div className="text-sm text-gray-600">{selectedFile.name}</div>
                    <div className="text-xs text-gray-500">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? 'Processing...' : 'Process Invoice'}
                  </Button>
                  
                  {uploadedInvoiceId && !isProcessing && (
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/invoices/${uploadedInvoiceId}`)}
                    >
                      View Results
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modern Processing Loader */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <InvoiceProcessingLoader steps={steps} />
            </CardContent>
          </Card>
        </div>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle>Tips for Better Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">✅ Best Practices</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 🎯 AI handles 40+ different invoice formats automatically</li>
                  <li>• 📸 Clear photos or scanned PDFs work great</li>
                  <li>• 🏷️ Automatically extracts product brands and variants</li>
                  <li>• 💰 Intelligent price calculation with pack size detection</li>
                  <li>• 🔄 Falls back to OCR if AI processing fails</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">⚠️ Important Notes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 🤖 <strong>AI First:</strong> Claude Vision analyzes invoices intelligently</li>
                  <li>• 📱 Works with phone photos and scanned documents</li>
                  <li>• ⚡ Processes most invoices in under 30 seconds</li>
                  <li>• 🔧 Manual review may be needed for unusual formats</li>
                  <li>• 🎨 Supports both typed and handwritten invoices</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}