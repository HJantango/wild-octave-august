'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { FileTextIcon, PlusIcon, SearchIcon, FilterIcon, CalendarIcon, UploadIcon, EyeIcon, EditIcon, CheckCircleIcon, AlertCircleIcon, XCircleIcon, TrashIcon, PhoneIcon, CheckIcon } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber?: string;
  vendor: {
    id: string;
    name: string;
    contactInfo?: {
      email?: string;
      phone?: string;
    };
  };
  invoiceDate: string;
  subtotalExGst: number;
  gstAmount: number;
  totalIncGst: number;
  status: string;
  lineItemCount: number;
  createdAt: string;
  needsRectification?: boolean;
  rectificationContactedAt?: string;
  rectificationResolvedAt?: string;
  rectificationNotes?: string;
  resolutionType?: string;
  resolutionValue?: string;
  missingItems?: string[];
}

interface InvoiceFilters {
  status: string;
  vendorId: string;
  search: string;
  startDate: string;
  endDate: string;
  needsRectification: string;
}

const STATUS_COLORS = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  PARSED: 'bg-blue-100 text-blue-800',
  REVIEWED: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const STATUS_ICONS = {
  DRAFT: AlertCircleIcon,
  PARSED: FileTextIcon,
  REVIEWED: EyeIcon,
  APPROVED: CheckCircleIcon,
  REJECTED: XCircleIcon,
};

