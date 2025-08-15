
'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Building2, Package, DollarSign, AlertTriangle, Tag, Copy, Check, TrendingUp, Edit3, ShoppingCart, CheckCircle, ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import ProductLinkingModal from './product-linking-modal'

interface LineItem {
  id?: string
  product_name: string
  quantity: number
  unit_price: number
  manual_unit_price?: number
  total_price: number
  needs_clarification: boolean
  clarification_note?: string
  gst_applicable?: boolean
  category?: {
    id: string
    name: string
    markup: number
  }
  custom_markup?: number
  finalPrice?: number
  gstAmount?: number
  finalPriceIncGst?: number
  squareProductId?: string
  stockReceived?: boolean
  stockReceivedAt?: Date
  squareProduct?: {
    id: string
    name: string
    squareId: string
    inventoryRecords?: {
      quantity: number
      locationId: string
    }[]
  }
}

interface InvoiceData {
  vendor_name: string
  line_items: LineItem[]
}

interface ApiLineItemResponse {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  manualUnitPrice?: number
  totalPrice: number
  needsClarification: boolean
  clarificationNote?: string
  gstApplicable?: boolean
  category?: {
    id: string
    name: string
    markup: number
  }
  customMarkup?: number
  finalPrice?: number
  gstAmount?: number
  finalPriceIncGst?: number
}

interface Category {
  id: string
  name: string
  markup: number
}

