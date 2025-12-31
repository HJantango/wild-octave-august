import { z } from 'zod';

// Common validation schemas
export const idSchema = z.string().min(1, 'ID is required');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(10000).default(20), // Increased for item search modal
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Vendor schemas
export const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contactInfo: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  paymentTerms: z.string().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

// Item schemas
export const createItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  vendorId: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  displayOrder: z.coerce.number().int().default(0),
  currentCostExGst: z.coerce.number().positive('Cost must be positive'),
  currentMarkup: z.coerce.number().positive('Markup must be positive'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

export const updateItemSchema = createItemSchema.partial();

// Bulk item operations
export const bulkUpdatePositionsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    displayOrder: z.coerce.number().int(),
  })),
});

export const bulkCategorizeSchema = z.object({
  itemIds: z.array(z.string().min(1)),
  category: z.string().min(1).optional(),
  subcategory: z.string().optional(),
});

// Print sheet schema
export const printSheetSchema = z.object({
  vendorId: z.string().optional(),
  category: z.string().optional(),
  includeStock: z.coerce.boolean().default(true),
  includeSalesData: z.coerce.boolean().default(false),
});

// Invoice schemas
export const createInvoiceSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  invoiceDate: z.coerce.date(),
  lineItems: z.array(z.object({
    name: z.string().min(1, 'Item name is required'),
    quantity: z.coerce.number().positive('Quantity must be positive'),
    unitCostExGst: z.coerce.number().positive('Unit cost must be positive'),
    detectedPackSize: z.coerce.number().int().positive().optional(),
    category: z.string().min(1, 'Category is required'),
    markup: z.coerce.number().positive('Markup must be positive'),
    notes: z.string().optional(),
  })),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'PARSED', 'REVIEWED', 'APPROVED', 'REJECTED', 'POSTED']).optional(),
  allItemsReceived: z.boolean().optional(),
  allItemsCheckedIn: z.boolean().optional(),
  missingItems: z.array(z.string()).optional(),
  receivingNotes: z.string().optional(),
  needsRectification: z.boolean().optional(),
  rectificationNotes: z.string().optional(),
  rectificationContactedAt: z.coerce.date().optional(),
  rectificationResolvedAt: z.coerce.date().optional(),
  lineItems: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Item name is required'),
    quantity: z.coerce.number().positive('Quantity must be positive'),
    unitCostExGst: z.coerce.number().positive('Unit cost must be positive'),
    detectedPackSize: z.coerce.number().int().positive().optional(),
    category: z.string().min(1, 'Category is required'),
    markup: z.coerce.number().positive('Markup must be positive'),
    notes: z.string().optional(),
  })).optional(),
});

// Settings schemas
export const updateSettingsSchema = z.object({
  key: z.string().min(1, 'Settings key is required'),
  value: z.unknown(),
  description: z.string().optional(),
});

// Sales report schemas
export const createSalesReportSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  reportPeriodStart: z.coerce.date(),
  reportPeriodEnd: z.coerce.date(),
  hash: z.string().min(1, 'Hash is required for deduplication'),
});

// File upload schemas
export const fileUploadSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, 'File is required'),
  maxSize: z.number().default(50 * 1024 * 1024), // 50MB default
});

// Search and filter schemas
export const itemsFilterSchema = z.object({
  category: z.string().optional(),
  vendorId: z.string().optional(),
  search: z.string().optional(),
  priceChanged: z.coerce.boolean().optional(),
}).merge(paginationSchema);

export const invoicesFilterSchema = z.object({
  vendorId: z.string().optional(),
  status: z.enum(['DRAFT', 'PARSED', 'REVIEWED', 'APPROVED', 'REJECTED', 'POSTED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  needsRectification: z.enum(['true', 'contacted', 'resolved']).optional(),
}).merge(paginationSchema);

export const rectificationFilterSchema = z.object({
  vendorId: z.string().optional(),
  resolved: z.coerce.boolean().optional(),
  contacted: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

export const salesFilterSchema = z.object({
  category: z.string().optional(),
  itemName: z.string().optional(),
}).merge(dateRangeSchema);

// Response schemas for type safety
export const apiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    message: z.string().optional(),
  });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  success: z.literal(false),
});