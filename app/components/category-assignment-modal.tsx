
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tag, Package, Percent } from 'lucide-react'

interface Category {
  id: string
  name: string
  markup: number
}

interface LineItem {
  id?: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  needs_clarification: boolean
  clarification_note?: string
}

interface CategoryAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  selectedLineItem: LineItem | null
  onCategoryAssigned: (categoryId: string) => void
}

export default function CategoryAssignmentModal({
  isOpen,
  onClose,
  categories,
  selectedLineItem,
  onCategoryAssigned
}: CategoryAssignmentModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  const handleAssign = () => {
    if (selectedCategoryId) {
      onCategoryAssigned(selectedCategoryId)
      setSelectedCategoryId('')
    }
  }

  const calculateFinalPrice = (categoryId: string) => {
    if (!selectedLineItem) return 0
    const category = categories.find(c => c.id === categoryId)
    return category ? selectedLineItem.unit_price * category.markup : 0
  }

  const getCategoryColor = (categoryName: string) => {
    const colors: { [key: string]: string } = {
      'House': 'bg-blue-100 text-blue-800 border-blue-200',
      'Bulk': 'bg-orange-100 text-orange-800 border-orange-200',
      'Fruit & Veg': 'bg-green-100 text-green-800 border-green-200',
      'Fridge & Freezer': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'Naturo': 'bg-purple-100 text-purple-800 border-purple-200',
      'Groceries': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Drinks Fridge': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Supplements': 'bg-pink-100 text-pink-800 border-pink-200',
      'Personal Care': 'bg-rose-100 text-rose-800 border-rose-200',
      'Fresh Bread': 'bg-amber-100 text-amber-800 border-amber-200',
    }
    return colors[categoryName] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Tag className="w-5 h-5" />
            <span>Assign Category</span>
          </DialogTitle>
          <DialogDescription>
            Select a category for this product to apply the appropriate markup.
          </DialogDescription>
        </DialogHeader>

        {selectedLineItem && (
          <div className="space-y-6">
            {/* Product Info */}
            <Card className="p-4 bg-gray-50">
              <div className="flex items-start space-x-3">
                <Package className="w-5 h-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {selectedLineItem.product_name}
                  </h4>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Quantity:</span> {selectedLineItem.quantity}
                    </div>
                    <div>
                      <span className="font-medium">Unit Price:</span> ${selectedLineItem.unit_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Category Selection */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Select Category</h4>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <Card
                    key={category.id}
                    className={`p-4 cursor-pointer border-2 transition-all hover:shadow-md ${
                      selectedCategoryId === category.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCategoryId(category.id)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className={getCategoryColor(category.name)}>
                          {category.name}
                        </Badge>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Percent className="w-3 h-3" />
                          <span>{((category.markup - 1) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600">
                        Markup: {category.markup}x
                      </div>
                      
                      {selectedCategoryId === category.id && (
                        <div className="pt-2 border-t border-green-200">
                          <div className="text-sm">
                            <div className="text-gray-600">Final Price:</div>
                            <div className="font-bold text-green-600">
                              ${calculateFinalPrice(category.id).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssign}
                disabled={!selectedCategoryId}
                className="bg-green-600 hover:bg-green-700"
              >
                Assign Category
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
