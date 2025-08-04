
import { prisma } from '@/lib/db'
import InvoiceDashboard from '@/components/invoice-dashboard'

export default async function TestDashboardPage() {
  // Get the test invoice we created
  const invoice = await prisma.invoice.findFirst({
    where: { 
      vendor: { 
        name: 'Test Organic Supplier' 
      }
    },
    include: {
      vendor: true,
      lineItems: {
        include: {
          category: true,
          squareProduct: {
            include: {
              inventoryRecords: true
            }
          }
        }
      }
    }
  })

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Test Invoice Found</h1>
          <p className="text-gray-600">Please run the create-test-invoice script first.</p>
        </div>
      </div>
    )
  }

  // Transform the data to match the expected format
  const invoiceData = {
    vendor_name: invoice.vendor.name,
    line_items: invoice.lineItems.map((item: any) => ({
      id: item.id,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      manual_unit_price: item.manualUnitPrice || undefined,
      total_price: item.totalPrice,
      needs_clarification: item.needsClarification,
      clarification_note: item.clarificationNote || undefined,
      gst_applicable: item.gstApplicable,
      category: item.category ? {
        id: item.category.id,
        name: item.category.name,
        markup: item.category.markup
      } : undefined,
      custom_markup: item.customMarkup || undefined,
      finalPrice: item.finalPrice || undefined,
      gstAmount: item.gstAmount || undefined,
      finalPriceIncGst: item.finalPriceIncGst || undefined,
      squareProductId: item.squareProductId || undefined,
      stockReceived: item.stockReceived,
      stockReceivedAt: item.stockReceivedAt || undefined,
      squareProduct: item.squareProduct ? {
        id: item.squareProduct.id,
        name: item.squareProduct.name,
        squareId: item.squareProduct.squareId,
        inventoryRecords: item.squareProduct.inventoryRecords
      } : undefined
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img src="/wild-octave-new-logo.png" alt="Wild Octave Organics" className="w-8 h-8 object-contain" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Wild Octave Organics</h1>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex items-center space-x-4">
                <a href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Invoice Upload</a>
                <a href="/square" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Square Integration</a>
                <a href="/test-dashboard" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">Test Dashboard</a>
              </nav>
              <div className="text-sm text-gray-600">Test Invoice Dashboard</div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Invoice Dashboard</h2>
          <p className="text-gray-600">This is a test page to demonstrate the enhanced product linking functionality.</p>
        </div>
        
        <InvoiceDashboard invoiceData={invoiceData} />
      </main>
    </div>
  )
}
