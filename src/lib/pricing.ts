import { Decimal } from 'decimal.js';

// Configure Decimal.js for precise currency calculations
Decimal.set({ precision: 8, rounding: Decimal.ROUND_HALF_UP });

export interface PricingCalculation {
  costExGst: number;
  markup: number;
  sellExGst: number;
  gstAmount: number;
  sellIncGst: number;
  effectiveCostExGst?: number;
}

export function calculatePricing(
  unitCostExGst: number,
  markup: number,
  packSize: number = 1,
  gstRate: number = 0.10
): PricingCalculation {
  const cost = new Decimal(unitCostExGst);
  const markupDecimal = new Decimal(markup);
  const pack = new Decimal(packSize);
  const gst = new Decimal(gstRate);

  // Calculate effective unit cost if pack size is greater than 1
  const effectiveCost = cost.div(pack);
  
  // Calculate sell price ex GST
  const sellExGst = effectiveCost.mul(markupDecimal);
  
  // Calculate GST amount
  const gstAmount = sellExGst.mul(gst);
  
  // Calculate sell price inc GST
  const sellIncGst = sellExGst.plus(gstAmount);

  return {
    costExGst: cost.toNumber(),
    markup: markupDecimal.toNumber(),
    sellExGst: roundToCents(sellExGst.toNumber()),
    gstAmount: roundToCents(gstAmount.toNumber()),
    sellIncGst: roundToCents(sellIncGst.toNumber()),
    effectiveCostExGst: packSize > 1 ? roundToCents(effectiveCost.toNumber()) : undefined,
  };
}

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrency(value: string): number {
  // Remove currency symbols and parse
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

export async function getDefaultMarkup(category: string): Promise<number> {
  // Default markups based on category
  const defaultMarkups: Record<string, number> = {
    'House': 1.65,
    'Bulk': 1.75,
    'Fruit & Veg': 1.75,
    'Fridge & Freezer': 1.5,
    'Naturo': 1.65,
    'Groceries': 1.65,
    'Drinks Fridge': 1.65,
    'Supplements': 1.65,
    'Personal Care': 1.65,
    'Fresh Bread': 1.5,
  };

  return defaultMarkups[category] || 1.65; // Default to 1.65 if category not found
}

export function detectPackSize(itemName: string, unitDescription?: string): number {
  const text = `${itemName} ${unitDescription || ''}`.toLowerCase();
  
  // Pack size patterns - now including weight/volume as pack sizes for pricing
  const patterns = [
    { regex: /(\d+)\s*pk|pack\s*of\s*(\d+)|x(\d+)(?!\d)/i, multiplier: 1 },
    { regex: /(\d+)\s*doz|dozen/i, multiplier: 12 },
    { regex: /\/(\d+)/i, multiplier: 1 },
    { regex: /(\d+)kg/i, multiplier: 1 }, // Kilograms as pack size
    { regex: /(\d+)g/i, multiplier: 1000 }, // Grams - convert to kg equivalent (1000g = 1kg pack)
    { regex: /(\d+)l/i, multiplier: 1 }, // Liters as pack size
    { regex: /(\d+)ml/i, multiplier: 1000 }, // Milliliters - convert to liter equivalent
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const number = parseInt(match[1] || match[2] || match[3] || '1', 10);
      
      // Handle gram/ml conversions
      if (pattern.multiplier === 1000) {
        if (number >= 1000) {
          return Math.floor(number / 1000); // Convert 5000g to 5kg pack size
        }
        continue; // Skip small gram/ml amounts
      }
      
      if (pattern.multiplier === 12 && number === 1) return 12; // Special case for "dozen"
      if (number > 1 && number <= 100) { // Reasonable pack size range
        return number;
      }
    }
  }

  return 1; // Default to single unit
}

export function validatePricing(calculation: PricingCalculation): string[] {
  const errors: string[] = [];

  if (calculation.costExGst <= 0) {
    errors.push('Cost ex GST must be positive');
  }

  if (calculation.markup <= 0) {
    errors.push('Markup must be positive');
  }

  if (calculation.sellExGst <= calculation.costExGst) {
    errors.push('Sell price ex GST must be greater than cost');
  }

  if (Math.abs(calculation.sellIncGst - (calculation.sellExGst + calculation.gstAmount)) > 0.01) {
    errors.push('GST calculation is inconsistent');
  }

  return errors;
}