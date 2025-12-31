'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ItemOrganizer } from '@/components/items/item-organizer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

export default function ItemOrganizePage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const response = await fetch('/api/items?limit=1000');
      const data = await response.json();
      if (data.success) {
        setItems(data.data.data);
      }
    } catch (error) {
      toast.error('Error', 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updates: Array<{ id: string; displayOrder: number }>) => {
    try {
      const response = await fetch('/api/items/bulk-update-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Success', `Updated ${updates.length} items`);
      } else {
        toast.error('Error', 'Failed to save item order');
      }
    } catch (error) {
      toast.error('Error', 'Failed to save item order');
    }
  };

  const handleUpdateItem = async (itemId: string, updateData: { category?: string; subcategory?: string }) => {
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Success', 'Item updated successfully');
      } else {
        toast.error('Error', 'Failed to update item');
      }
    } catch (error) {
      toast.error('Error', 'Failed to update item');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading items...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organize Items</h1>
            <p className="text-gray-600">Reorder items and manage categories for print sheets</p>
          </div>
          <div className="flex space-x-3">
            <Link href="/items/print-preview">
              <Button variant="secondary">
                Preview Print Sheet
              </Button>
            </Link>
            <Link href="/items">
              <Button variant="secondary">
                Back to Items
              </Button>
            </Link>
          </div>
        </div>

        {/* Organizer Component */}
        <ItemOrganizer
          initialItems={items}
          onSave={handleSave}
          onUpdateItem={handleUpdateItem}
        />
      </div>
    </DashboardLayout>
  );
}
