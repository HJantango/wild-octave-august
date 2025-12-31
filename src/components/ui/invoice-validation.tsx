'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { 
  AlertTriangleIcon, 
  CheckIcon, 
  XIcon, 
  EditIcon,
  InfoIcon,
  EyeIcon,
  ClockIcon
} from 'lucide-react';

interface ValidationLineItem {
  id: string;
  name: string;
  quantity: number;
  unitCostExGst: number;
  category: string;
  needsValidation?: boolean;
  validationStatus?: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | null;
  validationFlags?: string[] | null;
  validationNotes?: string | null;
  originalParsedData?: {
    originalQuantity?: number;
    originalUnitCost?: number;
    llmConfidence?: number;
    llmFlags?: string[];
  } | null;
}

interface InvoiceValidationProps {
  invoiceId: string;
  items: ValidationLineItem[];
  onValidationUpdate: () => void;
}

const VALIDATION_FLAG_DESCRIPTIONS: { [key: string]: string } = {
  'low_llm_confidence': 'AI parsing confidence below 70%',
  'ambiguous_quantity': 'Uncertain about total units',
  'pack_quantity_calculation': 'Complex pack size calculations',
  'unclear_unit_type': 'Uncertain if per KG, per item, etc.',
  'description_unclear': 'Product name partially unreadable',
  'price_calculation_uncertain': 'Unit cost math seems inconsistent',
  'gst_status_unclear': 'Uncertain about GST inclusion',
  'pack_quantity_multiplier': 'Contains pack multipliers (e.g., "x12")',
  'unit_cost_corrected': 'System corrected the unit cost',
  'quantity_corrected': 'System corrected the quantity',
  'high_quantity_check': 'High quantity may indicate pack size issues',
  'mixed_unit_indicators': 'Product name mentions both weight and quantity'
};

const VALIDATION_STATUS_COLORS = {
  'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'REVIEWED': 'bg-blue-100 text-blue-800 border-blue-300',
  'APPROVED': 'bg-green-100 text-green-800 border-green-300',
  'REJECTED': 'bg-red-100 text-red-800 border-red-300',
};

const VALIDATION_STATUS_ICONS = {
  'PENDING': ClockIcon,
  'REVIEWED': EyeIcon,
  'APPROVED': CheckIcon,
  'REJECTED': XIcon,
};

