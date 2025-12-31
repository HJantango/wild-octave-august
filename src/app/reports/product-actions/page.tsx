'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ProductIssue {
  itemId?: string;
  itemName: string;
  vendorName?: string;
  category?: string;
  subcategory?: string;
  wastageQty: number;
  wastageCost: number;
  discountQty: number;
  discountAmount: number;
  totalLoss: number;
  avgWeeklySales?: number;
  currentStock?: number;
}

interface ActionItem {
  id: string;
  itemName: string;
  issueType: 'wastage' | 'discount' | 'both';
  priority: 'high' | 'medium' | 'low';
  actionType: 'order_less' | 'stop_ordering' | 'review_quality' | 'adjust_pricing' | 'improve_storage' | 'other';
  targetDate?: string;
  notes: string;
  completed: boolean;
  completedDate?: string;
  cost: number;
  qty: number;
}

const COLORS = {
  wastage: '#ef4444',
  discount: '#f97316',
  both: '#dc2626',
};

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6'];

export default function ProductActionsPage() {
  const toast = useToast();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [products, setProducts] = useState<ProductIssue[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'wastage' | 'discount' | 'both'>('all');
  const [sortBy, setSortBy] = useState<'cost' | 'qty' | 'priority' | 'date'>('cost');
  const [showAddAction, setShowAddAction] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductIssue | null>(null);

  useEffect(() => {
    loadData();
    loadActions();
  }, [dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/wastage-discounts?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      const result = await response.json();

      if (response.ok) {
        setProducts(result.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load product data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActions = () => {
    try {
      const saved = localStorage.getItem('product_actions');
      if (saved) {
        setActions(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load actions:', error);
    }
  };

  const saveActions = (newActions: ActionItem[]) => {
    try {
      localStorage.setItem('product_actions', JSON.stringify(newActions));
      setActions(newActions);
    } catch (error) {
      console.error('Failed to save actions:', error);
      toast.error('Failed to save actions');
    }
  };

  const addAction = (product: ProductIssue, actionType: ActionItem['actionType'], priority: ActionItem['priority'], notes: string, targetDate?: string) => {
    const issueType = product.wastageQty > 0 && product.discountQty > 0 ? 'both' :
                      product.wastageQty > 0 ? 'wastage' : 'discount';

    const newAction: ActionItem = {
      id: Date.now().toString(),
      itemName: product.itemName,
      issueType,
      priority,
      actionType,
      targetDate,
      notes,
      completed: false,
      cost: product.totalLoss,
      qty: product.wastageQty + product.discountQty,
    };

    saveActions([...actions, newAction]);
    toast.success('Action added successfully');
    setShowAddAction(false);
    setSelectedProduct(null);
  };

  const toggleActionComplete = (actionId: string) => {
    const updated = actions.map(action => {
      if (action.id === actionId) {
        return {
          ...action,
          completed: !action.completed,
          completedDate: !action.completed ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return action;
    });
    saveActions(updated);
  };

  const deleteAction = (actionId: string) => {
    if (confirm('Are you sure you want to delete this action?')) {
      saveActions(actions.filter(a => a.id !== actionId));
      toast.success('Action deleted');
    }
  };

  // Calculate metrics
  const topWastageProducts = products
    .filter(p => p.wastageQty > 0)
    .sort((a, b) => b.wastageCost - a.wastageCost)
    .slice(0, 10);

  const topDiscountProducts = products
    .filter(p => p.discountQty > 0)
    .sort((a, b) => b.discountAmount - a.discountAmount)
    .slice(0, 10);

  const criticalProducts = products.filter(p => p.totalLoss > 50);
  const totalWastageCost = products.reduce((sum, p) => sum + p.wastageCost, 0);
  const totalDiscountCost = products.reduce((sum, p) => sum + p.discountAmount, 0);
  const totalLoss = totalWastageCost + totalDiscountCost;

  // Filter actions
  const filteredActions = actions
    .filter(action => {
      if (!showCompleted && action.completed) return false;
      if (filterType !== 'all' && action.issueType !== filterType && action.issueType !== 'both') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'cost') return b.cost - a.cost;
      if (sortBy === 'qty') return b.qty - a.qty;
      if (sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (sortBy === 'date') {
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      return 0;
    });

  // Prepare chart data
  const categoryBreakdown = products.reduce((acc, product) => {
    const category = product.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { category, wastage: 0, discount: 0, total: 0 };
    }
    acc[category].wastage += product.wastageCost;
    acc[category].discount += product.discountAmount;
    acc[category].total += product.totalLoss;
    return acc;
  }, {} as Record<string, { category: string; wastage: number; discount: number; total: number }>);

  const chartData = Object.values(categoryBreakdown)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const actionTypeData = [
    { name: 'High Priority', value: actions.filter(a => a.priority === 'high' && !a.completed).length },
    { name: 'Medium Priority', value: actions.filter(a => a.priority === 'medium' && !a.completed).length },
    { name: 'Low Priority', value: actions.filter(a => a.priority === 'low' && !a.completed).length },
    { name: 'Completed', value: actions.filter(a => a.completed).length },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Action Tracker</h1>
            <p className="text-gray-600 mt-1">Monitor and action wastage & discount issues</p>
          </div>
          <Button onClick={() => window.print()} className="no-print">
            🖨️ Print Report
          </Button>
        </div>

        {/* Date Range Filter */}
        <Card className="no-print">
          <CardContent className="p-4">
            <div className="flex items-end gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="text-sm text-gray-600">
                {products.length} products with issues
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-red-700">Total Wastage Cost</div>
              <div className="text-3xl font-bold text-red-900">${totalWastageCost.toFixed(2)}</div>
              <div className="text-xs text-red-600 mt-1">{topWastageProducts.length} products affected</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-orange-700">Total Discount Cost</div>
              <div className="text-3xl font-bold text-orange-900">${totalDiscountCost.toFixed(2)}</div>
              <div className="text-xs text-orange-600 mt-1">{topDiscountProducts.length} products affected</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-purple-700">Total Loss</div>
              <div className="text-3xl font-bold text-purple-900">${totalLoss.toFixed(2)}</div>
              <div className="text-xs text-purple-600 mt-1">Wastage + Discounts</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-blue-700">Pending Actions</div>
              <div className="text-3xl font-bold text-blue-900">{actions.filter(a => !a.completed).length}</div>
              <div className="text-xs text-blue-600 mt-1">{actions.filter(a => a.completed).length} completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Loss by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="wastage" fill="#ef4444" name="Wastage" />
                  <Bar dataKey="discount" fill="#f97316" name="Discounts" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Action Status Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Action Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={actionTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {actionTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products to Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Wastage */}
          <Card className="border-2 border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="text-red-900">🗑️ Top 10 Wastage Products</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {topWastageProducts.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200 hover:bg-red-100 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowAddAction(true);
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {product.itemName}
                      </div>
                      <div className="text-xs text-gray-600">{product.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-700">${product.wastageCost.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">{product.wastageQty} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Discounts */}
          <Card className="border-2 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-orange-900">💰 Top 10 Discount Products</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {topDiscountProducts.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-orange-50 rounded border border-orange-200 hover:bg-orange-100 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowAddAction(true);
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {product.itemName}
                      </div>
                      <div className="text-xs text-gray-600">{product.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-700">${product.discountAmount.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">{product.discountQty} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action List */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-blue-900">📋 Action Items</CardTitle>
              <div className="flex gap-2 no-print">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                >
                  {showCompleted ? '✓ ' : ''}Show Completed
                </button>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="text-sm px-3 py-1 border rounded"
                >
                  <option value="all">All Types</option>
                  <option value="wastage">Wastage Only</option>
                  <option value="discount">Discount Only</option>
                  <option value="both">Both Issues</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm px-3 py-1 border rounded"
                >
                  <option value="cost">Sort by Cost</option>
                  <option value="qty">Sort by Quantity</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="date">Sort by Date</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {filteredActions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No actions yet. Click on a product above to add an action.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActions.map((action) => (
                  <div
                    key={action.id}
                    className={`p-4 rounded border-2 ${
                      action.completed
                        ? 'bg-gray-50 border-gray-300 opacity-60'
                        : action.priority === 'high'
                        ? 'bg-red-50 border-red-300'
                        : action.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-blue-50 border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={action.completed}
                        onChange={() => toggleActionComplete(action.id)}
                        className="mt-1 w-5 h-5 cursor-pointer accent-green-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${action.completed ? 'line-through text-gray-600' : 'text-gray-900'}`}>
                            {action.itemName}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              action.priority === 'high'
                                ? 'bg-red-200 text-red-800'
                                : action.priority === 'medium'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}
                          >
                            {action.priority.toUpperCase()}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            {action.actionType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">{action.notes}</div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                          <span>Cost: ${action.cost.toFixed(2)}</span>
                          <span>Qty: {action.qty}</span>
                          {action.targetDate && <span>Due: {new Date(action.targetDate).toLocaleDateString()}</span>}
                          {action.completed && action.completedDate && (
                            <span className="text-green-600">✓ Completed: {new Date(action.completedDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAction(action.id)}
                        className="text-red-600 hover:text-red-800 text-sm no-print"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Action Modal */}
        {showAddAction && selectedProduct && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print"
            onClick={() => {
              setShowAddAction(false);
              setSelectedProduct(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">Add Action for {selectedProduct.itemName}</h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  addAction(
                    selectedProduct,
                    formData.get('actionType') as ActionItem['actionType'],
                    formData.get('priority') as ActionItem['priority'],
                    formData.get('notes') as string,
                    formData.get('targetDate') as string || undefined
                  );
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="actionType">Action Type</Label>
                  <select
                    id="actionType"
                    name="actionType"
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="order_less">Order Less</option>
                    <option value="stop_ordering">Stop Ordering</option>
                    <option value="review_quality">Review Quality</option>
                    <option value="adjust_pricing">Adjust Pricing</option>
                    <option value="improve_storage">Improve Storage</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    name="priority"
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="targetDate">Target Date (Optional)</Label>
                  <input
                    id="targetDate"
                    name="targetDate"
                    type="date"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    required
                    placeholder="Describe the action to be taken..."
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddAction(false);
                      setSelectedProduct(null);
                    }}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Add Action
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
