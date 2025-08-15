
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestInvoice() {
  try {
    console.log('Creating test invoice...')
    
    // Create a vendor first
    const vendor = await prisma.vendor.upsert({
      where: { name: 'Test Organic Supplier' },
      update: {},
      create: {
        name: 'Test Organic Supplier'
      }
    })

    // Create an invoice
    const invoice = await prisma.invoice.create({
      data: {
        vendorId: vendor.id,
        totalAmount: 150.00,
        filename: 'test-invoice.pdf',
        processedAt: new Date()
      }
    })

    // Create line items without Square product links
    const lineItems = [
      {
        invoiceId: invoice.id,
        productName: 'Organic Bananas',
        quantity: 5,
        unitPrice: 3.50,
        totalPrice: 17.50,
        needsClarification: false,
        gstApplicable: true
      },
      {
        invoiceId: invoice.id,
        productName: 'Almond Milk 1L',
        quantity: 12,
        unitPrice: 4.25,
        totalPrice: 51.00,
        needsClarification: false,
        gstApplicable: true
      },
      {
        invoiceId: invoice.id,
        productName: 'Organic Quinoa 500g',
        quantity: 8,
        unitPrice: 6.75,
        totalPrice: 54.00,
        needsClarification: false,
        gstApplicable: true
      },
      {
        invoiceId: invoice.id,
        productName: 'Coconut Oil 400ml',
        quantity: 6,
        unitPrice: 8.90,
        totalPrice: 53.40,
        needsClarification: false,
        gstApplicable: true
      }
    ]

    for (const item of lineItems) {
      await prisma.lineItem.create({
        data: item
      })
    }

    console.log('✓ Test invoice created successfully!')
    console.log(`Invoice ID: ${invoice.id}`)
    console.log(`Vendor: ${vendor.name}`)
    console.log(`Line items: ${lineItems.length}`)
    
  } catch (error) {
    console.error('Error creating test invoice:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestInvoice()
