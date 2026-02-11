import { NextRequest, NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';

export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'No Square token' }, { status: 500 });
    }

    const client = new SquareClient({
      token: accessToken,
      environment: SquareEnvironment.Production,
    });

    // Use the Vendors API - search with status filter to get active vendors
    const response = await client.vendors.search({
      filter: {
        status: ['ACTIVE']  // Get all active vendors
      }
    });
    const vendors = response.result?.vendors || [];

    // Search for Heaps Good specifically
    const heapsMatch = vendors.filter(v => 
      v.name?.toLowerCase().includes('heap')
    );

    return NextResponse.json({
      totalVendors: vendors.length,
      heapsMatches: heapsMatch.map(v => ({ id: v.id, name: v.name, status: v.status })),
      allVendors: vendors.map(v => v.name).sort(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