export function InvoiceValidation({ invoiceId, items, onValidationUpdate }: InvoiceValidationProps) {
  const toast = useToast();
  const [editingValidation, setEditingValidation] = useState<string | null>(null);
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>('');
  const [editingUnitCost, setEditingUnitCost] = useState<string | null>(null);
  const [editingUnitCostValue, setEditingUnitCostValue] = useState<string>('');

  const validationItems = items.filter(item => item.needsValidation);

  if (validationItems.length === 0) {
    return null;
  }

  const updateValidationStatus = async (itemId: string, status: 'REVIEWED' | 'APPROVED' | 'REJECTED', notes?: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/line-items/${itemId}/validation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationStatus: status,
          validationNotes: notes || null,
          validatedBy: 'user', // In a real app, this would be the current user
          validatedAt: new Date().toISOString()
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Validation Updated', `Item marked as ${status.toLowerCase()}`);
        onValidationUpdate();
        setEditingValidation(null);
        setValidationNotes('');
      } else {
        toast.error('Update Failed', `Failed to update validation: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating validation:', error);
      toast.error('Error', 'Failed to update validation status');
    }
  };

  const updateItemValue = async (itemId: string, field: 'quantity' | 'unitCostExGst', value: number) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/line-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      const result = await response.json();
      if (result.success) {
        const fieldName = field === 'quantity' ? 'Quantity' : 'Unit cost';
        toast.success('Updated', `${fieldName} updated successfully - sell prices recalculated`);
        onValidationUpdate();
        if (field === 'quantity') {
          setEditingQuantity(null);
          setEditingQuantityValue('');
        } else {
          setEditingUnitCost(null);
          setEditingUnitCostValue('');
        }
      } else {
        toast.error('Update Failed', `Failed to update ${field}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      toast.error('Error', `Failed to update ${field}`);
    }
  };

  const startEditingQuantity = (itemId: string, currentQuantity: number) => {
    setEditingQuantity(itemId);
    setEditingQuantityValue(currentQuantity.toString());
  };

  const startEditingUnitCost = (itemId: string, currentCost: number) => {
    setEditingUnitCost(itemId);
    setEditingUnitCostValue(currentCost.toString());
  };

  const submitQuantityUpdate = (itemId: string) => {
    const newQuantity = parseFloat(editingQuantityValue);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      toast.error('Error', 'Please enter a valid positive number');
      return;
    }
    updateItemValue(itemId, 'quantity', newQuantity);
  };

  const submitUnitCostUpdate = (itemId: string) => {
    const newUnitCost = parseFloat(editingUnitCostValue);
    if (isNaN(newUnitCost) || newUnitCost <= 0) {
      toast.error('Error', 'Please enter a valid positive number');
      return;
    }
    updateItemValue(itemId, 'unitCostExGst', newUnitCost);
  };

  return (
    <Card className="border-orange-300 bg-orange-50">
      <CardHeader className="bg-orange-100 border-b border-orange-300">
        <CardTitle className="flex items-center space-x-2 text-orange-900">
          <AlertTriangleIcon className="w-5 h-5" />
          <span>Items Requiring Validation ({validationItems.length})</span>
          <InfoIcon className="w-4 h-4 text-orange-700" title="These items need manual review due to parsing uncertainty" />
        </CardTitle>
        <p className="text-sm text-orange-800">
          These items were flagged for manual review due to ambiguous unit parsing, pack sizes, or low confidence in AI extraction.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {validationItems.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{item.name}</h4>
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <span>Qty: {item.quantity}</span>
                    <span>Unit Cost: {formatCurrency(item.unitCostExGst)}</span>
                    <span>Category: {item.category}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {item.validationStatus && (
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${
                      VALIDATION_STATUS_COLORS[item.validationStatus]
                    }`}>
                      {(() => {
                        const StatusIcon = VALIDATION_STATUS_ICONS[item.validationStatus];
                        return <StatusIcon className="w-3 h-3" />;
                      })()}
                      <span>{item.validationStatus}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Flags */}
              {item.validationFlags && item.validationFlags.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">Validation Concerns:</h5>
                  <div className="flex flex-wrap gap-2">
                    {item.validationFlags.map((flag) => (
                      <Badge 
                        key={flag} 
                        variant="outline"
                        className="text-xs border-orange-300 text-orange-700 bg-orange-50"
                        title={VALIDATION_FLAG_DESCRIPTIONS[flag] || flag}
                      >
                        {flag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Original Parsed Data */}
              {item.originalParsedData && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">Original AI Parsing:</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600">Original Qty:</span>
                      <div className="font-medium">{item.originalParsedData.originalQuantity || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Original Cost:</span>
                      <div className="font-medium">{item.originalParsedData.originalUnitCost ? formatCurrency(item.originalParsedData.originalUnitCost) : 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">AI Confidence:</span>
                      <div className="font-medium">{item.originalParsedData.llmConfidence ? `${Math.round(item.originalParsedData.llmConfidence * 100)}%` : 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">AI Flags:</span>
                      <div className="font-medium">{item.originalParsedData.llmFlags?.length || 0} flags</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Values */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  {editingQuantity === item.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={editingQuantityValue}
                        onChange={(e) => setEditingQuantityValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitQuantityUpdate(item.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingQuantity(null);
                            setEditingQuantityValue('');
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => submitQuantityUpdate(item.id)}>
                        <CheckIcon className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingQuantity(null);
                          setEditingQuantityValue('');
                        }}
                      >
                        <XIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => startEditingQuantity(item.id, item.quantity)}
                      >
                        <EditIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit Cost (ex GST)</label>
                  {editingUnitCost === item.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={editingUnitCostValue}
                        onChange={(e) => setEditingUnitCostValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitUnitCostUpdate(item.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingUnitCost(null);
                            setEditingUnitCostValue('');
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => submitUnitCostUpdate(item.id)}>
                        <CheckIcon className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingUnitCost(null);
                          setEditingUnitCostValue('');
                        }}
                      >
                        <XIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{formatCurrency(item.unitCostExGst)}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => startEditingUnitCost(item.id, item.unitCostExGst)}
                      >
                        <EditIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Notes */}
              {editingValidation === item.id && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Validation Notes</label>
                  <textarea
                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={3}
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    placeholder="Add notes about your validation decision..."
                  />
                </div>
              )}

              {/* Existing Validation Notes */}
              {item.validationNotes && (
                <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <strong>Previous Notes:</strong> {item.validationNotes}
                </div>
              )}

              {/* Validation Actions */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  {editingValidation === item.id ? (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => updateValidationStatus(item.id, 'APPROVED', validationNotes)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <CheckIcon className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => updateValidationStatus(item.id, 'REJECTED', validationNotes)}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        <XIcon className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setEditingValidation(null);
                          setValidationNotes('');
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setEditingValidation(item.id);
                          setValidationNotes(item.validationNotes || '');
                        }}
                        disabled={item.validationStatus === 'APPROVED' || item.validationStatus === 'REJECTED'}
                      >
                        <EditIcon className="w-4 h-4 mr-1" />
                        Validate
                      </Button>
                      {(item.validationStatus === 'PENDING' || !item.validationStatus) && (
                        <Button 
                          size="sm" 
                          onClick={() => updateValidationStatus(item.id, 'REVIEWED')}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          Mark Reviewed
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {item.validationStatus && (
                  <div className="text-xs text-gray-500">
                    Status: {item.validationStatus}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}