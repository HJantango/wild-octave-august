'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  AlertTriangleIcon, 
  PhoneIcon,
  ClockIcon,
  EyeIcon,
  CheckIcon,
  XIcon
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/pricing';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalIncGst: number;
  missingItems: string[];
  needsRectification: boolean;
  rectificationNotes: string;
  rectificationContactedAt: string | null;
  rectificationResolvedAt: string | null;
  resolutionType: string | null;
  resolutionValue: string | null;
  status: string;
  vendor: {
    id: string;
    name: string;
    contactInfo?: {
      email?: string;
      phone?: string;
    };
  };
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCostExGst: number;
  }>;
}

interface RectificationData {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    unresolved: number;
    uncontacted: number;
    byVendor: Array<{
      vendorId: string;
      count: number;
      vendor: { name: string };
    }>;
  };
}

export default function RectificationPage() {
  const [data, setData] = useState<RectificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    resolved: undefined as boolean | undefined,
    contacted: undefined as boolean | undefined,
    vendorId: undefined as string | undefined,
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rectificationNotes, setRectificationNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionValue, setResolutionValue] = useState('');

  useEffect(() => {
    fetchRectificationData();
  }, [filter]);

  const fetchRectificationData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.resolved !== undefined) params.append('resolved', filter.resolved.toString());
      if (filter.contacted !== undefined) params.append('contacted', filter.contacted.toString());
      if (filter.vendorId) params.append('vendorId', filter.vendorId);

      const response = await fetch(`/api/invoices/rectification?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        console.error('Failed to fetch rectification data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching rectification data:', error);
    } finally {
      setLoading(false);
    }
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
        fetchRectificationData(); // Refresh the data
        if (updates.approveInvoice) {
          alert('Invoice approved and rectification resolved!');
        }
      } else {
        alert(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating rectification:', error);
      alert('Failed to update rectification status');
    } finally {
      setActionLoading(null);
    }
  };

  const openModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setRectificationNotes(invoice.rectificationNotes || '');
    setResolutionType('');
    setResolutionValue('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInvoice(null);
    setRectificationNotes('');
    setResolutionType('');
    setResolutionValue('');
  };

  const handleSaveNotes = async () => {
    if (!selectedInvoice) return;
    
    await updateRectificationStatus(selectedInvoice.id, {
      rectificationNotes,
    });
    closeModal();
  };

  const handleResolveIssue = async () => {
    if (!selectedInvoice) return;
    
    await updateRectificationStatus(selectedInvoice.id, {
      markResolved: true,
      rectificationNotes,
      resolutionType,
      resolutionValue,
    });
    closeModal();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Failed to load rectification data</div>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.rectificationResolvedAt) {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Resolved
          </span>
          {invoice.resolutionType && (
            <div className="text-xs text-gray-600">
              {invoice.resolutionType === 'resent_items' && '📦 Items Re-shipped'}
              {invoice.resolutionType === 'credit_memo' && '💳 Credit Memo'}
              {invoice.resolutionType === 'partial_refund' && '💰 Partial Refund'}
              {invoice.resolutionType === 'replacement_order' && '🔄 Replacement Order'}
              {invoice.resolutionType === 'discount_applied' && '💸 Discount Applied'}
              {invoice.resolutionType === 'other' && '🔧 Other Resolution'}
              {invoice.resolutionValue && ` (${invoice.resolutionValue})`}
            </div>
          )}
        </div>
      );
    }
    if (invoice.rectificationContactedAt) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <PhoneIcon className="w-4 h-4 mr-1" />
          Contacted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangleIcon className="w-4 h-4 mr-1" />
        Needs Contact
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Gradient style matching dashboard */}
        <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Missing Items Rectification</h1>
                <p className="text-orange-100 text-lg">
                  Track and resolve vendor invoice discrepancies
                </p>
                <p className="text-orange-200 text-sm mt-1">
                  {data?.summary.total} total issues • {data?.summary.unresolved} unresolved • {data?.summary.uncontacted} not contacted
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary Stats - Gradient style matching dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Total Issues</p>
                  <p className="text-2xl font-bold">{data.summary.total}</p>
                  <p className="text-red-100 text-xs mt-1">Requiring attention</p>
                </div>
                <AlertTriangleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Not Contacted</p>
                  <p className="text-2xl font-bold">{data.summary.uncontacted}</p>
                  <p className="text-orange-100 text-xs mt-1">Awaiting contact</p>
                </div>
                <ClockIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Contacted</p>
                  <p className="text-2xl font-bold">
                    {data.summary.total - data.summary.unresolved - data.summary.uncontacted}
                  </p>
                  <p className="text-blue-100 text-xs mt-1">Vendor notified</p>
                </div>
                <PhoneIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Resolved</p>
                  <p className="text-2xl font-bold">
                    {data.summary.total - data.summary.unresolved}
                  </p>
                  <p className="text-green-100 text-xs mt-1">Complete</p>
                </div>
                <CheckCircleIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🔍</span>
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select 
                  value={filter.resolved === undefined ? 'all' : filter.resolved ? 'true' : 'false'}
                  onValueChange={(value) => setFilter(prev => ({
                    ...prev,
                    resolved: value === 'all' ? undefined : value === 'true'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="false">Unresolved</SelectItem>
                    <SelectItem value="true">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Status</label>
                <Select 
                  value={filter.contacted === undefined ? 'all' : filter.contacted ? 'true' : 'false'}
                  onValueChange={(value) => setFilter(prev => ({
                    ...prev,
                    contacted: value === 'all' ? undefined : value === 'true'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Contact Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contact Status</SelectItem>
                    <SelectItem value="false">Not Contacted</SelectItem>
                    <SelectItem value="true">Contacted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => setFilter({ resolved: undefined, contacted: undefined, vendorId: undefined })}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span>
              <span>Rectification Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Missing Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber || `Invoice ${invoice.id.slice(-8)}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{invoice.vendor.name}</div>
                    {invoice.vendor.contactInfo?.email && (
                      <div className="text-sm text-gray-500">{invoice.vendor.contactInfo.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {invoice.missingItems && invoice.missingItems.length > 0 ? (
                        <div className="space-y-1">
                          {invoice.missingItems.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-xs bg-red-50 px-2 py-1 rounded">{item}</div>
                          ))}
                          {invoice.missingItems.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{invoice.missingItems.length - 2} more items
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">General rectification needed</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(Number(invoice.totalIncGst))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openModal(invoice)}
                      className="text-purple-600 hover:text-purple-900"
                      title="View details"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    
                    {!invoice.rectificationContactedAt && (
                      <button
                        onClick={() => updateRectificationStatus(invoice.id, { markContacted: true })}
                        disabled={actionLoading === invoice.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        title="Mark as contacted"
                      >
                        <PhoneIcon className="w-5 h-5" />
                      </button>
                    )}
                    
                    {invoice.rectificationContactedAt && !invoice.rectificationResolvedAt && (
                      <button
                        onClick={() => updateRectificationStatus(invoice.id, { markResolved: true })}
                        disabled={actionLoading === invoice.id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        title="Mark as resolved"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                    )}
                    
                    {invoice.rectificationResolvedAt && invoice.status !== 'APPROVED' && (
                      <button
                        onClick={() => updateRectificationStatus(invoice.id, { 
                          approveInvoice: true, 
                          markResolved: true 
                        })}
                        disabled={actionLoading === invoice.id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 px-3 py-1 bg-green-50 rounded text-xs"
                        title="Approve invoice"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            </div>
            
            {data.invoices.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No rectification issues</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All invoices are properly received or resolved.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Modal */}
      {showModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeModal}></div>
            <div className="relative bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium">
                    Invoice {selectedInvoice.invoiceNumber || selectedInvoice.id.slice(-8)}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor
                    </label>
                    <p className="text-sm text-gray-900">{selectedInvoice.vendor.name}</p>
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
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    
                    {selectedInvoice.rectificationContactedAt && !selectedInvoice.rectificationResolvedAt && (
                      <button
                        onClick={handleResolveIssue}
                        disabled={!resolutionType}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
                      >
                        Mark Resolved
                      </button>
                    )}
                    
                    <button
                      onClick={handleSaveNotes}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md"
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
      </div>
    </DashboardLayout>
  );
}