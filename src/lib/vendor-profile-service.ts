import { PrismaClient } from '@prisma/client';

export interface VendorProfile {
  id: string;
  vendorId: string;
  learningData: any;
  parsingRules: any;
  correctionHistory: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Correction {
  field: string;
  original: any;
  corrected: any;
  reason: string;
  confidence?: number;
}

export class VendorProfileService {
  constructor(private prisma: PrismaClient) {}

  async getOrCreateProfile(vendorId: string): Promise<VendorProfile> {
    try {
      // Try to find existing profile
      let profile = await this.prisma.vendorProfile.findUnique({
        where: { vendorId }
      });

      if (!profile) {
        // Create new profile with default settings
        profile = await this.prisma.vendorProfile.create({
          data: {
            vendorId,
            learningData: {
              commonItems: [],
              packSizePatterns: [],
              pricePatterns: [],
              categoryMappings: {}
            },
            parsingRules: {
              quantityCorrections: true,
              priceValidation: true,
              categoryAutoAssignment: true
            },
            correctionHistory: []
          }
        });
      }

      return profile as VendorProfile;
    } catch (error) {
      console.error('Error getting/creating vendor profile:', error);
      // Return a default profile if database operations fail
      return {
        id: `temp-${vendorId}`,
        vendorId,
        learningData: {
          commonItems: [],
          packSizePatterns: [],
          pricePatterns: [],
          categoryMappings: {}
        },
        parsingRules: {
          quantityCorrections: true,
          priceValidation: true,
          categoryAutoAssignment: true
        },
        correctionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  async learnFromCorrection(vendorId: string, correction: Correction): Promise<void> {
    try {
      const profile = await this.getOrCreateProfile(vendorId);

      // Add correction to history
      const updatedHistory = [...(profile.correctionHistory || []), {
        ...correction,
        timestamp: new Date(),
        confidence: correction.confidence || 0.8
      }];

      // Update learning data based on correction type
      const updatedLearningData = { ...profile.learningData };

      switch (correction.field) {
        case 'quantity':
          this.learnQuantityPattern(updatedLearningData, correction);
          break;
        case 'unitCost':
          this.learnPricePattern(updatedLearningData, correction);
          break;
        case 'category':
          this.learnCategoryMapping(updatedLearningData, correction);
          break;
        case 'itemDescription':
          this.learnItemPattern(updatedLearningData, correction);
          break;
      }

      // Update the profile in database
      await this.prisma.vendorProfile.update({
        where: { vendorId },
        data: {
          learningData: updatedLearningData,
          correctionHistory: updatedHistory,
          updatedAt: new Date()
        }
      });

      console.log(`Learned from correction for vendor ${vendorId}: ${correction.field}`);
    } catch (error) {
      console.error('Error learning from correction:', error);
      // Don't throw - learning failures shouldn't break the main flow
    }
  }

  async getParsingHints(vendorId: string, itemDescription: string): Promise<any> {
    try {
      const profile = await this.getOrCreateProfile(vendorId);
      const hints: any = {};

      // Check for known item patterns
      const similarItems = this.findSimilarItems(profile.learningData.commonItems || [], itemDescription);
      if (similarItems.length > 0) {
        hints.suggestedCategory = similarItems[0].category;
        hints.suggestedQuantity = similarItems[0].quantity;
      }

      // Check for pack size patterns
      const packSizeHint = this.detectPackSize(profile.learningData.packSizePatterns || [], itemDescription);
      if (packSizeHint) {
        hints.suggestedPackSize = packSizeHint;
      }

      // Check category mappings
      const categoryHint = this.suggestCategory(profile.learningData.categoryMappings || {}, itemDescription);
      if (categoryHint) {
        hints.suggestedCategory = categoryHint;
      }

      return hints;
    } catch (error) {
      console.error('Error getting parsing hints:', error);
      return {};
    }
  }

  private learnQuantityPattern(learningData: any, correction: Correction): void {
    const patterns = learningData.packSizePatterns || [];
    
    // Extract pattern from the correction
    if (typeof correction.original === 'string' && typeof correction.corrected === 'number') {
      const pattern = {
        text: correction.original,
        quantity: correction.corrected,
        confidence: correction.confidence || 0.8,
        lastSeen: new Date()
      };
      
      patterns.push(pattern);
      learningData.packSizePatterns = patterns.slice(-50); // Keep last 50 patterns
    }
  }

  private learnPricePattern(learningData: any, correction: Correction): void {
    const patterns = learningData.pricePatterns || [];
    
    const pattern = {
      originalPrice: correction.original,
      correctedPrice: correction.corrected,
      ratio: correction.corrected / correction.original,
      confidence: correction.confidence || 0.8,
      lastSeen: new Date()
    };
    
    patterns.push(pattern);
    learningData.pricePatterns = patterns.slice(-50);
  }

  private learnCategoryMapping(learningData: any, correction: Correction): void {
    const mappings = learningData.categoryMappings || {};
    
    // Use part of the item description as a key
    const key = correction.original.toLowerCase().split(' ').slice(0, 3).join(' ');
    mappings[key] = {
      category: correction.corrected,
      confidence: correction.confidence || 0.8,
      lastSeen: new Date()
    };
    
    learningData.categoryMappings = mappings;
  }

  private learnItemPattern(learningData: any, correction: Correction): void {
    const items = learningData.commonItems || [];
    
    const item = {
      originalDescription: correction.original,
      correctedDescription: correction.corrected,
      confidence: correction.confidence || 0.8,
      lastSeen: new Date()
    };
    
    items.push(item);
    learningData.commonItems = items.slice(-100); // Keep last 100 items
  }

  private findSimilarItems(items: any[], description: string): any[] {
    const searchTerms = description.toLowerCase().split(' ');
    
    return items.filter(item => {
      const itemTerms = item.correctedDescription.toLowerCase().split(' ');
      const overlap = searchTerms.filter(term => itemTerms.includes(term));
      return overlap.length >= 2; // At least 2 words in common
    }).slice(0, 3); // Return top 3 matches
  }

  private detectPackSize(patterns: any[], description: string): number | null {
    for (const pattern of patterns) {
      if (description.toLowerCase().includes(pattern.text.toLowerCase())) {
        return pattern.quantity;
      }
    }
    return null;
  }

  private suggestCategory(mappings: any, description: string): string | null {
    const descLower = description.toLowerCase();
    
    for (const [key, mapping] of Object.entries(mappings)) {
      if (descLower.includes(key.toLowerCase())) {
        return (mapping as any).category;
      }
    }
    
    return null;
  }
}