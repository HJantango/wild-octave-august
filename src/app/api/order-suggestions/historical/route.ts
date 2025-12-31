import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const HistoricalAnalysisSchema = z.object({
  vendorId: z.string().optional(),
  analysisMonths: z.number().int().min(1).max(24).default(6), // Months to analyze
  forecastWeeks: z.number().int().min(1).max(8).default(2), // Weeks to forecast
  minimumOrderFrequency: z.number().int().min(1).max(10).default(2), // Minimum times ordered to suggest
})

interface InvoicePattern {
  itemName: string
  category: string
  vendorName: string
  vendorId: string
  orderFrequency: number // times ordered in period
  avgQuantity: number
  avgUnitCost: number
  lastOrderDate: Date
  daysSinceLastOrder: number
  typicalOrderInterval: number // average days between orders
  nextSuggestedOrderDate: Date
  priority: 'high' | 'medium' | 'low'
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, analysisMonths, forecastWeeks, minimumOrderFrequency } = HistoricalAnalysisSchema.parse(body)
    
    const analysisStartDate = new Date()
    analysisStartDate.setMonth(analysisStartDate.getMonth() - analysisMonths)
    
    // Build vendor filter
    const vendorFilter = vendorId ? { vendorId } : {}
    
    console.log(`📊 HISTORICAL ANALYSIS: Looking back ${analysisMonths} months from ${analysisStartDate.toISOString()}`)
    
    // Get all invoices in the analysis period
    const invoices = await prisma.invoice.findMany({
      where: {
        ...vendorFilter,
        invoiceDate: {
          gte: analysisStartDate
        },
        status: {
          in: ['REVIEWED', 'POSTED'] // Only analyze completed invoices
        }
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          }
        },
        lineItems: {
          where: {
            // Exclude generic items that don't represent actual products
            name: {
              notIn: ['Delivery Fee', 'Service Charge', 'Discount', 'Credit']
            }
          }
        }
      },
      orderBy: { invoiceDate: 'desc' }
    })

    console.log(`📋 Found ${invoices.length} invoices in analysis period`)

    if (invoices.length === 0) {
      return NextResponse.json({
        patterns: [],
        suggestions: [],
        analysisWindow: analysisMonths,
        forecastWeeks,
        message: vendorId 
          ? 'No historical invoices found for this vendor in the analysis period'
          : 'No historical invoices found in the analysis period'
      })
    }

    // Analyze patterns by item across all invoices
    const itemPatterns = new Map<string, {
      itemName: string
      category: string
      vendorId: string
      vendorName: string
      orders: Array<{
        date: Date
        quantity: number
        unitCost: number
        invoiceId: string
      }>
    }>()

    // Process all invoice line items
    invoices.forEach(invoice => {
      invoice.lineItems.forEach(lineItem => {
        const itemKey = `${invoice.vendorId}_${lineItem.name.toLowerCase().trim()}`
        
        if (!itemPatterns.has(itemKey)) {
          itemPatterns.set(itemKey, {
            itemName: lineItem.name,
            category: lineItem.category,
            vendorId: invoice.vendorId,
            vendorName: invoice.vendor.name,
            orders: []
          })
        }

        const pattern = itemPatterns.get(itemKey)!
        pattern.orders.push({
          date: invoice.invoiceDate,
          quantity: lineItem.quantity.toNumber(),
          unitCost: lineItem.unitCostExGst.toNumber(),
          invoiceId: invoice.id
        })
      })
    })

    console.log(`🔍 Analyzed ${itemPatterns.size} unique items across all invoices`)

    // Generate suggestions based on patterns
    const suggestions: InvoicePattern[] = []
    const now = new Date()

    for (const [itemKey, pattern] of itemPatterns.entries()) {
      const { itemName, category, vendorId: patternVendorId, vendorName, orders } = pattern
      
      // Skip items ordered less than minimum frequency
      if (orders.length < minimumOrderFrequency) {
        continue
      }

      // Sort orders by date
      orders.sort((a, b) => a.date.getTime() - b.date.getTime())
      
      const lastOrder = orders[orders.length - 1]
      const firstOrder = orders[0]
      const daysSinceLastOrder = Math.floor((now.getTime() - lastOrder.date.getTime()) / (1000 * 60 * 60 * 24))
      
      // Calculate average quantities and costs
      const avgQuantity = orders.reduce((sum, order) => sum + order.quantity, 0) / orders.length
      const avgUnitCost = orders.reduce((sum, order) => sum + order.unitCost, 0) / orders.length
      
      // Calculate typical order interval (if more than one order)
      let typicalOrderInterval = 0
      if (orders.length > 1) {
        const intervals = []
        for (let i = 1; i < orders.length; i++) {
          const daysBetween = Math.floor((orders[i].date.getTime() - orders[i-1].date.getTime()) / (1000 * 60 * 60 * 24))
          intervals.push(daysBetween)
        }
        typicalOrderInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      } else {
        // If only one order, estimate based on analysis period
        const totalDays = Math.floor((now.getTime() - firstOrder.date.getTime()) / (1000 * 60 * 60 * 24))
        typicalOrderInterval = totalDays / orders.length
      }

      // Calculate next suggested order date
      const nextSuggestedOrderDate = new Date(lastOrder.date.getTime() + (typicalOrderInterval * 24 * 60 * 60 * 1000))
      
      // Determine priority based on how overdue the next order is
      let priority: 'high' | 'medium' | 'low' = 'low'
      const daysOverdue = Math.floor((now.getTime() - nextSuggestedOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysOverdue >= 7) {
        priority = 'high'
      } else if (daysOverdue >= 0) {
        priority = 'medium'
      }
      
      // Calculate confidence based on consistency of ordering
      const consistency = orders.length >= 3 ? 0.9 : orders.length >= 2 ? 0.7 : 0.5
      const recencyBonus = daysSinceLastOrder <= typicalOrderInterval * 1.5 ? 0.1 : 0
      const confidence = Math.min(0.99, consistency + recencyBonus)

      suggestions.push({
        itemName,
        category,
        vendorName,
        vendorId: patternVendorId,
        orderFrequency: orders.length,
        avgQuantity: Math.round(avgQuantity * 100) / 100,
        avgUnitCost: Math.round(avgUnitCost * 100) / 100,
        lastOrderDate: lastOrder.date,
        daysSinceLastOrder,
        typicalOrderInterval: Math.round(typicalOrderInterval),
        nextSuggestedOrderDate,
        priority,
        confidence: Math.round(confidence * 100) / 100
      })
    }

    // Sort suggestions by priority (high first) and then by days overdue
    suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      
      // Within same priority, sort by days since last order (most overdue first)
      return b.daysSinceLastOrder - a.daysSinceLastOrder
    })

    // Group suggestions by vendor
    const suggestionsByVendor = suggestions.reduce((acc, suggestion) => {
      const vendorId = suggestion.vendorId
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendor: {
            id: vendorId,
            name: suggestion.vendorName
          },
          suggestions: [],
          totalItems: 0,
          estimatedOrderValue: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0
        }
      }
      
      acc[vendorId].suggestions.push(suggestion)
      acc[vendorId].totalItems += 1
      acc[vendorId].estimatedOrderValue += suggestion.avgQuantity * suggestion.avgUnitCost
      
      if (suggestion.priority === 'high') acc[vendorId].highPriorityCount += 1
      else if (suggestion.priority === 'medium') acc[vendorId].mediumPriorityCount += 1
      else acc[vendorId].lowPriorityCount += 1
      
      return acc
    }, {} as any)

    console.log(`✨ Generated ${suggestions.length} suggestions across ${Object.keys(suggestionsByVendor).length} vendors`)

    return NextResponse.json({
      suggestionsByVendor,
      totalSuggestions: suggestions.length,
      analysisWindow: analysisMonths,
      forecastWeeks,
      analysisStats: {
        invoicesAnalyzed: invoices.length,
        uniqueItemsFound: itemPatterns.size,
        itemsQualifiedForSuggestion: suggestions.length,
        oldestInvoiceDate: invoices[invoices.length - 1]?.invoiceDate,
        newestInvoiceDate: invoices[0]?.invoiceDate
      }
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error analyzing historical invoices:', error)
    return NextResponse.json(
      { error: 'Failed to analyze historical invoices' },
      { status: 500 }
    )
  }
}