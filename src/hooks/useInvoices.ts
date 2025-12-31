'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Invoice {
  id: string;
  vendorId: string;
  invoiceDate: string;
  subtotalExGst: number;
  gstAmount: number;
  totalIncGst: number;
  status: 'PARSED' | 'REVIEWED' | 'POSTED';
  createdAt: string;
  updatedAt: string;
  vendor: {
    id: string;
    name: string;
  };
  lineItemCount?: number;
}

export interface InvoiceLineItem {
  id?: string;
  name: string;
  quantity: number;
  unitCostExGst: number;
  detectedPackSize?: number;
  effectiveUnitCostExGst: number;
  category: string;
  markup: number;
  sellExGst: number;
  sellIncGst: number;
  notes?: string;
  confidence?: number;
  rawText?: string;
}

export interface InvoiceDetail extends Invoice {
  lineItems: InvoiceLineItem[];
  parsedJson?: any;
}

export interface InvoicesParams {
  page?: number;
  limit?: number;
  vendorId?: string;
  status?: 'PARSED' | 'REVIEWED' | 'POSTED';
  startDate?: Date;
  endDate?: Date;
}

export interface InvoicesResponse {
  data: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useInvoices(params: InvoicesParams = {}) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.vendorId) searchParams.set('vendorId', params.vendorId);
      if (params.status) searchParams.set('status', params.status);
      if (params.startDate) searchParams.set('startDate', params.startDate.toISOString());
      if (params.endDate) searchParams.set('endDate', params.endDate.toISOString());

      const response = await fetch(`/api/invoices?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const result = await response.json();
      return result.data as InvoicesResponse;
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }
      
      const result = await response.json();
      return result.data as InvoiceDetail;
    },
    enabled: !!id,
  });
}

export function useUploadInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/invoices', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to upload invoice');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useProcessInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices/${id}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to process invoice');
      }

      return response.json();
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceDetail> }) => {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update invoice');
      }

      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
  });
}

export function useCommitInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices/${id}/commit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to commit invoice');
      }

      return response.json();
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['items'] }); // Refresh items as prices may have changed
    },
  });
}