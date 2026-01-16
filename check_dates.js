const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
  // Check for invoices with 2026 dates
  const invoices2026 = await prisma.invoice.findMany({
    where: {
      invoiceDate: {
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31')
      }
    },
    include: {
      vendor: true
    },
    orderBy: {
      invoiceDate: 'asc'
    }
  });
  
  console.log('Invoices with 2026 dates:');
  console.log(JSON.stringify(invoices2026, null, 2));
  
  // Check for sales reports with 2026 dates
  const sales2026 = await prisma.salesReport.findMany({
    where: {
      OR: [
        {
          reportPeriodStart: {
            gte: new Date('2026-01-01')
          }
        },
        {
          reportPeriodEnd: {
            gte: new Date('2026-01-01')
          }
        }
      ]
    }
  });
  
  console.log('\nSales reports with 2026 dates:');
  console.log(JSON.stringify(sales2026, null, 2));
  
  // Check for scheduled orders with 2026 dates
  const scheduled2026 = await prisma.scheduledOrder.findMany({
    where: {
      scheduleDate: {
        gte: new Date('2026-01-01')
      }
    },
    include: {
      vendor: true
    }
  });
  
  console.log('\nScheduled orders with 2026 dates:');
  console.log(JSON.stringify(scheduled2026, null, 2));
  
  await prisma.$disconnect();
}

checkDates().catch(console.error);
