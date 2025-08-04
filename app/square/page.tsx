
import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SquareAdminDashboard from '@/components/square-admin-dashboard'
import ProductLinkingInterface from '@/components/product-linking-interface'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function SquareIntegrationPage() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Square Integration Management
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Manage your Square API integration, sync products, handle inventory, and link invoice items to Square products.
        </p>
      </div>

      <Suspense fallback={
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading Square integration...</span>
          </div>
        </Card>
      }>
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="product-linking">Product Linking</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <SquareAdminDashboard />
          </TabsContent>

          <TabsContent value="product-linking" className="space-y-6">
            <ProductLinkingInterface />
          </TabsContent>
        </Tabs>
      </Suspense>
    </div>
  )
}
