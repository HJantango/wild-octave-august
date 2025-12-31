'use client';

import { useState, useEffect } from 'react';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ItemsFiltersProps {
  onFiltersChange: (filters: {
    search?: string;
    category?: string;
    priceChanged?: boolean;
  }) => void;
  loading?: boolean;
}

const CATEGORIES = [
  { value: 'House', label: 'House' },
  { value: 'Bulk', label: 'Bulk' },
  { value: 'Fruit & Veg', label: 'Fruit & Veg' },
  { value: 'Fridge & Freezer', label: 'Fridge & Freezer' },
  { value: 'Naturo', label: 'Naturo' },
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Drinks Fridge', label: 'Drinks Fridge' },
  { value: 'Supplements', label: 'Supplements' },
  { value: 'Personal Care', label: 'Personal Care' },
  { value: 'Fresh Bread', label: 'Fresh Bread' },
];

const PRICE_CHANGE_OPTIONS = [
  { value: 'true', label: 'Price Changed' },
  { value: 'false', label: 'No Price Changes' },
];

export function ItemsFilters({ onFiltersChange, loading }: ItemsFiltersProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceChanged, setPriceChanged] = useState('');

  const handleClearFilters = () => {
    setSearch('');
    setCategory('');
    setPriceChanged('');
  };

  useEffect(() => {
    const filters: any = {};
    if (search.trim()) filters.search = search.trim();
    if (category) filters.category = category;
    if (priceChanged) filters.priceChanged = priceChanged === 'true';

    onFiltersChange(filters);
  }, [search, category, priceChanged, onFiltersChange]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          disabled={loading}
        >
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Search items, Vendor Code, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />

        <Select
          placeholder="All Categories"
          options={CATEGORIES}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={loading}
        />

        <Select
          placeholder="All Items"
          options={PRICE_CHANGE_OPTIONS}
          value={priceChanged}
          onChange={(e) => setPriceChanged(e.target.value)}
          disabled={loading}
        />
      </div>
    </div>
  );
}