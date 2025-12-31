'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Item {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  displayOrder: number;
  currentSellIncGst: number;
}

interface ItemOrganizerProps {
  initialItems: Item[];
  onSave: (updates: Array<{ id: string; displayOrder: number }>) => Promise<void>;
  onUpdateItem: (itemId: string, data: { category?: string; subcategory?: string }) => Promise<void>;
}

function SortableItem({
  item,
  onEdit,
  isSelected,
  onToggleSelect
}: {
  item: Item;
  onEdit: (item: Item) => void;
  isSelected: boolean;
  onToggleSelect: (itemId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 bg-white border rounded-lg mb-2 hover:shadow-md transition-shadow ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center space-x-3 flex-1">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">{item.name}</div>
          <div className="text-sm text-gray-500">
            {item.subcategory && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                {item.subcategory}
              </span>
            )}
            <span className="text-gray-400">#{item.displayOrder}</span>
          </div>
        </div>
        <div className="text-sm font-medium text-gray-700">
          ${item.currentSellIncGst.toFixed(2)}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(item)}
        className="ml-3"
      >
        Edit
      </Button>
    </div>
  );
}

export function ItemOrganizer({ initialItems, onSave, onUpdateItem }: ItemOrganizerProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkSubcategory, setBulkSubcategory] = useState<string>('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group items by category
  const categories = useMemo(() => {
    const cats = [...new Set(items.map(item => item.category))].sort();
    return cats;
  }, [items]);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    const filtered = selectedCategory
      ? items.filter(item => item.category === selectedCategory)
      : items;
    return filtered.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [items, selectedCategory]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems(currentItems => {
        const filtered = selectedCategory
          ? currentItems.filter(item => item.category === selectedCategory)
          : currentItems;

        const oldIndex = filtered.findIndex(item => item.id === active.id);
        const newIndex = filtered.findIndex(item => item.id === over.id);

        const reordered = arrayMove(filtered, oldIndex, newIndex).map((item, index) => ({
          ...item,
          displayOrder: index,
        }));

        // Merge back with other categories
        if (selectedCategory) {
          const otherItems = currentItems.filter(item => item.category !== selectedCategory);
          return [...otherItems, ...reordered];
        }
        return reordered;
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = filteredItems.map(item => ({
        id: item.id,
        displayOrder: item.displayOrder,
      }));
      await onSave(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = async (data: { category?: string; subcategory?: string }) => {
    if (!editingItem) return;

    await onUpdateItem(editingItem.id, data);

    // Update local state
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === editingItem.id ? { ...item, ...data } : item
      )
    );
    setEditingItem(null);
  };

  const handleToggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleBulkCategorize = async () => {
    if (selectedItems.size === 0) return;
    if (!bulkCategory && !bulkSubcategory) return;

    setIsApplyingBulk(true);
    try {
      const response = await fetch('/api/items/bulk-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: Array.from(selectedItems),
          category: bulkCategory || undefined,
          subcategory: bulkSubcategory || undefined,
        }),
      });

      if (response.ok) {
        // Update local state
        setItems(currentItems =>
          currentItems.map(item =>
            selectedItems.has(item.id)
              ? {
                  ...item,
                  category: bulkCategory || item.category,
                  subcategory: bulkSubcategory || item.subcategory,
                }
              : item
          )
        );
        setSelectedItems(new Set());
        setBulkCategory('');
        setBulkSubcategory('');
      }
    } finally {
      setIsApplyingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-sm">
          <Label htmlFor="category-select">Filter by Category</Label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="ml-4"
        >
          {isSaving ? 'Saving...' : 'Save Order'}
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-base">
              Bulk Actions ({selectedItems.size} items selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="bulk-category">New Category</Label>
                <Input
                  id="bulk-category"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  placeholder="Enter category"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bulk-subcategory">New Subcategory/Shelf</Label>
                <Input
                  id="bulk-subcategory"
                  value={bulkSubcategory}
                  onChange={(e) => setBulkSubcategory(e.target.value)}
                  placeholder="Enter subcategory"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleBulkCategorize}
                disabled={isApplyingBulk || (!bulkCategory && !bulkSubcategory)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isApplyingBulk ? 'Applying...' : 'Apply to Selected'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setSelectedItems(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>Instructions:</strong> Use checkboxes to select multiple items for bulk categorization. Drag items by the handle (≡) to reorder them. Click "Edit" to change individual item details.
          </p>
        </CardContent>
      </Card>

      {/* Sortable List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {selectedCategory || 'All Items'}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredItems.length} items)
              </span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedItems.size > 0 && selectedItems.size === filteredItems.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No items found. Select a different category or add items.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredItems.map(item => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onEdit={setEditingItem}
                    isSelected={selectedItems.has(item.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Item: {editingItem.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  defaultValue={editingItem.category}
                  onBlur={(e) => {
                    if (e.target.value !== editingItem.category) {
                      handleUpdateItem({ category: e.target.value });
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-subcategory">Subcategory / Shelf Location</Label>
                <Input
                  id="edit-subcategory"
                  defaultValue={editingItem.subcategory || ''}
                  placeholder="e.g., Top Shelf, Fridge, Floor Stock"
                  onBlur={(e) => {
                    if (e.target.value !== editingItem.subcategory) {
                      handleUpdateItem({ subcategory: e.target.value || null });
                    }
                  }}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setEditingItem(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
