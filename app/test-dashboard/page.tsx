'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'

interface Invoice {
  id: string
  vendor: { name: string }
  totalAmount: number
  createdAt: string
}

export default function TestDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch data on client side to avoid build-time database calls
    async function fetchInvoices() {
      try {
        const response = await fetch('/api/invoices')
        if (response.ok) {
          const data = await response.json()
          setInvoices(data)
        } else {
          setError('Failed to fetch invoices')
        }
      } catch (err) {
        setError('Error connecting to database')
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Test Dashboard</h1>
        <div className="animate-pulse">Loading invoices...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Test Dashboard</h1>
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-600">Error: {error}</p>
          <p className="text-sm text-red-500 mt-2">
            This is expected if the database isn't connected yet.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Test Dashboard</h1>
      
      <div className="grid gap-4">
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Database Status</h2>
          <p className="text-green-600">✅ Connected successfully</p>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-gray-600">No invoices found. Upload your first invoice!</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{invoice.vendor.name}</span>
                  <span>${invoice.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
