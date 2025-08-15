
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Link2, ExternalLink, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

interface SquareProduct {
  id: string
  name: string
  description?: string
  sku?: string
  price?: number
  category?: string
  isActive: boolean
}

interface ProductSuggestion {
  squareProduct: SquareProduct
  confidence: number
  isExactMatch: boolean
}

interface ProductLinkingModalProps {
  isOpen: boolean
  onClose: () => void
  lineItem: LineItem | null
  onSuccess: (linkedLineItem: LineItem) => void
}

export default function ProductLinkingModal({ isOpen, onClose, lineItem, onSuccess }: ProductLinkingModalProps) {
  const [squareProducts, setSquareProducts] = useState<SquareProduct[]>([])
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSquareProduct, setSelectedSquareProduct] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductSku, setNewProductSku] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (isOpen && lineItem) {
      loadSquareProducts()
      loadSuggestions()
      setNewProductName(lineItem.product_name)
      setNewProductPrice(lineItem.manual_unit_price?.toString() || (lineItem.unit_price || 0).toString())
    }
  }, [isOpen, lineItem])

  const loadSquareProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/square/products')
      if (response.ok) {
        const data = await response.json()
        setSquareProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error loading Square products:', error)
      toast.error('Failed to load Square products')
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    if (!lineItem?.product_name) return
    
    setSuggestionsLoading(true)
    try {
      const response = await fetch(`/api/square/product-links/suggestions?productName=${encodeURIComponent(lineItem.product_name)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
      toast.error('Failed to load product suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const createProductLink = async (squareProductId: string) => {
    if (!lineItem?.product_name) return

    setLinking(true)
    try {
      const response = await fetch('/api/square/product-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceProductName: lineItem.product_name,
          squareProductId,
          isManualLink: true,
          linkedBy: 'User'
        }),
      })

      if (response.ok) {
        const linkedProduct = squareProducts.find(p => p.id === squareProductId)
        
        // Update the line item with the linked product
        const updatedLineItem: LineItem = {
          ...lineItem,
          squareProductId: squareProductId,
          squareProduct: linkedProduct ? {
            id: linkedProduct.id,
            name: linkedProduct.name,
            squareId: linkedProduct.id,
            inventoryRecords: []
          } : undefined
        }

        onSuccess(updatedLineItem)
        toast.success('Product linked successfully!')
        onClose()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product link')
      }
    } catch (error) {
      console.error('Error creating product link:', error)
      toast.error(`Failed to link product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLinking(false)
    }
  }

  const createNewSquareProduct = async () => {
    if (!newProductName) {
      toast.error('Product name is required')
      return
    }

    setIsCreatingProduct(true)
    try {
      const response = await fetch('/api/square/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProductName,
          description: newProductDescription || undefined,
          sku: newProductSku || undefined,
          price: newProductPrice ? parseFloat(newProductPrice) : undefined
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Product created successfully!')
        
        // Auto-link the new product
        await createProductLink(data.product.id)
        
        // Reset form
        setNewProductName('')
        setNewProductDescription('')
        setNewProductSku('')
        setNewProductPrice('')
        setShowCreateForm(false)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error(`Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const handleClose = () => {
    setSelectedSquareProduct('')
    setSearchTerm('')
    setShowCreateForm(false)
    setNewProductName('')
    setNewProductDescription('')
    setNewProductSku('')
    setNewProductPrice('')
    setSuggestions([])
    onClose()
  }

  const filteredSquareProducts = squareProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Link2 className="w-5 h-5" />
            <span>Link Product: {lineItem?.product_name || 'Unknown Product'}</span>
          </DialogTitle>
        </DialogHeader>

        {!lineItem ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Link2 className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600">No product selected</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Product Details */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Invoice Item Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Quantity:</span>
                  <span className="ml-2 font-medium">{lineItem.quantity}</span>
                </div>
                <div>
                  <span className="text-gray-600">Unit Price:</span>
                  <span className="ml-2 font-medium">${(lineItem.manual_unit_price || lineItem.unit_price || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-2 font-medium">${(lineItem.total_price || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">GST:</span>
                  <span className="ml-2 font-medium">{lineItem.gst_applicable ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

          {/* AI Suggestions */}
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading suggestions...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">AI Suggested Matches</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {suggestions.slice(0, 5).map((suggestion) => (
                  <div key={suggestion.squareProduct.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{suggestion.squareProduct.name}</span>
                        <Badge variant={suggestion.isExactMatch ? "default" : "secondary"}>
                          {((suggestion.confidence || 0) * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      {suggestion.squareProduct.description && (
                        <p className="text-sm text-gray-600 mt-1">{suggestion.squareProduct.description}</p>
                      )}
                      {suggestion.squareProduct.price && (
                        <p className="text-sm text-gray-500 mt-1">Price: ${(suggestion.squareProduct.price || 0).toFixed(2)}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => createProductLink(suggestion.squareProduct.id)}
                      disabled={linking}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2" />
              <p>No AI suggestions found for this product</p>
            </div>
          )}

          {/* Manual Search & Selection */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Search Existing Products</h4>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search Square products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Select value={selectedSquareProduct} onValueChange={setSelectedSquareProduct}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose a Square product..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {filteredSquareProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center space-x-2">
                          <span>{product.name}</span>
                          {product.price && (
                            <span className="text-gray-500">- ${product.price.toFixed(2)}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => createProductLink(selectedSquareProduct)}
                  disabled={!selectedSquareProduct || linking}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link'}
                </Button>
              </div>
            </div>
          </div>

          {/* Create New Product */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Create New Square Product</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {showCreateForm ? 'Cancel' : 'Create New'}
              </Button>
            </div>
            
            {showCreateForm && (
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <Input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    placeholder="Enter description (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                    <Input
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value)}
                      placeholder="Enter SKU (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (AUD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      placeholder="Enter price (optional)"
                    />
                  </div>
                </div>
                <Button
                  onClick={createNewSquareProduct}
                  disabled={!newProductName || isCreatingProduct}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isCreatingProduct ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create & Link
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
