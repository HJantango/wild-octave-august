'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useState } from 'react';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendor: {
    id: string;
    name: string;
    contactInfo?: {
      email?: string;
      phone?: string;
      address?: string;
      contactPerson?: string;
    };
    paymentTerms?: string;
  };
  status: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  subtotalExGst: number;
  gstAmount: number;
  totalIncGst: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCostExGst: number;
    totalCostExGst: number;
    notes?: string;
    item?: {
      id: string;
      name: string;
      category: string;
      sku?: string;
    };
  }>;
  linkedInvoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
  };
}

async function fetchPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await fetch(`/api/purchase-orders/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch purchase order');
  }
  return response.json();
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-purple-100 text-purple-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedLineItems, setEditedLineItems] = useState<PurchaseOrder['lineItems']>([]);

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => fetchPurchaseOrder(id),
  });

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editedNotes }),
      });

      if (response.ok) {
        await refetch();
        setIsEditingNotes(false);
      }
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  const handleEditNotes = () => {
    setEditedNotes(order?.notes || '');
    setIsEditingNotes(true);
  };

  const handleEdit = () => {
    if (!order) return;

    // Enhanced confirmation for non-DRAFT orders
    if (order.status !== 'DRAFT') {
      const confirmMessage = `⚠️ WARNING: This purchase order is ${order.status.replace(/_/g, ' ')}!\n\n` +
        `Editing order: ${order.orderNumber}\n\n` +
        `This purchase order may have already been:\n` +
        `- Sent to the vendor\n` +
        `- Acknowledged or processed\n` +
        `- Linked to invoices\n\n` +
        `Changes may cause confusion or discrepancies.\n\n` +
        `Are you sure you want to edit this order?`;

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    setEditedLineItems(JSON.parse(JSON.stringify(order.lineItems))); // Deep copy
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedLineItems([]);
  };

  const handleSaveEdit = async () => {
    if (!order) return;

    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: editedLineItems.map(item => ({
            id: item.id,
            itemId: item.item?.id,
            name: item.name,
            quantity: item.quantity,
            unitCostExGst: item.unitCostExGst,
            notes: item.notes,
          })),
        }),
      });

      if (response.ok) {
        await refetch();
        setIsEditing(false);
        setEditedLineItems([]);
        alert('Purchase order updated successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update purchase order');
      }
    } catch (error) {
      console.error('Failed to update purchase order:', error);
      alert('Failed to update purchase order');
    }
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const newLineItems = [...editedLineItems];
    newLineItems[index] = {
      ...newLineItems[index],
      [field]: value,
    };
    setEditedLineItems(newLineItems);
  };

  const handleAddLineItem = () => {
    setEditedLineItems([
      ...editedLineItems,
      {
        id: `temp-${Date.now()}`,
        name: '',
        quantity: 1,
        unitCostExGst: 0,
        totalCostExGst: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    const newLineItems = editedLineItems.filter((_, i) => i !== index);
    setEditedLineItems(newLineItems);
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this purchase order? This will change the status from DRAFT to APPROVED.')) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-orders/${id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        await refetch();
        alert('Purchase order approved successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve purchase order');
      }
    } catch (error) {
      console.error('Failed to approve purchase order:', error);
      alert('Failed to approve purchase order');
    }
  };

  const handleDelete = async () => {
    if (!order) return;

    // Enhanced confirmation for non-DRAFT orders
    let confirmMessage = `Are you sure you want to delete purchase order ${order.orderNumber}?`;

    if (order.status !== 'DRAFT') {
      confirmMessage = `⚠️ WARNING: This purchase order is ${order.status.replace(/_/g, ' ')}!\n\n` +
        `Deleting order: ${order.orderNumber}\n\n` +
        `This action CANNOT be undone and may affect:\n` +
        `- Vendor communications\n` +
        `- Linked invoices\n` +
        `- Inventory records\n\n` +
        `Are you ABSOLUTELY SURE you want to delete this order?`;
    } else {
      confirmMessage = `Are you sure you want to delete DRAFT purchase order ${order.orderNumber}?\n\nThis action cannot be undone.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    // Second confirmation for non-DRAFT orders
    if (order.status !== 'DRAFT') {
      if (!confirm(`FINAL CONFIRMATION: Delete ${order.orderNumber}?\n\nType your confirmation by clicking OK.`)) {
        return;
      }
    }

    try {
      const response = await fetch(`/api/purchase-orders/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert(`Purchase order ${order.orderNumber} deleted successfully`);
        router.push('/ordering/purchase-orders');
      } else {
        const error = await response.json();
        alert(`Failed to delete purchase order: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      alert('Failed to delete purchase order');
    }
  };

  // Filter out auto-generated notes
  const isAutoGeneratedNote = (note: string) => {
    return note.includes('Created from 6-week sales analysis') ||
           note.includes('Order frequency:');
  };

  const getUserNotes = () => {
    if (!order?.notes) return '';
    return isAutoGeneratedNote(order.notes) ? '' : order.notes;
  };

  const handleExportPDF = (showPrices: boolean = true) => {
    if (!order) return;

    const userNotes = getUserNotes();

    // Create a new window with print-friendly content
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${order.orderNumber}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 9pt;
              line-height: 1.3;
              color: #000;
              max-width: 100%;
              margin: 0;
              padding: 0;
            }
            .company-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #2c5f2d;
            }
            .company-logo {
              max-width: 120px;
              height: auto;
            }
            .company-details {
              text-align: right;
              font-size: 8pt;
              line-height: 1.4;
            }
            .company-name {
              font-weight: bold;
              font-size: 10pt;
              color: #2c5f2d;
              margin-bottom: 4px;
            }
            .po-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              padding-bottom: 6px;
              border-bottom: 1px solid #ddd;
            }
            .po-header h1 {
              margin: 0;
              font-size: 16pt;
              color: #2c5f2d;
            }
            .po-header .meta {
              font-size: 8pt;
              color: #666;
              text-align: right;
            }
            .info-section {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 12px;
              font-size: 8pt;
            }
            .info-block {
              background: #f9f9f9;
              padding: 6px;
              border-left: 2px solid #2c5f2d;
            }
            .info-block .label {
              font-weight: bold;
              color: #666;
              margin-bottom: 2px;
              font-size: 7pt;
              text-transform: uppercase;
            }
            .info-block .value {
              font-size: 8pt;
              line-height: 1.3;
            }
            .notes {
              background: #fff9e6;
              padding: 6px;
              margin-bottom: 10px;
              border-left: 3px solid #ffc107;
              font-size: 8pt;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
            }
            th, td {
              padding: 4px 6px;
              text-align: left;
            }
            th {
              background: #2c5f2d;
              color: white;
              font-weight: bold;
              font-size: 8pt;
              text-transform: uppercase;
              border-bottom: 1px solid #e0e0e0;
            }
            td {
              font-size: 8pt;
              vertical-align: top;
            }
            .item-name {
              font-weight: 600;
              color: #000;
            }
            .text-right { text-align: right; }
            .totals {
              margin-left: auto;
              width: 250px;
              margin-top: 8px;
            }
            .totals td {
              padding: 3px 6px;
              border: none;
            }
            .totals tr:last-child {
              font-weight: bold;
              font-size: 10pt;
              border-top: 2px solid #000;
            }
            .totals tr:last-child td {
              padding-top: 6px;
            }
            .footer {
              margin-top: 15px;
              padding-top: 8px;
              border-top: 1px solid #ddd;
              font-size: 7pt;
              color: #999;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="company-header">
            <div>
              <img src="/wild-octave-new-logo.png" alt="Wild Octave Organics" class="company-logo" />
            </div>
            <div class="company-details">
              <div class="company-name">Wild Octave Organics</div>
              <div>2/20 Fingal Street, Brunswick Heads NSW 2487</div>
              <div>Ph: 02 5642 0309 | Email: admin@wildoctave.au</div>
              <div>ABN: 24 67 148 140</div>
            </div>
          </div>

          <div class="po-header">
            <div>
              <h1>PURCHASE ORDER</h1>
              <div style="font-size: 12pt; font-weight: bold; color: #2c5f2d; margin-top: 2px;">${order.orderNumber}</div>
            </div>
            <div class="meta">
              <div><strong>Status:</strong> ${order.status.replace(/_/g, ' ')}</div>
              <div><strong>Created:</strong> ${new Date(order.createdAt).toLocaleDateString()}</div>
              ${order.orderDate ? `<div><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</div>` : ''}
            </div>
          </div>

          <div class="info-section">
            <div class="info-block">
              <div class="label">Vendor</div>
              <div class="value">
                <div style="font-weight: bold; font-size: 9pt;">${order.vendor.name}</div>
                ${order.vendor.contactInfo?.contactPerson ? `<div>Attn: ${order.vendor.contactInfo.contactPerson}</div>` : ''}
                ${order.vendor.contactInfo?.address ? `<div>${order.vendor.contactInfo.address.replace(/\n/g, ', ')}</div>` : ''}
                ${order.vendor.contactInfo?.phone ? `<div>Ph: ${order.vendor.contactInfo.phone}</div>` : ''}
                ${order.vendor.contactInfo?.email ? `<div>${order.vendor.contactInfo.email}</div>` : ''}
                ${order.vendor.paymentTerms ? `<div style="margin-top: 4px; font-size: 7pt; color: #666;">Terms: ${order.vendor.paymentTerms}</div>` : ''}
              </div>
            </div>
            ${order.expectedDeliveryDate ? `
            <div class="info-block">
              <div class="label">Expected Delivery</div>
              <div class="value" style="font-weight: bold;">${new Date(order.expectedDeliveryDate).toLocaleDateString()}</div>
            </div>
            ` : '<div class="info-block"></div>'}
            <div class="info-block">
              <div class="label">Items</div>
              <div class="value" style="font-weight: bold; font-size: 11pt;">${order.lineItems.length}</div>
            </div>
          </div>

          ${userNotes ? `
            <div class="notes">
              <strong style="font-size: 7pt; text-transform: uppercase; color: #666;">Notes:</strong> ${userNotes.replace(/\n/g, ' ')}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">SKU/Code</th>
                <th style="width: ${showPrices ? '38%' : '73%'};">Item</th>
                <th class="text-right" style="width: 15%;">Qty</th>
                ${showPrices ? '<th class="text-right" style="width: 17.5%;">Unit Cost</th>' : ''}
                ${showPrices ? '<th class="text-right" style="width: 17.5%;">Total</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${order.lineItems.map(item => `
                <tr>
                  <td style="font-family: monospace; font-size: 7pt;">${item.item?.sku || '-'}</td>
                  <td>
                    <div class="item-name">${item.name}</div>
                  </td>
                  <td class="text-right">${item.quantity}</td>
                  ${showPrices ? `<td class="text-right">${formatCurrency(item.unitCostExGst)}</td>` : ''}
                  ${showPrices ? `<td class="text-right">${formatCurrency(item.totalCostExGst)}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${showPrices ? `
          <table class="totals">
            <tr>
              <td>Subtotal (ex GST):</td>
              <td class="text-right">${formatCurrency(order.subtotalExGst)}</td>
            </tr>
            <tr>
              <td>GST (10%):</td>
              <td class="text-right">${formatCurrency(order.gstAmount)}</td>
            </tr>
            <tr>
              <td><strong>Total (inc GST):</strong></td>
              <td class="text-right"><strong>${formatCurrency(order.totalIncGst)}</strong></td>
            </tr>
          </table>
          ` : ''}

          <div class="footer">
            Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Wild Octave Organics Order Management System
          </div>

          <div class="no-print" style="text-align: center; margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
            <button onclick="window.print()" style="padding: 10px 24px; font-size: 11pt; cursor: pointer; background: #2c5f2d; color: white; border: none; border-radius: 4px; margin-right: 8px;">🖨️ Print / Save as PDF</button>
            <button onclick="window.close()" style="padding: 10px 24px; font-size: 11pt; cursor: pointer; background: #666; color: white; border: none; border-radius: 4px;">✕ Close</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportSquare = () => {
    if (!order) return;

    // Build CSV content in Square format - just headers and data
    const csvRows: string[][] = [];

    // Line items header - exact column names as Square expects
    csvRows.push(['Item name', 'Variation name', 'SKU', 'GTIN', 'Vendor code', 'Notes', 'Quantity', 'Unit cost']);

    // Line items data
    order.lineItems.forEach(item => {
      csvRows.push([
        item.name,
        '', // Variation name - empty
        item.item?.sku || '', // SKU
        '', // GTIN - empty
        '', // Vendor code - empty
        item.notes || '', // Notes
        item.quantity.toString(),
        item.unitCostExGst.toString()
      ]);
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row =>
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',')
    ).join('\r\n'); // Use Windows line endings for better compatibility

    // Add UTF-8 BOM for proper Excel/Square compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create and download file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${order.orderNumber}_square_import.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading purchase order...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-red-500 mb-4">Failed to load purchase order</div>
          <Link href="/ordering/purchase-orders">
            <Button>Back to Purchase Orders</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <Link href="/ordering/purchase-orders">
                <Button variant="outline" size="sm">← Back</Button>
              </Link>
              <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
              <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                {order.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">
              Created {new Date(order.createdAt).toLocaleDateString()}
              {order.createdBy && ` by ${order.createdBy}`}
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <>
                <Button
                  onClick={handleEdit}
                  variant="outline"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700"
                >
                  ✏️ Edit Purchase Order
                </Button>
                {order.status === 'DRAFT' && (
                  <Button
                    onClick={handleApprove}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    ✓ Approve Purchase Order
                  </Button>
                )}
                <Button
                  onClick={handleDelete}
                  variant="outline"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  🗑️ Delete
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  onClick={handleSaveEdit}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  💾 Save Changes
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  className="bg-red-50 hover:bg-red-100 text-red-700"
                >
                  ✕ Cancel
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => handleExportPDF(true)}>
              📄 Export PDF (with prices)
            </Button>
            <Button variant="outline" onClick={() => handleExportPDF(false)}>
              📋 Export PDF (simple)
            </Button>
            <Button variant="outline" onClick={handleExportSquare} className="bg-blue-50 hover:bg-blue-100 text-blue-700">
              🟦 Export to Square
            </Button>
            <Button variant="outline">
              📧 Email Vendor
            </Button>
          </div>
        </div>

        {/* Vendor Info */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-500">Vendor Name</div>
                <Link href={`/vendors/${order.vendor.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-lg">
                  {order.vendor.name}
                </Link>
              </div>
              {order.vendor.contactInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                  {order.vendor.contactInfo.contactPerson && (
                    <div>
                      <div className="text-sm font-medium text-gray-500">Contact Person</div>
                      <div className="text-gray-900">{order.vendor.contactInfo.contactPerson}</div>
                    </div>
                  )}
                  {order.vendor.contactInfo.email && (
                    <div>
                      <div className="text-sm font-medium text-gray-500">Email</div>
                      <a href={`mailto:${order.vendor.contactInfo.email}`} className="text-blue-600 hover:text-blue-700">
                        {order.vendor.contactInfo.email}
                      </a>
                    </div>
                  )}
                  {order.vendor.contactInfo.phone && (
                    <div>
                      <div className="text-sm font-medium text-gray-500">Phone</div>
                      <a href={`tel:${order.vendor.contactInfo.phone}`} className="text-blue-600 hover:text-blue-700">
                        {order.vendor.contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {order.vendor.contactInfo.address && (
                    <div>
                      <div className="text-sm font-medium text-gray-500">Address</div>
                      <div className="text-gray-900 whitespace-pre-line">{order.vendor.contactInfo.address}</div>
                    </div>
                  )}
                </div>
              )}
              {order.vendor.paymentTerms && (
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium text-gray-500">Payment Terms</div>
                  <div className="text-gray-900">{order.vendor.paymentTerms}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                {order.status.replace(/_/g, ' ')}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Order Date</CardTitle>
            </CardHeader>
            <CardContent>
              {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'Not set'}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Expected Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : 'Not set'}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notes</CardTitle>
            {!isEditingNotes && (
              <Button variant="outline" size="sm" onClick={handleEditNotes}>
                ✏️ Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full min-h-[100px] p-2 border rounded-md"
                  placeholder="Add notes for this purchase order..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNotes} size="sm">
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingNotes(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">
                {getUserNotes() || <span className="text-gray-400 italic">No notes added yet. Click Edit to add notes.</span>}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Order Items ({isEditing ? editedLineItems.length : order.lineItems.length})</CardTitle>
              {isEditing && (
                <Button onClick={handleAddLineItem} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Add Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Item Name</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Unit Cost (ex GST)</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total (ex GST)</th>
                    {isEditing && <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {!isEditing && order.lineItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.item?.sku && (
                            <div className="text-sm text-gray-500 font-mono">Vendor Code: {item.item.sku}</div>
                          )}
                          {item.notes && (
                            <div className="text-xs text-gray-400 mt-1">{item.notes}</div>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">{item.quantity}</td>
                      <td className="text-right py-3 px-4">{formatCurrency(item.unitCostExGst)}</td>
                      <td className="text-right py-3 px-4 font-medium">{formatCurrency(item.totalCostExGst)}</td>
                    </tr>
                  ))}
                  {isEditing && editedLineItems.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleLineItemChange(index, 'name', e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                          placeholder="Item name"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)}
                          className="w-full px-2 py-1 border rounded mt-1 text-sm"
                          placeholder="Notes (optional)"
                        />
                      </td>
                      <td className="text-right py-3 px-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded text-right"
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="text-right py-3 px-4">
                        <input
                          type="number"
                          value={item.unitCostExGst}
                          onChange={(e) => handleLineItemChange(index, 'unitCostExGst', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border rounded text-right"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="text-right py-3 px-4 font-medium">
                        {formatCurrency(item.quantity * item.unitCostExGst)}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Button
                          onClick={() => handleRemoveLineItem(index)}
                          variant="outline"
                          size="sm"
                          className="bg-red-50 hover:bg-red-100 text-red-700"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const lineItems = isEditing ? editedLineItems : order.lineItems;
                    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitCostExGst), 0);
                    const gst = subtotal * 0.1;
                    const total = subtotal + gst;
                    return (
                      <>
                        <tr className="border-t-2">
                          <td colSpan={isEditing ? 4 : 3} className="text-right py-3 px-4 font-semibold">Subtotal (ex GST):</td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCurrency(subtotal)}</td>
                          {isEditing && <td></td>}
                        </tr>
                        <tr>
                          <td colSpan={isEditing ? 4 : 3} className="text-right py-3 px-4 font-semibold">GST:</td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCurrency(gst)}</td>
                          {isEditing && <td></td>}
                        </tr>
                        <tr className="bg-gray-50">
                          <td colSpan={isEditing ? 4 : 3} className="text-right py-3 px-4 font-bold text-lg">Total (inc GST):</td>
                          <td className="text-right py-3 px-4 font-bold text-lg">{formatCurrency(total)}</td>
                          {isEditing && <td></td>}
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Linked Invoice */}
        {order.linkedInvoice && (
          <Card>
            <CardHeader>
              <CardTitle>Linked Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/invoices/${order.linkedInvoice.id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                {order.linkedInvoice.invoiceNumber}
              </Link>
              <Badge className="ml-2">{order.linkedInvoice.status}</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
