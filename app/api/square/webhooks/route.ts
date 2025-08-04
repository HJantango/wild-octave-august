
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { squareAPI } from '@/lib/square-api';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const hash = hmac.digest('base64');
  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('X-Square-Signature');
    const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    
    if (!signature || !secret) {
      console.error('Missing signature or secret for webhook verification');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify webhook signature
    if (!verifySignature(body, signature, secret)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const event = JSON.parse(body);
    
    // Save webhook event to database
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        eventType: event.type,
        squareEventId: event.event_id,
        data: event.data,
        processed: false
      }
    });
    
    // Process the webhook event
    try {
      await processWebhookEvent(webhookEvent.id, event);
      
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error processing webhook event:', error);
      
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processWebhookEvent(webhookEventId: string, event: any) {
  const eventType = event.type;
  const eventData = event.data;
  
  console.log(`Processing webhook event: ${eventType}`);
  
  switch (eventType) {
    case 'inventory.count.updated':
      await handleInventoryUpdate(eventData);
      break;
      
    case 'catalog.version.updated':
      await handleCatalogUpdate(eventData);
      break;
      
    default:
      console.log(`Unhandled webhook event type: ${eventType}`);
  }
}

async function handleInventoryUpdate(eventData: any) {
  try {
    const { catalog_object_id, location_id, quantity } = eventData;
    
    // Find the Square product in our database
    const squareProduct = await prisma.squareProduct.findUnique({
      where: { squareId: catalog_object_id }
    });
    
    if (!squareProduct) {
      console.warn(`Square product not found for catalog object: ${catalog_object_id}`);
      return;
    }
    
    // Update inventory in our database
    await prisma.squareInventory.upsert({
      where: {
        squareProductId_locationId: {
          squareProductId: squareProduct.id,
          locationId: location_id
        }
      },
      update: {
        quantity: parseFloat(quantity),
        lastUpdated: new Date()
      },
      create: {
        squareProductId: squareProduct.id,
        locationId: location_id,
        quantity: parseFloat(quantity),
        lastUpdated: new Date()
      }
    });
    
    console.log(`Updated inventory for ${squareProduct.name}: ${quantity}`);
  } catch (error) {
    console.error('Error handling inventory update:', error);
    throw error;
  }
}

async function handleCatalogUpdate(eventData: any) {
  try {
    // Trigger a product sync to get the latest catalog changes
    console.log('Catalog updated, triggering product sync...');
    // We could trigger a sync here or just log for now
    // await squareSync.syncProducts();
  } catch (error) {
    console.error('Error handling catalog update:', error);
    throw error;
  }
}
