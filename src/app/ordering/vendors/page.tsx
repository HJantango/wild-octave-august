'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Vendor {
  id: string;
  name: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    contactPerson?: string;
  };
  paymentTerms?: string;
  orderSettings?: {
    id: string;
    orderFrequency?: string;
    minimumOrderValue?: number;
    freeShippingThreshold?: number;
    shippingCost?: number;
    leadTimeDays?: number;
    orderDay?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    isActive: boolean;
  };
  _count?: {
    items: number;
    invoices: number;
    purchaseOrders: number;
  };
}

interface VendorContactInfo {
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  paymentTerms: string;
}

interface OrderSettings {
  orderFrequency: string;
  minimumOrderValue: string;
  freeShippingThreshold: string;
  shippingCost: string;
  leadTimeDays: string;
  orderDay: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  isActive: boolean;
}

async function fetchVendors(): Promise<Vendor[]> {
  const response = await fetch('/api/vendors');
  if (!response.ok) {
    throw new Error('Failed to fetch vendors');
  }
  return response.json();
}

async function saveVendorOrderSettings(vendorId: string, settings: Partial<OrderSettings>) {
  const response = await fetch(`/api/vendors/${vendorId}/order-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...settings,
      minimumOrderValue: settings.minimumOrderValue ? parseFloat(settings.minimumOrderValue) : undefined,
      freeShippingThreshold: settings.freeShippingThreshold ? parseFloat(settings.freeShippingThreshold) : undefined,
      shippingCost: settings.shippingCost ? parseFloat(settings.shippingCost) : undefined,
      leadTimeDays: settings.leadTimeDays ? parseInt(settings.leadTimeDays) : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save order settings');
  }
  return response.json();
}

function VendorSettingsModal({
  vendor,
  isOpen,
  onClose,
}: {
  vendor: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<OrderSettings>({
    orderFrequency: '',
    minimumOrderValue: '',
    freeShippingThreshold: '',
    shippingCost: '',
    leadTimeDays: '7',
    orderDay: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    isActive: true,
  });

  const queryClient = useQueryClient();

  // Initialize form with existing settings
  useState(() => {
    if (vendor?.orderSettings) {
      const existing = vendor.orderSettings;
      setSettings({
        orderFrequency: existing.orderFrequency || '',
        minimumOrderValue: existing.minimumOrderValue?.toString() || '',
        freeShippingThreshold: existing.freeShippingThreshold?.toString() || '',
        shippingCost: existing.shippingCost?.toString() || '',
        leadTimeDays: existing.leadTimeDays?.toString() || '7',
        orderDay: existing.orderDay || '',
        contactEmail: existing.contactEmail || '',
        contactPhone: existing.contactPhone || '',
        notes: existing.notes || '',
        isActive: existing.isActive,
      });
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (data: Partial<OrderSettings>) => 
      saveVendorOrderSettings(vendor!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;

    const submitData = Object.entries(settings).reduce((acc, [key, value]) => {
      if (value !== '') {
        acc[key as keyof OrderSettings] = value;
      }
      return acc;
    }, {} as Partial<OrderSettings>);

    saveSettingsMutation.mutate(submitData);
  };

  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Settings: {vendor.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="order-frequency">Order Frequency</Label>
              <Select 
                value={settings.orderFrequency} 
                onValueChange={(value) => setSettings({...settings, orderFrequency: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="as-needed">As Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order-day">Preferred Order Day</Label>
              <Select 
                value={settings.orderDay} 
                onValueChange={(value) => setSettings({...settings, orderDay: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minimum-order">Minimum Order Value ($)</Label>
              <Input
                id="minimum-order"
                type="number"
                step="0.01"
                value={settings.minimumOrderValue}
                onChange={(e) => setSettings({...settings, minimumOrderValue: e.target.value})}
                placeholder="e.g., 500.00"
              />
            </div>

            <div>
              <Label htmlFor="shipping-cost">Shipping Cost ($)</Label>
              <Input
                id="shipping-cost"
                type="number"
                step="0.01"
                value={settings.shippingCost}
                onChange={(e) => setSettings({...settings, shippingCost: e.target.value})}
                placeholder="e.g., 25.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="free-shipping">Free Shipping Threshold ($)</Label>
              <Input
                id="free-shipping"
                type="number"
                step="0.01"
                value={settings.freeShippingThreshold}
                onChange={(e) => setSettings({...settings, freeShippingThreshold: e.target.value})}
                placeholder="e.g., 1000.00"
              />
            </div>

            <div>
              <Label htmlFor="lead-time">Lead Time (days)</Label>
              <Input
                id="lead-time"
                type="number"
                value={settings.leadTimeDays}
                onChange={(e) => setSettings({...settings, leadTimeDays: e.target.value})}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                placeholder="orders@vendor.com"
              />
            </div>

            <div>
              <Label htmlFor="contact-phone">Contact Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={settings.contactPhone}
                onChange={(e) => setSettings({...settings, contactPhone: e.target.value})}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={settings.notes}
              onChange={(e) => setSettings({...settings, notes: e.target.value})}
              placeholder="Special ordering instructions, account numbers, etc."
              rows={3}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is-active"
              checked={settings.isActive}
              onChange={(e) => setSettings({...settings, isActive: e.target.checked})}
              className="rounded border-gray-300"
            />
            <Label htmlFor="is-active">Active vendor (include in ordering)</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveSettingsMutation.isPending}>
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function saveVendorContactInfo(vendorId: string, contactInfo: Partial<VendorContactInfo>) {
  const response = await fetch(`/api/vendors/${vendorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactInfo: {
        email: contactInfo.email || undefined,
        phone: contactInfo.phone || undefined,
        address: contactInfo.address || undefined,
        contactPerson: contactInfo.contactPerson || undefined,
      },
      paymentTerms: contactInfo.paymentTerms || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save vendor contact information');
  }
  return response.json();
}

function VendorInfoModal({
  vendor,
  isOpen,
  onClose,
}: {
  vendor: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [contactInfo, setContactInfo] = useState<VendorContactInfo>({
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    paymentTerms: '',
  });

  const queryClient = useQueryClient();

  // Initialize form with existing info
  useState(() => {
    if (vendor) {
      setContactInfo({
        email: vendor.contactInfo?.email || '',
        phone: vendor.contactInfo?.phone || '',
        address: vendor.contactInfo?.address || '',
        contactPerson: vendor.contactInfo?.contactPerson || '',
        paymentTerms: vendor.paymentTerms || '',
      });
    }
  });

  const saveInfoMutation = useMutation({
    mutationFn: (data: Partial<VendorContactInfo>) =>
      saveVendorContactInfo(vendor!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;

    saveInfoMutation.mutate(contactInfo);
  };

  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vendor Contact Information: {vendor.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contact-person">Contact Person</Label>
            <Input
              id="contact-person"
              value={contactInfo.contactPerson}
              onChange={(e) => setContactInfo({...contactInfo, contactPerson: e.target.value})}
              placeholder="John Smith"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={contactInfo.email}
              onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
              placeholder="orders@vendor.com"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={contactInfo.phone}
              onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={contactInfo.address}
              onChange={(e) => setContactInfo({...contactInfo, address: e.target.value})}
              placeholder="123 Main St&#10;City, State ZIP"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="payment-terms">Payment Terms</Label>
            <Input
              id="payment-terms"
              value={contactInfo.paymentTerms}
              onChange={(e) => setContactInfo({...contactInfo, paymentTerms: e.target.value})}
              placeholder="e.g., Net 30, COD, etc."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveInfoMutation.isPending}>
              {saveInfoMutation.isPending ? 'Saving...' : 'Save Information'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VendorsPage() {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: vendors = [], isLoading, error } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
  });

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openSettingsModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsSettingsModalOpen(true);
  };

  const openInfoModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsInfoModalOpen(true);
  };

  const getSettingsStatus = (vendor: Vendor) => {
    if (!vendor.orderSettings) {
      return { status: 'NONE', color: 'bg-gray-100 text-gray-800', label: 'Not Configured' };
    } else if (!vendor.orderSettings.isActive) {
      return { status: 'INACTIVE', color: 'bg-red-100 text-red-800', label: 'Inactive' };
    } else {
      return { status: 'ACTIVE', color: 'bg-green-100 text-green-800', label: 'Active' };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Order Settings</h1>
            <p className="text-gray-600">Configure ordering preferences for your suppliers</p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="max-w-md">
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Vendors List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Vendors</span>
              <span className="text-sm font-normal text-gray-500">
                {filteredVendors.length} vendors
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        </div>
                        <div className="h-8 bg-gray-200 rounded w-24"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-red-600">
                  <span className="text-4xl mb-2 block">❌</span>
                  <p className="font-medium">Error loading vendors</p>
                  <p className="text-sm">{error.message}</p>
                </div>
              </div>
            ) : filteredVendors.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredVendors.map((vendor) => {
                  const settingsStatus = getSettingsStatus(vendor);
                  const settings = vendor.orderSettings;

                  return (
                    <div key={vendor.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                              <div className="flex items-center space-x-4 mt-1">
                                <Badge className={settingsStatus.color}>
                                  {settingsStatus.label}
                                </Badge>
                                {vendor._count && (
                                  <div className="text-sm text-gray-500">
                                    {vendor._count.items} items • {vendor._count.invoices} invoices • {vendor._count.purchaseOrders} orders
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {settings && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-sm">
                              <div>
                                <span className="text-gray-500">Frequency:</span>
                                <span className="font-medium ml-2 capitalize">
                                  {settings.orderFrequency || 'Not set'}
                                </span>
                              </div>
                              {settings.minimumOrderValue && (
                                <div>
                                  <span className="text-gray-500">Min Order:</span>
                                  <span className="font-medium ml-2">
                                    {formatCurrency(settings.minimumOrderValue)}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Lead Time:</span>
                                <span className="font-medium ml-2">
                                  {settings.leadTimeDays || 7} days
                                </span>
                              </div>
                            </div>
                          )}

                          {settings && (settings.freeShippingThreshold || settings.shippingCost) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 text-sm">
                              {settings.shippingCost && (
                                <div>
                                  <span className="text-gray-500">Shipping:</span>
                                  <span className="font-medium ml-2">
                                    {formatCurrency(settings.shippingCost)}
                                    {settings.freeShippingThreshold && (
                                      <span className="text-gray-400">
                                        {' '}(free over {formatCurrency(settings.freeShippingThreshold)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="ml-4 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => openInfoModal(vendor)}
                            variant="outline"
                          >
                            📇 Edit Info
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openSettingsModal(vendor)}
                            variant={settings ? "outline" : "default"}
                          >
                            {settings ? 'Edit Settings' : 'Configure'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl mb-2 block">🏪</span>
                <p className="font-medium">No vendors found</p>
                <p className="text-sm">
                  {searchQuery ? 'Try adjusting your search' : 'Vendors will appear as you process invoices'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor Settings Modal */}
        <VendorSettingsModal
          vendor={selectedVendor}
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />

        {/* Vendor Info Modal */}
        <VendorInfoModal
          vendor={selectedVendor}
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}