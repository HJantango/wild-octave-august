
'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  RefreshCw, 
  Package, 
  BarChart3, 
  Settings, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ExternalLink,
  Database,
  Loader2,
  Calendar,
  Activity
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface SyncLog {
  id: string
  syncType: string
  status: string
  itemsProcessed: number
  itemsSuccess: number
  itemsFailed: number
  errorMessage?: string
  startedAt: string
  completedAt?: string
  createdAt: string
}

interface SquareProduct {
  id: string
  name: string
  description?: string
  sku?: string
  price?: number
  isActive: boolean
  lastSyncedAt: string
  inventoryRecords: {
    quantity: number
    locationId: string
  }[]
}

interface InventoryRecord {
  id: string
  quantity: number
  locationId: string
  lastUpdated: string
  squareProduct: {
    id: string
    name: string
    sku?: string
  }
}

export default function SquareAdminDashboard() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [squareProducts, setSquareProducts] = useState<SquareProduct[]>([])
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<SquareProduct | null>(null)
  const [inventoryUpdate, setInventoryUpdate] = useState({ quantity: '', action: 'set' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadSyncLogs(),
        loadSquareProducts(),
        loadInventory()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const loadSyncLogs = async () => {
    try {
      const response = await fetch('/api/square/sync')
      if (response.ok) {
        const data = await response.json()
        setSyncLogs(data.syncLogs)
      }
    } catch (error) {
      console.error('Error loading sync logs:', error)
    }
  }

  const loadSquareProducts = async () => {
    try {
      const response = await fetch('/api/square/products')
      if (response.ok) {
        const data = await response.json()
        setSquareProducts(data.products)
      }
    } catch (error) {
      console.error('Error loading Square products:', error)
    }
  }

  const loadInventory = async () => {
    try {
      const response = await fetch('/api/square/inventory')
      if (response.ok) {
        const data = await response.json()
        setInventory(data.inventory)
      }
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const triggerSync = async (type: string) => {
    setSyncing(prev => ({ ...prev, [type]: true }))
    try {
      const response = await fetch('/api/square/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${type} sync completed successfully!`)
        await loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }
    } catch (error) {
      console.error('Error triggering sync:', error)
      toast.error(`Failed to sync ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSyncing(prev => ({ ...prev, [type]: false }))
    }
  }

  const updateInventory = async (squareProductId: string, quantity: number, action: string) => {
    try {
      const response = await fetch('/api/square/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          squareProductId,
          quantity,
          action
        }),
      })

      if (response.ok) {
        toast.success('Inventory updated successfully!')
        await loadInventory()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update inventory')
      }
    } catch (error) {
      console.error('Error updating inventory:', error)
      toast.error(`Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>
    }
  }

  const filteredProducts = squareProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const lowStockItems = inventory.filter(item => item.quantity < 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Square Integration Dashboard</h2>
          <p className="text-sm text-gray-600">Manage Square API integration and inventory</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => triggerSync('daily')}
            disabled={syncing.daily}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {syncing.daily ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Full Sync
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-sm text-gray-600">Square Products</div>
              <div className="text-2xl font-bold text-gray-900">{squareProducts.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-sm text-gray-600">Inventory Items</div>
              <div className="text-2xl font-bold text-gray-900">{inventory.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-sm text-gray-600">Low Stock Items</div>
              <div className="text-2xl font-bold text-gray-900">{lowStockItems.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-purple-500" />
            <div>
              <div className="text-sm text-gray-600">Recent Syncs</div>
              <div className="text-2xl font-bold text-gray-900">{syncLogs.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sync">Sync Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button
              onClick={() => triggerSync('products')}
              disabled={syncing.products}
              variant="outline"
            >
              {syncing.products ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Products
                </>
              )}
            </Button>
          </div>

          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Square Products</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        {product.sku && (
                          <Badge variant="secondary">{product.sku}</Badge>
                        )}
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        {product.price && <span>Price: ${product.price.toFixed(2)}</span>}
                        {product.inventoryRecords[0] && (
                          <span>Stock: {product.inventoryRecords[0].quantity}</span>
                        )}
                        <span>Last synced: {format(new Date(product.lastSyncedAt), 'PPp')}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Manage Product: {product.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Current Stock</h4>
                              <p className="text-2xl font-bold text-gray-900">
                                {product.inventoryRecords[0]?.quantity || 0} units
                              </p>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Update Inventory</h4>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    placeholder="Quantity"
                                    value={inventoryUpdate.quantity}
                                    onChange={(e) => setInventoryUpdate(prev => ({ ...prev, quantity: e.target.value }))}
                                    className="flex-1"
                                  />
                                  <select
                                    value={inventoryUpdate.action}
                                    onChange={(e) => setInventoryUpdate(prev => ({ ...prev, action: e.target.value }))}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                  >
                                    <option value="set">Set to</option>
                                    <option value="adjust">Adjust by</option>
                                  </select>
                                </div>
                                <Button
                                  onClick={() => {
                                    if (inventoryUpdate.quantity) {
                                      updateInventory(product.id, parseFloat(inventoryUpdate.quantity), inventoryUpdate.action)
                                      setInventoryUpdate({ quantity: '', action: 'set' })
                                    }
                                  }}
                                  disabled={!inventoryUpdate.quantity}
                                  className="w-full"
                                >
                                  Update Inventory
                                </Button>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Management</h3>
            <Button
              onClick={() => triggerSync('inventory')}
              disabled={syncing.inventory}
              variant="outline"
            >
              {syncing.inventory ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Inventory
                </>
              )}
            </Button>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <div className="px-6 py-4 border-b border-orange-200">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-orange-900">Low Stock Alert</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.squareProduct.name}</h4>
                        {item.squareProduct.sku && (
                          <p className="text-sm text-gray-600">SKU: {item.squareProduct.sku}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">{item.quantity} units</p>
                        <p className="text-sm text-gray-500">Low stock</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Full Inventory */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All Inventory</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {inventory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.squareProduct.name}</h4>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        {item.squareProduct.sku && <span>SKU: {item.squareProduct.sku}</span>}
                        <span>Last updated: {format(new Date(item.lastUpdated), 'PPp')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{item.quantity} units</p>
                      <p className="text-sm text-gray-500">In stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sync History</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {syncLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(log.status)}
                        <h4 className="font-medium text-gray-900 capitalize">{log.syncType} Sync</h4>
                        {getStatusBadge(log.status)}
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        <span>Processed: {log.itemsProcessed}</span>
                        <span>Success: {log.itemsSuccess}</span>
                        <span>Failed: {log.itemsFailed}</span>
                        <span>Started: {format(new Date(log.startedAt), 'PPp')}</span>
                      </div>
                      {log.errorMessage && (
                        <p className="mt-2 text-sm text-red-600">Error: {log.errorMessage}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {log.completedAt ? 'Completed' : 'Running'}
                      </p>
                      {log.completedAt && (
                        <p className="text-sm text-gray-500">
                          {format(new Date(log.completedAt), 'PPp')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Square Integration Settings</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Environment</h4>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {process.env.NODE_ENV === 'production' ? 'Production' : 'Sandbox'}
                </Badge>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => triggerSync('products')}
                    disabled={syncing.products}
                    variant="outline"
                    className="justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Sync Products
                  </Button>
                  <Button
                    onClick={() => triggerSync('inventory')}
                    disabled={syncing.inventory}
                    variant="outline"
                    className="justify-start"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Sync Inventory
                  </Button>
                  <Button
                    onClick={() => triggerSync('auto-link')}
                    disabled={syncing['auto-link']}
                    variant="outline"
                    className="justify-start"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Auto-Link Products
                  </Button>
                  <Button
                    onClick={() => triggerSync('daily')}
                    disabled={syncing.daily}
                    variant="outline"
                    className="justify-start"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Full Daily Sync
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Scheduled Sync</h4>
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Daily sync runs at 5:00 AM AEST
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Automatically syncs products and inventory from Square every day
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