export default function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    vendorId: 'all',
    search: '',
    startDate: '',
    endDate: '',
    needsRectification: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  
  // Rectification modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showRectificationModal, setShowRectificationModal] = useState(false);
  const [rectificationNotes, setRectificationNotes] = useState('');
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionValue, setResolutionValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      // Add filters to params
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.vendorId && filters.vendorId !== 'all') params.append('vendorId', filters.vendorId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.needsRectification && filters.needsRectification !== 'all') {
        params.append('needsRectification', filters.needsRectification);
      }

      const apiUrl = `/api/invoices?${params}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (result.success) {
        setInvoices(result.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.data.pagination.total,
          totalPages: result.data.pagination.totalPages,
        }));
      } else {
        console.error('Failed to load invoices:', result);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleFilterChange = (key: keyof InvoiceFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      vendorId: 'all',
      search: '',
      startDate: '',
      endDate: '',
      needsRectification: 'all',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || FileTextIcon;
    return <IconComponent className="w-4 h-4" />;
  };

  const deleteInvoice = async (invoiceId: string) => {
    toast.addToast({
      type: 'warning',
      title: 'Delete Invoice?',
      message: 'This action cannot be undone',
      duration: 0,
      action: {
        label: 'Delete',
        onClick: async () => {
          await performDelete(invoiceId);
        }
      }
    });
  };

  const performDelete = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Deleted', 'Invoice deleted successfully');
        // Reload the invoices list
        loadInvoices();
      } else {
        toast.error('Delete Failed', `Failed to delete invoice: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Error', 'Failed to delete invoice');
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
    }
  };

  const batchDeleteInvoices = async () => {
    const selectedIds = Array.from(selectedInvoices);
    
    toast.addToast({
      type: 'warning',
      title: 'Delete Selected Invoices?',
      message: `This will delete ${selectedIds.length} invoice${selectedIds.length !== 1 ? 's' : ''}. This action cannot be undone.`,
      duration: 0,
      action: {
        label: 'Delete All',
        onClick: async () => {
          await performBatchDelete(selectedIds);
        }
      }
    });
  };

  const performBatchDelete = async (invoiceIds: string[]) => {
    try {
      const deletePromises = invoiceIds.map(id => 
        fetch(`/api/invoices/${id}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(result => ({ id, success: result.success, error: result.error }))
      );

      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        toast.success('Batch Delete Complete', `Successfully deleted ${successful.length} invoice${successful.length !== 1 ? 's' : ''}`);
      }
      
      if (failed.length > 0) {
        toast.error('Some Deletions Failed', `Failed to delete ${failed.length} invoice${failed.length !== 1 ? 's' : ''}`);
      }

      setSelectedInvoices(new Set());
      loadInvoices();
    } catch (error) {
      console.error('Error in batch delete:', error);
      toast.error('Batch Delete Failed', 'Failed to delete invoices. Please try again.');
    }
  };

  // Rectification functions
  const openRectificationModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setRectificationNotes(invoice.rectificationNotes || '');
    setResolutionType('');
    setResolutionValue('');
    setShowRectificationModal(true);
  };

  const closeRectificationModal = () => {
    setShowRectificationModal(false);
    setSelectedInvoice(null);
    setRectificationNotes('');
    setResolutionType('');
    setResolutionValue('');
  };

  const updateRectificationStatus = async (
    invoiceId: string,
    updates: {
      markContacted?: boolean;
      markResolved?: boolean;
      approveInvoice?: boolean;
      rectificationNotes?: string;
      resolutionType?: string;
      resolutionValue?: string;
    }
  ) => {
    try {
      setActionLoading(invoiceId);
      const response = await fetch(`/api/invoices/${invoiceId}/rectification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.success) {
        loadInvoices(); // Refresh the data
        if (updates.approveInvoice) {
          toast.success('Invoice Approved', 'Invoice approved and rectification resolved!');
        } else if (updates.markResolved) {
          toast.success('Issue Resolved', 'Rectification marked as resolved');
        } else if (updates.markContacted) {
          toast.success('Vendor Contacted', 'Vendor marked as contacted');
        }
      } else {
        toast.error('Update Failed', `Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating rectification:', error);
      toast.error('Update Failed', 'Failed to update rectification status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedInvoice) return;
    
    await updateRectificationStatus(selectedInvoice.id, {
      rectificationNotes,
    });
    closeRectificationModal();
  };

  const handleResolveIssue = async () => {
    if (!selectedInvoice) return;
    
    await updateRectificationStatus(selectedInvoice.id, {
      markResolved: true,
      rectificationNotes,
      resolutionType,
      resolutionValue,
    });
    closeRectificationModal();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Gradient style matching dashboard */}
        <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Invoice Management</h1>
                <p className="text-blue-100 text-lg">
                  Process and manage supplier invoices with AI vision technology
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  {pagination.total} invoices • {invoices?.filter(i => i.status === 'PARSED' || i.status === 'REVIEWED').length || 0} pending review
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-col items-end space-y-3">
                <div className="flex items-center space-x-3">
                  <Link href="/invoices/upload">
                    <Button className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm px-6 py-3 text-lg font-semibold">
                      <UploadIcon className="w-5 h-5 mr-2" />
                      Upload Invoice
                    </Button>
                  </Link>
                  {selectedInvoices.size > 0 && (
                    <Button 
                      onClick={batchDeleteInvoices}
                      className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-400/20 backdrop-blur-sm px-4 py-3 font-semibold"
                    >
                      <TrashIcon className="w-5 h-5 mr-2" />
                      Delete Selected ({selectedInvoices.size})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats - Gradient style matching dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Pending Review</p>
                  <p className="text-3xl font-bold">
                    {invoices?.filter(i => i.status === 'PARSED' || i.status === 'REVIEWED').length || 0}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Needs attention</p>
                </div>
                <AlertCircleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Approved</p>
                  <p className="text-3xl font-bold">
                    {invoices?.filter(i => i.status === 'APPROVED').length || 0}
                  </p>
                  <p className="text-sm opacity-75 mt-1">Ready to process</p>
                </div>
                <CheckCircleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Needs Fix notification card */}
          <Card className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0">
            <CardContent className="p-0">
              <button
                className="w-full p-6 text-left hover:bg-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                onClick={() => {
                  setFilters(prev => ({ ...prev, needsRectification: 'true' }));
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Needs Vendor Fix</p>
                    <p className="text-3xl font-bold">
                      {invoices?.filter(i => i.needsRectification && !i.rectificationResolvedAt).length || 0}
                    </p>
                    <p className="text-sm opacity-75 mt-1">Requires action</p>
                  </div>
                  <AlertCircleIcon className="w-12 h-12 opacity-50" />
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Processing Queue</p>
                  <p className="text-3xl font-bold">
                    {invoices?.filter(i => i.status === 'DRAFT' || i.status === 'PARSED').length || 0}
                  </p>
                  <p className="text-sm opacity-75 mt-1">In pipeline</p>
                </div>
                <CalendarIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FilterIcon className="w-5 h-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PARSED">Parsed</SelectItem>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rectification</label>
                <Select value={filters.needsRectification} onValueChange={(value) => handleFilterChange('needsRectification', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All invoices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All invoices</SelectItem>
                    <SelectItem value="true">Needs fix</SelectItem>
                    <SelectItem value="contacted">Vendor contacted</SelectItem>
                    <SelectItem value="resolved">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {!invoices || invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
                <p className="text-gray-600 mb-4">
                  Get started by uploading your first invoice for processing.
                </p>
                <Link href="/invoices/upload">
                  <Button>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Upload Invoice
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice.id)}
                            onChange={() => toggleInvoiceSelection(invoice.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.vendor.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            #{invoice.invoiceNumber || invoice.id.slice(0, 8) + '...'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(invoice.invoiceDate)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(invoice.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-2">
                            <Badge className={`inline-flex items-center space-x-1 ${STATUS_COLORS[invoice.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                              {getStatusIcon(invoice.status)}
                              <span className="capitalize">{invoice.status.toLowerCase()}</span>
                            </Badge>
                            
                            {/* Rectification Notification Badge */}
                            {invoice.needsRectification && (
                              <Badge className="inline-flex items-center space-x-1 bg-orange-100 text-orange-800 border border-orange-300">
                                <AlertCircleIcon className="w-3 h-3" />
                                <span className="text-xs">
                                  {invoice.rectificationResolvedAt ? 'Fixed' : 
                                   invoice.rectificationContactedAt ? 'Contacted' : 
                                   'Needs Fix'}
                                </span>
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.lineItemCount} items
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.totalIncGst)}
                          </div>
                          <div className="text-sm text-gray-500">
                            +{formatCurrency(invoice.gstAmount)} GST
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link href={`/invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm" title="View Invoice">
                                <EyeIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                            
                            {/* Rectification actions */}
                            {invoice.needsRectification && (
                              <>
                                {!invoice.rectificationContactedAt ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateRectificationStatus(invoice.id, { markContacted: true })}
                                    disabled={actionLoading === invoice.id}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Mark as contacted"
                                  >
                                    <PhoneIcon className="w-4 h-4" />
                                  </Button>
                                ) : !invoice.rectificationResolvedAt ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openRectificationModal(invoice)}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Resolve issue"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                  </Button>
                                ) : null}
                              </>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => deleteInvoice(invoice.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Invoice"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rectification Modal */}
      {showRectificationModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeRectificationModal}></div>
            <div className="relative bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium">
                    Resolve Issue - {selectedInvoice.vendor.name}
                  </h3>
                  <button
                    onClick={closeRectificationModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice
                    </label>
                    <p className="text-sm text-gray-900">
                      #{selectedInvoice.invoiceNumber || selectedInvoice.id.slice(0, 8) + '...'} - {formatCurrency(selectedInvoice.totalIncGst)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Missing Items
                    </label>
                    {selectedInvoice.missingItems && selectedInvoice.missingItems.length > 0 ? (
                      <ul className="text-sm text-gray-900 space-y-1">
                        {selectedInvoice.missingItems.map((item, index) => (
                          <li key={index} className="bg-red-50 px-2 py-1 rounded">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 italic">General rectification needed</p>
                    )}
                  </div>

                  {selectedInvoice.rectificationResolvedAt && selectedInvoice.resolutionType && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-800 mb-2">Resolution Details</h4>
                      <div className="text-sm text-green-700">
                        <p><strong>Type:</strong> {
                          selectedInvoice.resolutionType === 'resent_items' ? '📦 Items Re-shipped' :
                          selectedInvoice.resolutionType === 'credit_memo' ? '💳 Credit Memo Issued' :
                          selectedInvoice.resolutionType === 'partial_refund' ? '💰 Partial Refund' :
                          selectedInvoice.resolutionType === 'replacement_order' ? '🔄 Replacement Order' :
                          selectedInvoice.resolutionType === 'discount_applied' ? '💸 Discount Applied' :
                          '🔧 Other Resolution'
                        }</p>
                        {selectedInvoice.resolutionValue && (
                          <p><strong>Details:</strong> {selectedInvoice.resolutionValue}</p>
                        )}
                        <p className="text-xs text-green-600 mt-1">
                          Resolved on {new Date(selectedInvoice.rectificationResolvedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rectification Notes
                    </label>
                    <textarea
                      value={rectificationNotes}
                      onChange={(e) => setRectificationNotes(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Add notes about vendor contact, resolution details, etc..."
                    />
                  </div>

                  {selectedInvoice.rectificationContactedAt && !selectedInvoice.rectificationResolvedAt && (
                    <>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Resolution Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Resolution Type
                            </label>
                            <Select value={resolutionType} onValueChange={setResolutionType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select resolution type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="resent_items">Items Re-shipped</SelectItem>
                                <SelectItem value="credit_memo">Credit Memo Issued</SelectItem>
                                <SelectItem value="partial_refund">Partial Refund</SelectItem>
                                <SelectItem value="replacement_order">Replacement Order</SelectItem>
                                <SelectItem value="discount_applied">Discount Applied</SelectItem>
                                <SelectItem value="other">Other Resolution</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {resolutionType === 'credit_memo' || resolutionType === 'partial_refund' || resolutionType === 'discount_applied' 
                                ? 'Amount ($)' 
                                : 'Reference/Details'}
                            </label>
                            <input
                              type={resolutionType === 'credit_memo' || resolutionType === 'partial_refund' || resolutionType === 'discount_applied' 
                                ? 'number' : 'text'}
                              value={resolutionValue}
                              onChange={(e) => setResolutionValue(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                              placeholder={resolutionType === 'credit_memo' || resolutionType === 'partial_refund' || resolutionType === 'discount_applied'
                                ? '0.00' 
                                : 'Reference number, tracking ID, etc.'}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={closeRectificationModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    
                    {selectedInvoice.rectificationContactedAt && !selectedInvoice.rectificationResolvedAt && (
                      <button
                        onClick={handleResolveIssue}
                        disabled={!resolutionType || actionLoading === selectedInvoice.id}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
                      >
                        Mark Resolved
                      </button>
                    )}
                    
                    <button
                      onClick={handleSaveNotes}
                      disabled={actionLoading === selectedInvoice.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}