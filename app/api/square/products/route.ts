import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSquareAPI } from '@/lib/square-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInventory = searchParams.get('includeInventory') === 'true';
    const includeSquareData = searchParams.get('includeSquareData') === 'true';

    // Get products from database
    const products = await db.product.findMany({
      include: {
        inventoryRecords: includeInventory,
        category: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    let result = products;

    // If Square data is requested, fetch it
    if (includeSquareData) {
      try {
        const squareAPI = getSquareAPI();
        const squareProducts = await squareAPI.getProducts();
        
        // Merge Square data with database products
        result = products.map(product => {
          const squareProduct = squareProducts.find(sp => sp.id === product.squareId);
          return {
            ...product,
            squareData: squareProduct || null
          };
        });
      } catch (squareError) {
        console.warn('Could not fetch Square data:', squareError);
        // Continue without Square data
      }
    }

    return NextResponse.json({
      success: true,
      products: result,
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();

    const {
      name,
      description,
      price,
      stockQuantity,
      categoryId,
      squareId,
      sku,
      barcode
    } = productData;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: 'Name and price are required' },
        { status: 400 }
      );
    }

    // Create the product
    const product = await db.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stockQuantity: parseInt(stockQuantity) || 0,
        categoryId: categoryId || null,
        squareId,
        sku,
        barcode
      },
      include: {
        category: true,
        inventoryRecords: true
      }
    });

    return NextResponse.json({
      success: true,
      product
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
