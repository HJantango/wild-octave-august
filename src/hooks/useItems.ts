'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Item {
  id: string;
  name: string;
  category: string;
  currentCostExGst: number;
  currentSellExGst: number;
  currentSellIncGst: number;
  currentMarkup: number;
  sku?: string;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
  vendor?: {
    id: string;
    name: string;
  };
  hasPriceChanged?: boolean;
  lastPriceChange?: {
    previousCost: number;
    changedAt: string;
  };
}

export interface ItemsParams {
  page?: number;
  limit?: number;
  category?: string;
  vendorId?: string;
  search?: string;
  priceChanged?: boolean;
}

export interface ItemsResponse {
  data: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useItems(params: ItemsParams = {}) {
  return useQuery({
    queryKey: ['items', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.category) searchParams.set('category', params.category);
      if (params.vendorId) searchParams.set('vendorId', params.vendorId);
      if (params.search) searchParams.set('search', params.search);
      if (params.priceChanged !== undefined) searchParams.set('priceChanged', params.priceChanged.toString());

      const response = await fetch(`/api/items?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }
      
      const result = await response.json();
      return result.data as ItemsResponse;
    },
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const response = await fetch(`/api/items/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch item');
      }
      
      const result = await response.json();
      return result.data as Item & {
        priceHistory: Array<{
          id: string;
          costExGst: number;
          markup: number;
          sellExGst: number;
          sellIncGst: number;
          changedAt: string;
          sourceInvoice?: {
            id: string;
            invoiceDate: string;
          };
        }>;
      };
    },
    enabled: !!id,
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Item> }) => {
      const response = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update item');
      }

      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item', id] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to delete item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}