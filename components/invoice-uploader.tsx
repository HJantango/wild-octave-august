
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import InvoiceDashboard from './invoice-dashboard'

interface ProcessedInvoice {
  vendor_name: string
  line_items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
    needs_clarification: boolean
    clarification_note?: string
  }>
}

export default function InvoiceUploader() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedInvoice, setProcessedInvoice] = useState<ProcessedInvoice | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>('')

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    setIsProcessing(true)
    setProcessingStatus('Uploading file...')
    setProcessedInvoice(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/process-invoice', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process invoice')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsProcessing(false)
              return
            }

            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'progress') {
                setProcessingStatus(parsed.content)
              } else if (parsed.type === 'complete') {
                setProcessedInvoice(parsed.data)
                setProcessingStatus('Complete!')
                toast.success('Invoice processed successfully!')
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing invoice:', error)
      toast.error('Failed to process invoice. Please try again.')
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  })

  const handleReset = () => {
    setProcessedInvoice(null)
    setProcessingStatus('')
  }

  if (processedInvoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-xl font-semibold text-gray-900">
              Invoice Processed Successfully
            </h3>
          </div>
          <Button onClick={handleReset} variant="outline">
            Process Another Invoice
          </Button>
        </div>
        <InvoiceDashboard invoiceData={processedInvoice} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
            isDragActive
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-green-500 mx-auto animate-spin" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Processing Invoice...
                </h3>
                <p className="text-sm text-gray-600">{processingStatus}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isDragActive ? (
                <Upload className="w-12 h-12 text-green-500 mx-auto" />
              ) : (
                <FileText className="w-12 h-12 text-gray-400 mx-auto" />
              )}
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isDragActive ? 'Drop the PDF file here' : 'Upload Invoice PDF'}
                </h3>
                <p className="text-sm text-gray-600">
                  Drag and drop a PDF invoice or click to browse files
                </p>
              </div>
              
              <div className="pt-4">
                <Button>
                  Select PDF File
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
