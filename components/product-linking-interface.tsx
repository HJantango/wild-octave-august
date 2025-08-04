
'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Link2, ExternalLink, Trash2, AlertTriangle, CheckCircle, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UnlinkedProduct {
  productName: string
  quantity: number
  unitPrice: number
  invoice: {
    vendor: {
      name: string
    }
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

interface ProductLink {
  id: string
  invoiceProductName: string
  squareProductId: string
  confidence: number
  isManualLink: boolean
  linkedBy?: string
  createdAt: string
  squareProduct: SquareProduct
}

interface ProductSuggestion {
  squareProduct: SquareProduct
  confidence: number
  isExactMatch: boolean
}

export default function ProductLinkingInterface() {
  const [unlinkedProducts, setUnlinkedProducts] = useState<UnlinkedProduct[]>([])
  const [productLinks, setProductLinks] = useState<ProductLink[]>([])
  const [squareProducts, setSquareProducts] = useState<SquareProduct[]>([])
  const [suggestions, setSuggestions] = useState<{ [key: string]: ProductSuggestion[] }>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [isLinkingDialogOpen, setIsLinkingDialogOpen] = useState(false)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductSku, setNewProductSku] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadUnlinkedProducts(),
        loadProductLinks(),
        loadSquareProducts()
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load product data')
    } finally {
      setLoading(false)
    }
  }

  const loadUnlinkedProducts = async () => {
    try {
      const response = await fetch('/api/square/product-links?unlinkedOnly=true')
      if (response.ok) {
        const data = await response.json()
        setUnlinkedProducts(data.unlinkedProducts)
      }
    } catch (error) {
      console.error('Error loading unlinked products:', error)
    }
  }

  const loadProductLinks = async () => {
    try {
      const response = await fetch('/api/square/product-links')
      if (response.ok) {
        const data = await response.json()
        setProductLinks(data.productLinks)
      }
    } catch (error) {
      console.error('Error loading product links:', error)
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

  const getSuggestions = async (productName: string) => {
    if (suggestions[productName]) return suggestions[productName]
    
    try {
      const response = await fetch(`/api/square/product-links/suggestions?productName=${encodeURIComponent(productName)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(prev => ({ ...prev, [productName]: data.suggestions }))
        return data.suggestions
      }
    } catch (error) {
      console.error('Error getting suggestions:', error)
    }
    return []
  }

  const createProductLink = async (invoiceProductName: string, squareProductId: string) => {
    try {
      const response = await fetch('/api/square/product-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceProductName,
          squareProductId,
          isManualLink: true,
          linkedBy: 'Admin'
        }),
      })

      if (response.ok) {
        toast.success('Product linked successfully!')
        await loadData()
        setIsLinkingDialogOpen(false)
        setSelectedProduct(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product link')
      }
    } catch (error) {
      console.error('Error creating product link:', error)
      toast.error(`Failed to link product: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const deleteProductLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/square/product-links?id=${linkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Product link removed successfully!')
        await loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove product link')
      }
    } catch (error) {
      console.error('Error removing product link:', error)
      toast.error(`Failed to remove product link: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
        await loadSquareProducts()
        
        // Auto-link if we have a selected product
        if (selectedProduct) {
          await createProductLink(selectedProduct, data.product.id)
        }
        
        // Reset form
        setNewProductName('')
        setNewProductDescription('')
        setNewProductSku('')
        setNewProductPrice('')
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

  const filteredUnlinkedProducts = unlinkedProducts.filter(product =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredProductLinks = productLinks.filter(link =>
    link.invoiceProductName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.squareProduct.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h2 className="text-2xl font-bold text-gray-900">Product Linking</h2>
          <p className="text-sm text-gray-600">Manage links between invoice items and Square products</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-sm text-gray-600">Unlinked Products</div>
              <div className="text-2xl font-bold text-gray-900">{unlinkedProducts.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-sm text-gray-600">Linked Products</div>
              <div className="text-2xl font-bold text-gray-900">{productLinks.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <ExternalLink className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-sm text-gray-600">Square Products</div>
              <div className="text-2xl font-bold text-gray-900">{squareProducts.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Unlinked Products */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Unlinked Products</h3>
          <p className="text-sm text-gray-600">Invoice items that need to be linked to Square products</p>
        </div>
        <div className="p-6">
          {filteredUnlinkedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All products are linked!</p>
              <p className="text-sm">No unlinked products found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUnlinkedProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{product.productName}</h4>
                    <p className="text-sm text-gray-600">
                      Qty: {product.quantity} | Price: ${product.unitPrice.toFixed(2)} | 
                      Vendor: {product.invoice.vendor.name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog open={isLinkingDialogOpen && selectedProduct === product.productName} onOpenChange={setIsLinkingDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setSelectedProduct(product.productName)
                            getSuggestions(product.productName)
                            setIsLinkingDialogOpen(true)
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Link
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Link Product: {product.productName}</DialogTitle>
                        </DialogHeader>
                        <LinkingDialog 
                          productName={product.productName}
                          suggestions={suggestions[product.productName] || []}
                          squareProducts={squareProducts}
                          onLink={createProductLink}
                          onCreateNew={createNewSquareProduct}
                          isCreating={isCreatingProduct}
                          newProductName={newProductName}
                          setNewProductName={setNewProductName}
                          newProductDescription={newProductDescription}
                          setNewProductDescription={setNewProductDescription}
                          newProductSku={newProductSku}
                          setNewProductSku={setNewProductSku}
                          newProductPrice={newProductPrice}
                          setNewProductPrice={setNewProductPrice}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Existing Links */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Existing Product Links</h3>
          <p className="text-sm text-gray-600">Currently linked products</p>
        </div>
        <div className="p-6">
          {filteredProductLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No product links found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProductLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{link.invoiceProductName}</h4>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        {link.squareProduct.name}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span>Confidence: {(link.confidence * 100).toFixed(0)}%</span>
                      <span>Type: {link.isManualLink ? 'Manual' : 'Auto'}</span>
                      {link.squareProduct.price && (
                        <span>Price: ${link.squareProduct.price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteProductLink(link.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function LinkingDialog({
  productName,
  suggestions,
  squareProducts,
  onLink,
  onCreateNew,
  isCreating,
  newProductName,
  setNewProductName,
  newProductDescription,
  setNewProductDescription,
  newProductSku,
  setNewProductSku,
  newProductPrice,
  setNewProductPrice
}: {
  productName: string
  suggestions: ProductSuggestion[]
  squareProducts: SquareProduct[]
  onLink: (invoiceProductName: string, squareProductId: string) => void
  onCreateNew: () => void
  isCreating: boolean
  newProductName: string
  setNewProductName: (name: string) => void
  newProductDescription: string
  setNewProductDescription: (desc: string) => void
  newProductSku: string
  setNewProductSku: (sku: string) => void
  newProductPrice: string
  setNewProductPrice: (price: string) => void
}) {
  const [selectedSquareProduct, setSelectedSquareProduct] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    setNewProductName(productName)
  }, [productName, setNewProductName])

  return (
    <div className="space-y-6">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Suggested Matches</h4>
          <div className="space-y-2">
            {suggestions.slice(0, 5).map((suggestion) => (
              <div key={suggestion.squareProduct.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{suggestion.squareProduct.name}</span>
                    <Badge variant={suggestion.isExactMatch ? "default" : "secondary"}>
                      {(suggestion.confidence * 100).toFixed(0)}% match
                    </Badge>
                  </div>
                  {suggestion.squareProduct.description && (
                    <p className="text-sm text-gray-600 mt-1">{suggestion.squareProduct.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => onLink(productName, suggestion.squareProduct.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Link
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Selection */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Select Existing Product</h4>
        <div className="flex items-center space-x-2">
          <Select value={selectedSquareProduct} onValueChange={setSelectedSquareProduct}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose a Square product..." />
            </SelectTrigger>
            <SelectContent>
              {squareProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                  {product.price && ` - $${product.price.toFixed(2)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => onLink(productName, selectedSquareProduct)}
            disabled={!selectedSquareProduct}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Link
          </Button>
        </div>
      </div>

      {/* Create New Product */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Create New Product</h4>
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
              onClick={onCreateNew}
              disabled={!newProductName || isCreating}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isCreating ? (
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
  )
}
