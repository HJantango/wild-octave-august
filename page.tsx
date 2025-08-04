
import InvoiceUploader from '@/components/invoice-uploader'
import { Suspense } from 'react'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-gray-900">
          Wild Octave Organics Invoice Processing
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload PDF invoices to automatically extract vendor information, line items, and apply category-specific markups for your organic food business.
        </p>

      </div>
      
      <Suspense fallback={<div>Loading...</div>}>
        <InvoiceUploader />
      </Suspense>
    </div>
  )
}
