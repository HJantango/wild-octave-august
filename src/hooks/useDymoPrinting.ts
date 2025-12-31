'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { dymoService, DymoLabelData } from '@/lib/dymo-printing';

interface UseDymoPrintingReturn {
  isInitialized: boolean;
  availablePrinters: string[];
  selectedPrinter: string | null;
  isInitializing: boolean;
  initError: string | null;
  initialize: () => Promise<void>;
  printSingle: ReturnType<typeof useMutation<boolean, Error, DymoLabelData>>;
  printMultiple: ReturnType<typeof useMutation<{success: number, failed: number, errors: string[]}, Error, DymoLabelData[]>>;
  setSelectedPrinter: (printer: string | null) => void;
}

export function useDymoPrinting(): UseDymoPrintingReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    setInitError(null);

    try {
      const success = await dymoService.initialize();
      setIsInitialized(success);
      
      if (success) {
        const printers = dymoService.getAvailablePrinters();
        setAvailablePrinters(printers);
        
        // Auto-select Dymo 550 Turbo if available
        const dymo550 = dymoService.findDymo550Printer();
        setSelectedPrinter(dymo550);
        
        console.log('🏷️ Dymo printing initialized successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Dymo printing';
      setInitError(errorMessage);
      console.error('❌ Dymo initialization failed:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing]);

  // Auto-initialize on first use
  useEffect(() => {
    // Only initialize if we're in the browser and haven't tried yet
    if (typeof window !== 'undefined' && !isInitialized && !isInitializing && !initError) {
      initialize();
    }
  }, [initialize, isInitialized, isInitializing, initError]);

  const printSingle = useMutation({
    mutationFn: async (labelData: DymoLabelData) => {
      if (!isInitialized) {
        throw new Error('Dymo service not initialized. Please check your Dymo Connect installation.');
      }
      return await dymoService.printLabel(labelData, selectedPrinter || undefined);
    },
    onSuccess: () => {
      console.log('🏷️ Label printed successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to print label:', error);
    }
  });

  const printMultiple = useMutation({
    mutationFn: async (labels: DymoLabelData[]) => {
      if (!isInitialized) {
        throw new Error('Dymo service not initialized. Please check your Dymo Connect installation.');
      }
      return await dymoService.printMultipleLabels(labels, selectedPrinter || undefined);
    },
    onSuccess: (result) => {
      console.log(`🏷️ Bulk print completed: ${result.success} success, ${result.failed} failed`);
    },
    onError: (error) => {
      console.error('❌ Failed to bulk print labels:', error);
    }
  });

  return {
    isInitialized,
    availablePrinters,
    selectedPrinter,
    isInitializing,
    initError,
    initialize,
    printSingle,
    printMultiple,
    setSelectedPrinter,
  };
}

// Helper hook for printing items directly
export function useItemLabelPrinting() {
  const dymo = useDymoPrinting();
  
  const printItem = useCallback((item: { 
    name: string; 
    sellIncGst?: number; 
    sellExGst?: number; 
  }) => {
    const labelData = dymoService.formatItemForLabel(item);
    return dymo.printSingle.mutate(labelData);
  }, [dymo.printSingle]);

  const printItems = useCallback((items: Array<{ 
    name: string; 
    sellIncGst?: number; 
    sellExGst?: number; 
  }>) => {
    const labelData = items.map(item => dymoService.formatItemForLabel(item));
    return dymo.printMultiple.mutate(labelData);
  }, [dymo.printMultiple]);

  return {
    ...dymo,
    printItem,
    printItems,
  };
}