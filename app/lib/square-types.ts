
export interface SquareProductData {
  id: string;
  squareId: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  price?: number;
  currency: string;
  isActive: boolean;
  squareCreatedAt?: Date;
  squareUpdatedAt?: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SquareInventoryData {
  id: string;
  squareProductId: string;
  locationId: string;
  quantity: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductLinkData {
  id: string;
  invoiceProductName: string;
  squareProductId: string;
  confidence: number;
  isManualLink: boolean;
  linkedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventData {
  id: string;
  eventType: string;
  squareEventId: string;
  data: any;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncLogData {
  id: string;
  syncType: string;
  status: string;
  itemsProcessed: number;
  itemsSuccess: number;
  itemsFailed: number;
  errorMessage?: string;
  details?: any;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMatchResult {
  product: any;
  confidence: number;
}

export interface InventoryUpdateRequest {
  squareProductId: string;
  quantity: number;
  locationId?: string;
}

export interface ProductLinkRequest {
  invoiceProductName: string;
  squareProductId: string;
  isManualLink: boolean;
  linkedBy?: string;
}

export interface SyncResult {
  success: number;
  failed: number;
  total: number;
}

export interface DailySyncResult {
  products: SyncResult;
  inventory: SyncResult;
}

export interface AutoLinkResult {
  linked: number;
  created: number;
}
