import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { squareAPI } from '@/lib/square-api'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productName = searchParams.get('productName')

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    // Get Square products for matching
    const squareProducts = await db.squareProduct.findMany({
      where: {
        isActive: true
      }
    })

    // Calculate similarity scores
    const suggestions = []
    
    for (const product of squareProducts) {
      const confidence = calculateSimilarity(productName, product.name)
      
      if (confidence > 0.3) { // Only include reasonable matches
        suggestions.push({
          squareProduct: {
            id: product.id,
            name: product.name,
            description: product.description,
            sku: product.sku,
            price: product.price,
            category: product.category,
            isActive: product.isActive
          },
          confidence,
          isExactMatch: confidence >= 0.95
        })
      }
    }

    // Sort by confidence score (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence)

    // Return top 10 suggestions
    return NextResponse.json({ 
      suggestions: suggestions.slice(0, 10)
    })
  } catch (error) {
    console.error('Error getting product suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to get product suggestions' },
      { status: 500 }
    )
  }
}

// Helper function to calculate string similarity
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1.0
  
  // Exact substring match gets high score
  if (s1.includes(s2) || s2.includes(s1)) return 0.9
  
  // Word-based matching
  const words1 = s1.split(/\s+/)
  const words2 = s2.split(/\s+/)
  
  let matchingWords = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1) || word1 === word2) {
        matchingWords++
        break
      }
    }
  }
  
  const wordScore = matchingWords / Math.max(words1.length, words2.length)
  
  // Character-based similarity (simplified Levenshtein)
  const maxLength = Math.max(s1.length, s2.length)
  const minLength = Math.min(s1.length, s2.length)
  const lengthScore = minLength / maxLength
  
  // Combined score
  return Math.max(wordScore * 0.7 + lengthScore * 0.3, 0)
}
