// src/app/invoices/[id]/review/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertCircle, ArrowUpRight, Eye, Loader2 } from 'lucide-react';

interface LineItem {
  id: string;
  itemDescription: string;
  quantity: number;
  unitType: string;
  invoiceCost: number;    // Original cost from invoice (e.g. $63.05 for a 6-pack)
  unitCostExGst: number;  // Effective per-unit cost (invoiceCost ÷ packSize)
  packSize: number;
  category: string;
  hasGst: boolean;
  confidence?: number;
  validationFlags?: string[];
  rawQuantityText?: string;
}

interface Correction {
  itemId: string;
  field: string;
  original: any;
  corrected: any;
  reason?: string;
}

export default function InvoiceReviewPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  
  // Square integration state
  const [squarePreview, setSquarePreview] = useState<any>(null);
  const [showSquarePreview, setShowSquarePreview] = useState(false);
  const [squareLoading, setSquareLoading] = useState(false);
  const [squareApplying, setSquareApplying] = useState(false);
  const [squareResult, setSquareResult] = useState<any>(null);

  useEffect(() => {
    fetchInvoiceData();
  }, [invoiceId]);

  const fetchInvoiceData = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const json = await res.json();
      const data = json.data || json;
      
      if (data) {
        setInvoice(data);
        // Map lineItems from DB schema to the format the review UI expects
        const lineItems = (data.lineItems || []).map((li: any) => ({
          id: li.id,
          itemDescription: li.name || li.itemDescription || '',
          quantity: parseFloat(li.quantity) || 1,
          unitType: li.unitType || 'unit',
          invoiceCost: parseFloat(li.unitCostExGst) || 0,
          unitCostExGst: (li.detectedPackSize && li.detectedPackSize > 1)
            ? (parseFloat(li.unitCostExGst) || 0) / li.detectedPackSize
            : (parseFloat(li.unitCostExGst) || 0),
          packSize: li.detectedPackSize || 1,
          category: li.category || 'Groceries',
          hasGst: li.hasGst ?? false,
          confidence: li.needsValidation ? 0.6 : 0.9,
          validationFlags: li.validationFlags || [],
          rawQuantityText: li.originalParsedData?.quantity?.toString(),
        }));
        setItems(lineItems);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setLoading(false);
    }
  };

  const handleFieldChange = (
    itemIndex: number, 
    field: string, 
    value: any,
    reason?: string
  ) => {
    const item = items[itemIndex];
    const original = item[field as keyof LineItem];
    
    // Update item
    const newItems = [...items];
    const updatedItem = { ...item, [field]: value };
    
    // When pack size changes, recalculate effective unit cost
    if (field === 'packSize') {
      updatedItem.unitCostExGst = updatedItem.invoiceCost / value;
    }
    // When invoice cost changes, recalculate effective unit cost
    if (field === 'invoiceCost') {
      updatedItem.unitCostExGst = value / updatedItem.packSize;
    }
    
    newItems[itemIndex] = updatedItem;
    setItems(newItems);

    // Track correction if value changed
    if (original !== value) {
      const correction: Correction = {
        itemId: item.id,
        field,
        original,
        corrected: value,
        reason
      };

      // Remove any existing correction for this field
      const newCorrections = corrections.filter(
        c => !(c.itemId === item.id && c.field === field)
      );
      newCorrections.push(correction);
      setCorrections(newCorrections);
    }
  };

  const handleSquarePreview = async () => {
    setSquareLoading(true);
    setSquareResult(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/square-preview`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSquarePreview(data.data.preview);
        setShowSquarePreview(true);
      } else {
        alert(`Preview failed: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to connect to Square');
    } finally {
      setSquareLoading(false);
    }
  };

  const handleSquareApply = async () => {
    if (!squarePreview?.changes) return;
    
    const actionable = squarePreview.changes.filter(
      (c: any) => c.action === 'UPDATE_PRICE' || c.action === 'CREATE'
    );
    
    if (actionable.length === 0) {
      alert('No changes to apply');
      return;
    }

    if (!confirm(`Apply ${actionable.length} changes to Square? This will update your live POS.`)) {
      return;
    }

    setSquareApplying(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/square-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: actionable }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSquareResult(data.data.result);
        alert(`✅ Applied ${data.data.result.summary.succeeded} changes to Square!`);
      } else {
        alert(`Apply failed: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to apply changes to Square');
    } finally {
      setSquareApplying(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/process`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrections,
          approvedItems: items
        })
      });

      if (response.ok) {
        router.push(`/invoices/${invoiceId}`);
      } else {
        alert('Error saving changes');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Error saving changes');
    }
    setSaving(false);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => 
      sum + (item.quantity * item.invoiceCost), 0
    );
    const gst = items
      .filter(item => item.hasGst)
      .reduce((sum, item) => 
        sum + (item.quantity * item.invoiceCost * 0.1), 0
      );
    return { subtotal, gst, total: subtotal + gst };
  };

  if (loading) return <div>Loading invoice...</div>;

  const flaggedItems = items.filter(
    item => (item.confidence || 1) < 0.8 || item.validationFlags?.length
  );
  const totals = calculateTotals();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Review Invoice</h1>
        <div className="flex gap-4 items-center">
          <Badge variant="outline">
            {invoice?.vendor?.name || 'Unknown Vendor'}
          </Badge>
          <Badge variant="outline">
            Invoice #{invoice?.invoiceNumber}
          </Badge>
          <Badge variant={flaggedItems.length > 0 ? 'destructive' : 'default'}>
            {flaggedItems.length} items need review
          </Badge>
        </div>
      </div>

      {flaggedItems.length > 0 && (
        <Alert className="mb-6 bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Items need your attention:</strong> Some quantities were extracted from 
            pack sizes in descriptions, and some GST values may need verification. 
            Please review highlighted items carefully.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setShowHelp(!showHelp)}
        >
          {showHelp ? 'Hide' : 'Show'} Help
        </Button>
        <div className="text-sm text-gray-600">
          {corrections.length} corrections made
        </div>
      </div>

      {showHelp && (
        <Card className="mb-6 bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Common Issues to Check:</h3>
            <ul className="space-y-1 text-sm">
              <li>• <strong>Quantity:</strong> Check if the number is from the QTY column, not from pack sizes like "(12)" in descriptions</li>
              <li>• <strong>Bulk Items:</strong> For items sold by weight (kg) or volume (L), verify the total amount</li>
              <li>• <strong>GST:</strong> Check if the GST column has a value or is $0.00</li>
              <li>• <strong>Unit Cost:</strong> Should be the price per single unit, not the total</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium">
                  <th className="p-2">Description</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Pack</th>
                  <th className="p-2">Unit</th>
                  <th className="p-2">Invoice Cost</th>
                  <th className="p-2">GST</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Line Total</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const needsReview = (item.confidence || 1) < 0.8 || 
                    item.validationFlags?.length;
                  const lineTotal = item.quantity * item.invoiceCost;
                  
                  return (
                    <tr 
                      key={index}
                      className={`border-b ${needsReview ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="p-2">
                        <Input
                          value={item.itemDescription}
                          onChange={(e) => handleFieldChange(
                            index, 'itemDescription', e.target.value
                          )}
                          className="w-full"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleFieldChange(
                            index, 'quantity', parseFloat(e.target.value)
                          )}
                          className={`w-20 ${
                            item.validationFlags?.includes('possible_default_quantity') 
                              ? 'border-yellow-400' : ''
                          }`}
                        />
                        {item.rawQuantityText && item.rawQuantityText !== String(item.quantity) && (
                          <div className="text-xs text-gray-500 mt-1">
                            Raw: {item.rawQuantityText}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.packSize}
                          onChange={(e) => handleFieldChange(
                            index, 'packSize', Math.max(1, parseInt(e.target.value) || 1)
                          )}
                          className="w-16"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.unitType}
                          onChange={(e) => handleFieldChange(
                            index, 'unitType', e.target.value
                          )}
                          className="w-full border rounded px-2 py-1"
                        >
                          <option value="unit">Unit</option>
                          <option value="kg">kg</option>
                          <option value="litre">L</option>
                          <option value="each">Each</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.invoiceCost}
                          onChange={(e) => handleFieldChange(
                            index, 'invoiceCost', parseFloat(e.target.value) || 0
                          )}
                          className="w-24"
                        />
                        {item.packSize > 1 && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ÷{item.packSize} = ${item.unitCostExGst.toFixed(2)}/unit
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <select
                          value={item.hasGst ? 'yes' : 'no'}
                          onChange={(e) => handleFieldChange(
                            index, 'hasGst', e.target.value === 'yes'
                          )}
                          className="w-full border rounded px-2 py-1"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={item.category}
                          onChange={(e) => handleFieldChange(
                            index, 'category', e.target.value
                          )}
                          className="w-full border rounded px-2 py-1"
                        >
                          <option value="Groceries">Groceries</option>
                          <option value="Bulk">Bulk</option>
                          <option value="House">House</option>
                          <option value="Personal Care">Personal Care</option>
                          <option value="Supplements">Supplements</option>
                          <option value="Fruit & Veg">Fruit & Veg</option>
                          <option value="Fridge & Freezer">Fridge & Freezer</option>
                          <option value="Drinks Fridge">Drinks Fridge</option>
                        </select>
                      </td>
                      <td className="p-2 font-medium">
                        ${lineTotal.toFixed(2)}
                      </td>
                      <td className="p-2">
                        {needsReview ? (
                          <Badge variant="outline" className="bg-yellow-100">
                            Review
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={7} className="p-2 text-right">Subtotal (Ex GST):</td>
                  <td className="p-2">${totals.subtotal.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr className="font-medium">
                  <td colSpan={7} className="p-2 text-right">GST:</td>
                  <td className="p-2">${totals.gst.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr className="font-bold text-lg">
                  <td colSpan={7} className="p-2 text-right">Total (Inc GST):</td>
                  <td className="p-2">${totals.total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Square Preview Panel */}
      {showSquarePreview && squarePreview && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-blue-600" />
              Square Catalog Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{squarePreview.summary.priceUpdates}</div>
                <div className="text-xs text-gray-600">Price Updates</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{squarePreview.summary.newItems}</div>
                <div className="text-xs text-gray-600">New Items</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-400">{squarePreview.summary.unchanged}</div>
                <div className="text-xs text-gray-600">Unchanged</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{squarePreview.summary.errors}</div>
                <div className="text-xs text-gray-600">Errors</div>
              </div>
            </div>

            {squarePreview.summary.totalPriceImpact !== 0 && (
              <Alert className="mb-4">
                <AlertDescription>
                  Net price impact: <strong>${squarePreview.summary.totalPriceImpact.toFixed(2)}</strong> across {squarePreview.summary.priceUpdates} items
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-64 overflow-y-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-1">Action</th>
                    <th className="p-1">Item</th>
                    <th className="p-1">Current</th>
                    <th className="p-1">New</th>
                    <th className="p-1">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {squarePreview.changes.map((change: any, i: number) => (
                    <tr key={i} className={`border-b ${
                      change.action === 'UPDATE_PRICE' ? 'bg-orange-50' :
                      change.action === 'CREATE' ? 'bg-green-50' :
                      change.action === 'ERROR' ? 'bg-red-50' : ''
                    }`}>
                      <td className="p-1">
                        <Badge variant="outline" className={`text-xs ${
                          change.action === 'UPDATE_PRICE' ? 'bg-orange-100 text-orange-700' :
                          change.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                          change.action === 'NO_CHANGE' ? 'bg-gray-100 text-gray-500' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {change.action === 'UPDATE_PRICE' ? '↑ Update' :
                           change.action === 'CREATE' ? '+ New' :
                           change.action === 'NO_CHANGE' ? '= Same' : '✕ Error'}
                        </Badge>
                      </td>
                      <td className="p-1 font-medium">{change.itemName}</td>
                      <td className="p-1">{change.currentPrice ? `$${change.currentPrice.toFixed(2)}` : '—'}</td>
                      <td className="p-1 font-medium">${change.newPrice?.toFixed(2) || '—'}</td>
                      <td className="p-1">
                        {change.confidence >= 0.8 ? '✅' : change.confidence >= 0.5 ? '⚠️' : '❓'}
                        <span className="text-xs text-gray-400 ml-1">{(change.confidence * 100).toFixed(0)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSquareApply}
                disabled={squareApplying || squarePreview.summary.priceUpdates + squarePreview.summary.newItems === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {squareApplying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</>
                ) : (
                  <><ArrowUpRight className="h-4 w-4 mr-2" /> Apply {squarePreview.summary.priceUpdates + squarePreview.summary.newItems} Changes to Square</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowSquarePreview(false)}>
                Close Preview
              </Button>
            </div>

            {squareResult && (
              <Alert className="mt-4 bg-green-50 border-green-200">
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Applied: {squareResult.summary.succeeded} succeeded, {squareResult.summary.failed} failed
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push('/invoices')}
        >
          Cancel
        </Button>
        <div className="flex items-center space-x-3">
          {corrections.length > 0 && (
            <span className="text-sm text-gray-600">
              {corrections.length} corrections will be saved for learning
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleSquarePreview}
            disabled={squareLoading || items.length === 0}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {squareLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
            ) : (
              <><Eye className="h-4 w-4 mr-2" /> Preview Square Changes</>
            )}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? 'Saving...' : 'Approve & Process'}
          </Button>
        </div>
      </div>
    </div>
  );
}