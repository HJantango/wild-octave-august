
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productName = searchParams.get('productName');
    
    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    
    // Get all Square products for matching
    const squareProducts = await prisma.squareProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    
    // Find potential matches
    const suggestions = [];
    
    for (const squareProduct of squareProducts) {
      const confidence = squareAPI.calculateSimilarity(productName, squareProduct.name);
      
      if (confidence > 0.3) { // Only include reasonable matches
        suggestions.push({
          squareProduct,
          confidence,
          isExactMatch: confidence > 0.9
        });
      }
    }
    
    // Sort by confidence (best matches first)
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    // Take top 10 suggestions
    const topSuggestions = suggestions.slice(0, 10);
    
    return NextResponse.json({ suggestions: topSuggestions });
  } catch (error) {
    console.error('Error getting product suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get product suggestions' },
      { status: 500 }
    );
  }
}
