import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const GenerateSuggestionsSchema = z.object({
  vendorId: z.string().optional(),
  analysisWindow: z.number().int().min(7).max(90).default(30), // Days to analyze
  forecastDays: z.number().int().min(7).max(60).default(14), // Days to forecast
})

interface SalesData {
  itemName: string
  totalQuantity: number
  avgDailyQuantity: number
  category: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, analysisWindow, forecastDays } = GenerateSuggestionsSchema.parse(body)
    
    const analysisStartDate = new Date()
    analysisStartDate.setDate(analysisStartDate.getDate() - analysisWindow)
    
    // Build vendor filter
    const vendorFilter = vendorId ? { vendorId } : {}
    
    // Get all items with inventory tracking for the vendor(s)
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        item: vendorFilter
      },
      include: {
        item: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                orderSettings: true,
              }
            }
          }
        }
      }
    })

    if (inventoryItems.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: vendorId 
          ? 'No inventory items found for this vendor'
          : 'No inventory items found'
      })
    }

    // Get sales data for analysis period
    const salesData = await prisma.salesAggregate.findMany({
      where: {
        date: {
          gte: analysisStartDate
        },
        itemName: {
          in: inventoryItems.map(inv => inv.item.name)
        }
      }
    })

    // Process sales data by item
    const salesByItem: Record<string, SalesData> = {}
    
    salesData.forEach(sale => {
      if (!sale.itemName) return
      
      if (!salesByItem[sale.itemName]) {
        salesByItem[sale.itemName] = {
          itemName: sale.itemName,
          totalQuantity: 0,
          avgDailyQuantity: 0,
          category: sale.category || 'Unknown'
        }
      }
      
      salesByItem[sale.itemName].totalQuantity += sale.quantity.toNumber()
    })

    // Calculate average daily quantities
    Object.values(salesByItem).forEach(item => {
      item.avgDailyQuantity = item.totalQuantity / analysisWindow
    })

    // Generate suggestions for each inventory item
    const suggestions = []
    
    for (const inventoryItem of inventoryItems) {
      const itemName = inventoryItem.item.name
      const vendorOrderSettings = inventoryItem.item.vendor?.orderSettings
      const salesData = salesByItem[itemName]
      
      // Calculate suggested quantity
      let suggestedQuantity = 0
      const reasoning: any = {
        currentStock: inventoryItem.currentStock.toNumber(),
        minimumStock: inventoryItem.minimumStock?.toNumber() || null,
        reorderPoint: inventoryItem.reorderPoint?.toNumber() || null,
        salesData: salesData || null,
        analysisWindow,
        forecastDays,
      }

      let priority = 'low'
      let daysOfStock: number | null = null
      
      if (salesData && salesData.avgDailyQuantity > 0) {
        // Calculate days of stock remaining
        daysOfStock = inventoryItem.currentStock.toNumber() / salesData.avgDailyQuantity
        reasoning.daysOfStock = daysOfStock
        reasoning.salesVelocity = salesData.avgDailyQuantity
        
        // Forecast demand for the forecast period
        const forecastDemand = salesData.avgDailyQuantity * forecastDays
        reasoning.forecastDemand = forecastDemand
        
        // Calculate suggested order quantity
        const stockAfterForecast = inventoryItem.currentStock.toNumber() - forecastDemand
        reasoning.stockAfterForecast = stockAfterForecast
        
        // Determine if we need to order
        const reorderPoint = inventoryItem.reorderPoint?.toNumber() || (inventoryItem.minimumStock?.toNumber() || 0)
        
        if (stockAfterForecast <= reorderPoint) {
          const targetStock = inventoryItem.maximumStock?.toNumber() || (reorderPoint * 2)
          suggestedQuantity = Math.max(0, targetStock - inventoryItem.currentStock.toNumber())
          
          // Apply minimum order quantity if set
          if (inventoryItem.minimumOrderQuantity && suggestedQuantity > 0) {
            const minOrderQty = inventoryItem.minimumOrderQuantity.toNumber()
            if (suggestedQuantity < minOrderQty) {
              suggestedQuantity = minOrderQty
            }
          }
          
          // Set priority based on urgency
          if (daysOfStock <= 3) {
            priority = 'high'
          } else if (daysOfStock <= 7) {
            priority = 'medium'
          }
        }
      } else {
        // No sales data - check if below reorder point
        const currentStock = inventoryItem.currentStock.toNumber()
        const reorderPoint = inventoryItem.reorderPoint?.toNumber() || (inventoryItem.minimumStock?.toNumber() || 0)
        
        if (currentStock <= reorderPoint) {
          const targetStock = inventoryItem.maximumStock?.toNumber() || Math.max(reorderPoint * 2, 10)
          suggestedQuantity = targetStock - currentStock
          
          if (inventoryItem.minimumOrderQuantity && suggestedQuantity > 0) {
            const minOrderQty = inventoryItem.minimumOrderQuantity.toNumber()
            if (suggestedQuantity < minOrderQty) {
              suggestedQuantity = minOrderQty
            }
          }
          
          priority = currentStock === 0 ? 'high' : 'medium'
        }
        
        reasoning.noSalesData = true
      }

      // Only create suggestions for items that need ordering
      if (suggestedQuantity > 0) {
        // Check if suggestion already exists and is recent
        const existingSuggestion = await prisma.orderSuggestion.findUnique({
          where: {
            vendorId_inventoryItemId: {
              vendorId: inventoryItem.item.vendorId!,
              inventoryItemId: inventoryItem.id,
            }
          }
        })

        // Update or create suggestion
        const suggestion = await prisma.orderSuggestion.upsert({
          where: {
            vendorId_inventoryItemId: {
              vendorId: inventoryItem.item.vendorId!,
              inventoryItemId: inventoryItem.id,
            }
          },
          create: {
            vendorId: inventoryItem.item.vendorId!,
            inventoryItemId: inventoryItem.id,
            suggestedQuantity: new Decimal(suggestedQuantity),
            reasoning,
            priority,
            periodAnalyzed: `last_${analysisWindow}_days`,
            salesVelocity: salesData ? new Decimal(salesData.avgDailyQuantity) : null,
            daysOfStock: daysOfStock ? new Decimal(daysOfStock) : null,
          },
          update: {
            suggestedQuantity: new Decimal(suggestedQuantity),
            reasoning,
            priority,
            periodAnalyzed: `last_${analysisWindow}_days`,
            salesVelocity: salesData ? new Decimal(salesData.avgDailyQuantity) : null,
            daysOfStock: daysOfStock ? new Decimal(daysOfStock) : null,
            updatedAt: new Date(),
          },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
              }
            },
            inventoryItem: {
              include: {
                item: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    currentCostExGst: true,
                  }
                }
              }
            }
          }
        })

        suggestions.push(suggestion)
      }
    }

    // Group suggestions by vendor
    const suggestionsByVendor = suggestions.reduce((acc: any, suggestion) => {
      const vendorId = suggestion.vendorId
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendor: suggestion.vendor,
          suggestions: [],
          totalItems: 0,
          totalValue: 0,
        }
      }
      
      acc[vendorId].suggestions.push(suggestion)
      acc[vendorId].totalItems += 1
      acc[vendorId].totalValue += suggestion.suggestedQuantity.toNumber() * 
        suggestion.inventoryItem.item.currentCostExGst.toNumber()
      
      return acc
    }, {})

    return NextResponse.json({
      suggestionsByVendor,
      totalSuggestions: suggestions.length,
      analysisWindow,
      forecastDays,
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating order suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate order suggestions' },
      { status: 500 }
    )
  }
}