export default function InvoiceDashboard({ invoiceData }: { invoiceData: InvoiceData }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>(invoiceData.line_items)
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({})
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: boolean }>({})
  const [tempPrices, setTempPrices] = useState<{ [key: string]: string }>({})
  const [customMarkupInputs, setCustomMarkupInputs] = useState<{ [key: string]: string }>({})
  const [receivingStock, setReceivingStock] = useState<{ [key: string]: boolean }>({})
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false)
  const [selectedLineItemForLinking, setSelectedLineItemForLinking] = useState<LineItem | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  // Sync component state with prop changes when page refreshes
  useEffect(() => {
    setLineItems(invoiceData.line_items)
  }, [invoiceData.line_items])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
    }
  }

  const handleCategoryChange = async (categoryId: string, lineItem: LineItem, customMarkup?: number) => {
    if (!lineItem.id) return

    console.log('handleCategoryChange called with:', { categoryId, lineItemId: lineItem.id, customMarkup })

    // Find the selected category for optimistic update
    const selectedCategory = categories.find(cat => cat.id === categoryId)
    
    // Calculate optimistic final prices
    const basePrice = (lineItem.manual_unit_price || lineItem.unit_price) * lineItem.quantity
    const markup = customMarkup || selectedCategory?.markup || 1
    const finalPrice = basePrice * markup
    const gstAmount = lineItem.gst_applicable ? finalPrice * 0.1 : 0
    const finalPriceIncGst = finalPrice + gstAmount

    // Create optimistic update
    const optimisticUpdate: LineItem = {
      ...lineItem,
      category: categoryId === 'custom' ? undefined : selectedCategory,
      custom_markup: customMarkup,
      finalPrice: finalPrice,
      gstAmount: gstAmount,
      finalPriceIncGst: finalPriceIncGst
    }

    // OPTIMISTIC UPDATE: Update UI immediately
    setLineItems(prev => {
      const updated = prev.map(item => 
        item.id === lineItem.id ? optimisticUpdate : item
      )
      console.log('Optimistic update applied:', updated)
      return updated
    })

    // Make API call in background for persistence
    try {
      const response = await fetch('/api/assign-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItemId: lineItem.id,
          categoryId: categoryId === 'custom' ? null : categoryId,
          customMarkup: customMarkup,
        }),
      })

      if (response.ok) {
        const updatedLineItem = await response.json()
        console.log('API Response:', updatedLineItem)
        
        // Map API response to UI interface
        const mappedLineItem: LineItem = {
          id: updatedLineItem.id,
          product_name: updatedLineItem.productName,
          quantity: updatedLineItem.quantity,
          unit_price: updatedLineItem.unitPrice,
          manual_unit_price: updatedLineItem.manualUnitPrice,
          total_price: updatedLineItem.totalPrice,
          needs_clarification: updatedLineItem.needsClarification,
          clarification_note: updatedLineItem.clarificationNote,
          gst_applicable: updatedLineItem.gstApplicable,
          category: updatedLineItem.category,
          custom_markup: updatedLineItem.customMarkup,
          finalPrice: updatedLineItem.finalPrice,
          gstAmount: updatedLineItem.gstAmount,
          finalPriceIncGst: updatedLineItem.finalPriceIncGst
        }
        
        console.log('Mapped line item:', mappedLineItem)
        
        // Update with actual API response (should match optimistic update)
        setLineItems(prev => {
          const updated = prev.map(item => 
            item.id === lineItem.id ? mappedLineItem : item
          )
          console.log('API response update applied:', updated)
          return updated
        })
        
        toast.success('Category assigned successfully')
      } else {
        throw new Error('Failed to assign category')
      }
    } catch (error) {
      console.error('Error assigning category:', error)
      
      // REVERT OPTIMISTIC UPDATE on error
      setLineItems(prev => {
        const reverted = prev.map(item => 
          item.id === lineItem.id ? lineItem : item
        )
        console.log('Reverted optimistic update due to error:', reverted)
        return reverted
      })
      
      toast.error('Failed to assign category')
    }
  }

  const handleBulkCategoryChange = async (categoryId: string, customMarkup?: number) => {
    if (selectedItems.size === 0) return

    const selectedItemIds = Array.from(selectedItems)
    
    // Find the selected category for optimistic update
    const selectedCategory = categories.find(cat => cat.id === categoryId)
    
    // Store original items for error rollback
    const originalItems = lineItems.filter(item => selectedItemIds.includes(item.id!))
    
    // Create optimistic updates for selected items
    const optimisticUpdates = lineItems.map(item => {
      if (selectedItemIds.includes(item.id!)) {
        // Calculate optimistic final prices
        const basePrice = (item.manual_unit_price || item.unit_price) * item.quantity
        const markup = customMarkup || selectedCategory?.markup || 1
        const finalPrice = basePrice * markup
        const gstAmount = item.gst_applicable ? finalPrice * 0.1 : 0
        const finalPriceIncGst = finalPrice + gstAmount

        return {
          ...item,
          category: categoryId === 'custom' ? undefined : selectedCategory,
          custom_markup: customMarkup,
          finalPrice: finalPrice,
          gstAmount: gstAmount,
          finalPriceIncGst: finalPriceIncGst
        }
      }
      return item
    })

    // OPTIMISTIC UPDATE: Update UI immediately
    setLineItems(optimisticUpdates)
    console.log('Bulk optimistic update applied:', optimisticUpdates)
    
    try {
      const response = await fetch('/api/assign-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItemIds: selectedItemIds,
          categoryId: categoryId === 'custom' ? null : categoryId,
          customMarkup: customMarkup,
        }),
      })

      if (response.ok) {
        const updatedLineItems = await response.json()
        console.log('Bulk API Response:', updatedLineItems)
        
        // Map API response to UI interface
        const mappedLineItems = updatedLineItems.map((updatedLineItem: ApiLineItemResponse) => ({
          id: updatedLineItem.id,
          product_name: updatedLineItem.productName,
          quantity: updatedLineItem.quantity,
          unit_price: updatedLineItem.unitPrice,
          manual_unit_price: updatedLineItem.manualUnitPrice,
          total_price: updatedLineItem.totalPrice,
          needs_clarification: updatedLineItem.needsClarification,
          clarification_note: updatedLineItem.clarificationNote,
          gst_applicable: updatedLineItem.gstApplicable,
          category: updatedLineItem.category,
          custom_markup: updatedLineItem.customMarkup,
          finalPrice: updatedLineItem.finalPrice,
          gstAmount: updatedLineItem.gstAmount,
          finalPriceIncGst: updatedLineItem.finalPriceIncGst
        }))
        
        // Update line items state with actual API response
        setLineItems(prev => {
          const updated = prev.map(item => {
            const mappedItem = mappedLineItems.find((mapped: LineItem) => mapped.id === item.id)
            return mappedItem || item
          })
          console.log('Bulk API response update applied:', updated)
          return updated
        })
        
        // Clear selections
        setSelectedItems(new Set())
        setShowBulkActions(false)
        
        toast.success(`Category assigned to ${selectedItemIds.length} items successfully`)
      } else {
        throw new Error('Failed to assign category')
      }
    } catch (error) {
      console.error('Error assigning bulk category:', error)
      
      // REVERT OPTIMISTIC UPDATE on error
      setLineItems(prev => {
        const reverted = prev.map(item => {
          const originalItem = originalItems.find(orig => orig.id === item.id)
          return originalItem || item
        })
        console.log('Reverted bulk optimistic update due to error:', reverted)
        return reverted
      })
      
      toast.error('Failed to assign category')
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectableItems = lineItems.filter(item => !item.needs_clarification && item.id)
    
    if (e.target.checked) {
      const newSelection = new Set(selectableItems.map(item => item.id!))
      setSelectedItems(newSelection)
      setShowBulkActions(newSelection.size > 0)
    } else {
      setSelectedItems(new Set())
      setShowBulkActions(false)
    }
  }

  const handleItemSelect = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelection = new Set(selectedItems)
    
    if (e.target.checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    
    setSelectedItems(newSelection)
    setShowBulkActions(newSelection.size > 0)
  }

  const handleManualPriceChange = async (lineItem: LineItem, newPrice: number) => {
    if (!lineItem.id) return

    // Calculate optimistic final prices with new manual price
    const basePrice = newPrice * lineItem.quantity
    const markup = lineItem.custom_markup || lineItem.category?.markup || 1
    const finalPrice = basePrice * markup
    const gstAmount = lineItem.gst_applicable ? finalPrice * 0.1 : 0
    const finalPriceIncGst = finalPrice + gstAmount

    // Create optimistic update
    const optimisticUpdate: LineItem = {
      ...lineItem,
      manual_unit_price: newPrice,
      total_price: basePrice,
      finalPrice: finalPrice,
      gstAmount: gstAmount,
      finalPriceIncGst: finalPriceIncGst
    }

    // OPTIMISTIC UPDATE: Update UI immediately
    setLineItems(prev => {
      const updated = prev.map(item => 
        item.id === lineItem.id ? optimisticUpdate : item
      )
      console.log('Manual price optimistic update applied:', updated)
      return updated
    })

    try {
      const response = await fetch('/api/update-manual-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItemId: lineItem.id,
          manualUnitPrice: newPrice,
        }),
      })

      if (response.ok) {
        const updatedLineItem = await response.json()
        
        // Map API response to UI interface
        const mappedLineItem: LineItem = {
          id: updatedLineItem.id,
          product_name: updatedLineItem.productName,
          quantity: updatedLineItem.quantity,
          unit_price: updatedLineItem.unitPrice,
          manual_unit_price: updatedLineItem.manualUnitPrice,
          total_price: updatedLineItem.totalPrice,
          needs_clarification: updatedLineItem.needsClarification,
          clarification_note: updatedLineItem.clarificationNote,
          gst_applicable: updatedLineItem.gstApplicable,
          category: updatedLineItem.category,
          custom_markup: updatedLineItem.customMarkup,
          finalPrice: updatedLineItem.finalPrice,
          gstAmount: updatedLineItem.gstAmount,
          finalPriceIncGst: updatedLineItem.finalPriceIncGst
        }
        
        // Update line items state with actual API response
        setLineItems(prev => {
          const updated = prev.map(item => 
            item.id === lineItem.id ? mappedLineItem : item
          )
          console.log('Manual price API response update applied:', updated)
          return updated
        })
        
        toast.success('Manual price updated successfully')
      } else {
        throw new Error('Failed to update manual price')
      }
    } catch (error) {
      console.error('Error updating manual price:', error)
      
      // REVERT OPTIMISTIC UPDATE on error
      setLineItems(prev => {
        const reverted = prev.map(item => 
          item.id === lineItem.id ? lineItem : item
        )
        console.log('Reverted manual price optimistic update due to error:', reverted)
        return reverted
      })
      
      toast.error('Failed to update manual price')
    }
  }

  const startEditingPrice = (itemId: string, currentPrice: number) => {
    setEditingPrices(prev => ({ ...prev, [itemId]: true }))
    setTempPrices(prev => ({ ...prev, [itemId]: currentPrice.toString() }))
  }

  const cancelEditingPrice = (itemId: string) => {
    setEditingPrices(prev => ({ ...prev, [itemId]: false }))
    setTempPrices(prev => ({ ...prev, [itemId]: '' }))
  }

  const saveEditingPrice = (lineItem: LineItem) => {
    const newPrice = parseFloat(tempPrices[lineItem.id!] || '0')
    if (newPrice > 0) {
      handleManualPriceChange(lineItem, newPrice)
      setEditingPrices(prev => ({ ...prev, [lineItem.id!]: false }))
      setTempPrices(prev => ({ ...prev, [lineItem.id!]: '' }))
    }
  }

  const handleCustomMarkupChange = (lineItem: LineItem, customMarkup: string) => {
    const markupValue = parseFloat(customMarkup)
    if (markupValue > 0) {
      handleCategoryChange('custom', lineItem, markupValue)
    }
  }

  const handleReceiveStock = async (lineItem: LineItem) => {
    if (!lineItem.id || !lineItem.squareProductId) {
      toast.error('Item must be linked to a Square product to receive stock')
      return
    }

    if (lineItem.stockReceived) {
      toast.error('Stock already received for this item')
      return
    }

    setReceivingStock(prev => ({ ...prev, [lineItem.id!]: true }))

    try {
      const response = await fetch('/api/square/receive-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItemId: lineItem.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update the line item in state
        setLineItems(prev => prev.map(item => 
          item.id === lineItem.id 
            ? { ...item, stockReceived: true, stockReceivedAt: new Date() }
            : item
        ))
        
        toast.success(`Stock received: ${lineItem.quantity} units of ${lineItem.product_name}`)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to receive stock')
      }
    } catch (error) {
      console.error('Error receiving stock:', error)
      toast.error(`Failed to receive stock: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setReceivingStock(prev => ({ ...prev, [lineItem.id!]: false }))
    }
  }

  const handleOpenLinkingModal = (lineItem: LineItem) => {
    setSelectedLineItemForLinking(lineItem)
    setIsLinkingModalOpen(true)
  }

  const handleCloseLinkingModal = () => {
    setIsLinkingModalOpen(false)
    setSelectedLineItemForLinking(null)
  }

  const handleLinkingSuccess = (linkedLineItem: LineItem) => {
    // Update the line item in state
    setLineItems(prev => prev.map(item => 
      item.id === linkedLineItem.id ? linkedLineItem : item
    ))
    
    // Close the modal
    handleCloseLinkingModal()
  }

  const copyToClipboard = async (text: string, itemId: string, type: 'unit' | 'final') => {
    try {
      await navigator.clipboard.writeText(text)
      const copyKey = `${itemId}-${type}`
      setCopiedItems(prev => ({ ...prev, [copyKey]: true }))
      
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [copyKey]: false }))
      }, 2000)
      
      toast.success(`${type === 'unit' ? 'Unit price' : 'Final price'} copied to clipboard`)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  const calculateTotalExGST = () => {
    return lineItems.reduce((sum, item) => sum + item.total_price, 0)
  }

  const calculateTotalWithMarkup = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (item.finalPriceIncGst || item.finalPrice || item.total_price)
    }, 0)
  }

  const calculateTotalMarkupPercentage = () => {
    const totalExGST = calculateTotalExGST()
    const totalWithMarkup = calculateTotalWithMarkup()
    
    if (totalExGST === 0) return 0
    
    const markupPercentage = ((totalWithMarkup - totalExGST) / totalExGST) * 100
    return Math.max(0, markupPercentage)
  }

  const getItemsNeedingClarification = () => {
    return lineItems.filter(item => item.needs_clarification)
  }

  const getItemsNeedingCategories = () => {
    return lineItems.filter(item => !item.category && !item.needs_clarification)
  }

  const getSelectableItems = () => {
    return lineItems.filter(item => !item.needs_clarification && item.id)
  }

  const isAllSelected = () => {
    const selectableItems = getSelectableItems()
    return selectableItems.length > 0 && selectableItems.every(item => selectedItems.has(item.id!))
  }

  return (
    <div className="space-y-6">
      {/* Vendor Header */}
      <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {invoiceData.vendor_name}
              </h2>
              <p className="text-sm text-gray-600">Supplier Invoice</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Total Items</div>
            <div className="text-2xl font-bold text-gray-900">
              {lineItems.length}
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-sm text-gray-600">Total Ex GST</div>
              <div className="text-lg font-bold text-gray-900">
                ${calculateTotalExGST().toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-sm text-gray-600">With Markup (Inc GST)</div>
              <div className="text-lg font-bold text-gray-900">
                ${calculateTotalWithMarkup().toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-sm text-gray-600">Total Markup</div>
              <div className="text-lg font-bold text-gray-900">
                {calculateTotalMarkupPercentage().toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-sm text-gray-600">Need Clarification</div>
              <div className="text-lg font-bold text-gray-900">
                {getItemsNeedingClarification().length}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <Tag className="w-8 h-8 text-purple-500" />
            <div>
              <div className="text-sm text-gray-600">Need Categories</div>
              <div className="text-lg font-bold text-gray-900">
                {getItemsNeedingCategories().length}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-blue-900">
                {selectedItems.size} items selected
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItems(new Set())
                  setShowBulkActions(false)
                }}
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <select
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                defaultValue=""
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'custom') {
                    const customMarkup = prompt('Enter custom markup (e.g., 2.2, 1.85):')
                    if (customMarkup && parseFloat(customMarkup) > 0) {
                      handleBulkCategoryChange('custom', parseFloat(customMarkup))
                    }
                  } else if (value) {
                    handleBulkCategoryChange(value)
                  }
                  // Reset the select to show placeholder
                  e.target.value = ''
                }}
              >
                <option value="">Assign category to selected</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.markup}x)
                  </option>
                ))}
                <option value="custom">Custom Markup</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Line Items Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
          <p className="text-sm text-gray-600">Review and assign categories to items</p>
          <p className="text-xs text-blue-600 mt-1">
            💡 Select multiple items using checkboxes to apply categories in bulk
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected()}
                      onChange={handleSelectAll}
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                      aria-label="Select all items"
                    />
                    <span className="font-medium">Select All</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price (Ex GST)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Final Price (Inc GST)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lineItems.map((item, index) => (
                <tr key={item.id || index} className={`group transition-all duration-200 hover:bg-gray-50 ${item.needs_clarification ? 'bg-orange-50 hover:bg-orange-100' : ''} ${selectedItems.has(item.id || '') ? 'bg-blue-50 hover:bg-blue-100 ring-2 ring-blue-200' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center w-full">
                      {!item.needs_clarification && item.id ? (
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => handleItemSelect(item.id!, e)}
                          className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          aria-label={`Select ${item.product_name}`}
                        />
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center">
                          <div className="w-2 h-2 bg-gray-300 rounded-full" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </div>
                        {item.needs_clarification && (
                          <div className="text-xs text-orange-600 mt-1">
                            ⚠️ {item.clarification_note}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      {editingPrices[item.id!] ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={tempPrices[item.id!] || ''}
                            onChange={(e) => setTempPrices(prev => ({ ...prev, [item.id!]: e.target.value }))}
                            className="w-20 h-8 text-sm"
                            placeholder="0.00"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveEditingPrice(item)}
                            className="h-8 px-2"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelEditingPrice(item.id!)}
                            className="h-8 px-2"
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => copyToClipboard((item.manual_unit_price || item.unit_price || 0).toFixed(2), item.id || `${index}`, 'unit')}
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                          >
                            <span>${(item.manual_unit_price || item.unit_price || 0).toFixed(2)}</span>
                            {copiedItems[`${item.id || index}-unit`] ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                          <button
                            onClick={() => startEditingPrice(item.id!, item.manual_unit_price || item.unit_price)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {item.manual_unit_price && (
                      <div className="text-xs text-gray-500 mt-1">
                        Original: ${(item.unit_price || 0).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.needs_clarification ? (
                      <Badge variant="destructive">
                        Needs Clarification
                      </Badge>
                    ) : (
                      <div className="space-y-2">
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={item.category?.id || (item.custom_markup ? 'custom' : '')}
                          onChange={(e) => {
                            const value = e.target.value
                            console.log('Select onChange called with:', { value, item: item.product_name, currentCategory: item.category || 'null' })
                            if (value === 'custom') {
                              setCustomMarkupInputs(prev => ({ ...prev, [item.id!]: item.custom_markup?.toString() || '' }))
                            } else if (value) {
                              handleCategoryChange(value, item)
                            }
                          }}
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name} ({category.markup}x)
                            </option>
                          ))}
                          <option value="custom">Custom Markup</option>
                        </select>
                        {(item.custom_markup || customMarkupInputs[item.id!]) && (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={customMarkupInputs[item.id!] || item.custom_markup?.toString() || ''}
                              onChange={(e) => setCustomMarkupInputs(prev => ({ ...prev, [item.id!]: e.target.value }))}
                              className="w-20 h-8 text-sm"
                              placeholder="2.2"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                handleCustomMarkupChange(item, customMarkupInputs[item.id!])
                                setCustomMarkupInputs(prev => ({ ...prev, [item.id!]: '' }))
                              }}
                              className="h-8 px-2"
                            >
                              Apply
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.finalPriceIncGst ? (
                      <div>
                        <button
                          onClick={() => copyToClipboard(item.finalPriceIncGst?.toFixed(2) || '0', item.id || `${index}`, 'final')}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        >
                          <span className="font-medium">${(item.finalPriceIncGst || 0).toFixed(2)}</span>
                          {copiedItems[`${item.id || index}-final`] ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                        <div className="text-xs text-gray-500">
                          ({item.custom_markup ? `${item.custom_markup}x custom` : `${item.category?.markup}x markup`})
                        </div>
                        <div className="text-xs">
                          {item.gst_applicable ? (
                            <span className="text-green-600 font-medium">GST</span>
                          ) : (
                            <span className="text-orange-600 font-medium">GST-Free</span>
                          )}
                        </div>
                      </div>
                    ) : item.finalPrice ? (
                      <div>
                        <button
                          onClick={() => copyToClipboard(item.finalPrice?.toFixed(2) || '0', item.id || `${index}`, 'final')}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        >
                          <span className="font-medium">${(item.finalPrice || 0).toFixed(2)}</span>
                          {copiedItems[`${item.id || index}-final`] ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                        <div className="text-xs text-gray-500">
                          ({item.custom_markup ? `${item.custom_markup}x custom` : `${item.category?.markup}x markup`})
                        </div>
                        <div className="text-xs">
                          {item.gst_applicable ? (
                            <span className="text-green-600 font-medium">GST</span>
                          ) : (
                            <span className="text-orange-600 font-medium">GST-Free</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {item.category && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {item.category.name}
                      </Badge>
                    )}
                    {item.custom_markup && !item.category && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        Custom {item.custom_markup}x
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {item.squareProductId ? (
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Linked
                          </Badge>
                          {item.squareProduct?.inventoryRecords?.[0] && (
                            <span className="text-xs text-gray-500">
                              Stock: {item.squareProduct.inventoryRecords[0].quantity}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenLinkingModal(item)}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer border border-gray-300 hover:border-blue-300"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Not Linked</span>
                        </button>
                      )}
                    </div>
                    {item.squareProductId && !item.stockReceived && (
                      <Button
                        size="sm"
                        onClick={() => handleReceiveStock(item)}
                        disabled={receivingStock[item.id!] || item.stockReceived}
                        className="mt-2 h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {receivingStock[item.id!] ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            Receiving...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Receive Stock
                          </>
                        )}
                      </Button>
                    )}
                    {item.stockReceived && (
                      <div className="mt-2 flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Stock Received</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Product Linking Modal */}
      <ProductLinkingModal
        isOpen={isLinkingModalOpen}
        onClose={handleCloseLinkingModal}
        lineItem={selectedLineItemForLinking}
        onSuccess={handleLinkingSuccess}
      />
    </div>
  )
}
