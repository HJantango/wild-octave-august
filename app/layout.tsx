
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wild Octave Organics',
  description: 'Professional organic food invoice processing with intelligent categorization and markup calculation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                      <img src="/wild-octave-new-logo.png" alt="Wild Octave Organics" className="w-8 h-8 object-contain" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">
                      Wild Octave Organics
                    </h1>
                  </div>
                  <div className="flex items-center space-x-6">
                    <nav className="hidden md:flex items-center space-x-4">
                      <a href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        Invoice Upload
                      </a>
                      <a href="/square" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        Square Integration
                      </a>
                    </nav>
                    <div className="text-sm text-gray-600">
                      Professional Organic Invoice Management
                    </div>
                  </div>
                </div>
              </div>
            </header>
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
