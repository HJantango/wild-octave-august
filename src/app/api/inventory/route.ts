import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/api-utils'
import { z } from 'zod'

const InventoryQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  search: z.string().optional(),
  vendorId: z.string().optional(),
  category: z.string().optional(),
  lowStock: z.string().optional().transform(val => val === 'true'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = InventoryQuerySchema.parse(Object.fromEntries(searchParams))
    
    const { page, limit, search, vendorId, category, lowStock } = query
    const skip = (page - 1) * limit

    const where: any = {}
    
    if (search || vendorId || category) {
      where.item = {}
      
      if (search) {
        where.item.name = {
          contains: search,
          mode: 'insensitive'
        }
      }
      
      if (vendorId) {
        where.item.vendorId = vendorId
      }
      
      if (category) {
        where.item.category = category
      }
    }

    // Note: Low stock filtering will be applied post-query for now
    // since Prisma doesn't support field-to-field comparisons in where clauses

    let [items, totalCount] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip: lowStock ? 0 : skip, // Skip pagination if low stock filtering needed
        take: lowStock ? undefined : limit, // Take all if low stock filtering needed
        include: {
          item: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          stockMovements: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { item: { name: 'asc' } }
      }),
      prisma.inventoryItem.count({ where })
    ])

    // Apply low stock filtering post-query
    if (lowStock) {
      items = items.filter(item => {
        const current = item.currentStock.toNumber()
        const minimum = item.minimumStock?.toNumber()
        const reorder = item.reorderPoint?.toNumber()
        
        return (minimum !== null && current <= minimum) || 
               (reorder !== null && current <= reorder)
      })
      
      // Apply pagination after filtering
      totalCount = items.length
      items = items.slice(skip, skip + limit)
    }

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}