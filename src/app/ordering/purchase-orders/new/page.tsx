'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Vendor {
  id: string;
  name: string;
}

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitCostExGst: number;
  notes?: string;
}

async function fetchVendors(): Promise<Vendor[]> {
  const response = await fetch('/api/vendors');
  if (!response.ok) {
    throw new Error('Failed to fetch vendors');
  }
  return response.json();
}

async function createPurchaseOrder(orderData: {
  vendorId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  lineItems: Omit<LineItem, 'id'>[];
}) {
  const response = await fetch('/api/purchase-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error('Failed to create purchase order');
  }
  return response.json();
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', name: '', quantity: 1, unitCostExGst: 0 }
  ]);

  const { data: vendors, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
  });

  const createOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      router.push(`/ordering/purchase-orders/${data.id}`);
    },
  });

  const addLineItem = () => {
    const newId = (lineItems.length + 1).toString();
    setLineItems([
      ...lineItems,
      { id: newId, name: '', quantity: 1, unitCostExGst: 0 }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitCostExGst), 0);
  };

  const calculateGST = () => {
    return calculateSubtotal() * 0.1;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) {
      alert('Please select a vendor');
      return;
    }

    if (lineItems.some(item => !item.name || item.quantity <= 0 || item.unitCostExGst <= 0)) {
      alert('Please fill in all line item details');
      return;
    }

    createOrderMutation.mutate({
      vendorId: selectedVendor,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      lineItems: lineItems.map(({ id, ...item }) => item),
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Create New Purchase Order</h1>
            <p className="text-gray-600 mt-2">
              Create a new purchase order by selecting a vendor and adding line items.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>
                  Basic information about the purchase order
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vendor">Vendor *</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors?.map(vendor => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
                    <Input
                      id="expectedDeliveryDate"
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes or requirements..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Line Items</CardTitle>
                    <CardDescription>
                      Items to include in this purchase order
                    </CardDescription>
                  </div>
                  <Button type="button" onClick={addLineItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <Label>Item Name *</Label>
                        <Input
                          placeholder="Enter item name"
                          value={item.name}
                          onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Unit Cost (ex GST) *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.unitCostExGst || ''}
                          onChange={(e) => updateLineItem(item.id, 'unitCostExGst', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Total</Label>
                        <div className="text-sm font-medium py-2 px-3 bg-gray-50 rounded border">
                          {formatCurrency(item.quantity * item.unitCostExGst)}
                        </div>
                      </div>
                      
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal (ex GST):</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (10%):</span>
                    <span>{formatCurrency(calculateGST())}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total (inc GST):</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrderMutation.isPending || isLoadingVendors}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                {createOrderMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}