'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Diary', href: '/shop-diary', icon: '📝' },
  { name: 'Orders', href: '/orders', icon: '📋' },
  { name: 'Ordering', href: '/ordering', icon: '🛒' },
  { name: 'Invoices', href: '/invoices', icon: '📄' },
  { name: 'Items', href: '/items', icon: '📦' },
  { name: 'Wastage', href: '/reports/wastage-discounts', icon: '🗑️' },
  { name: 'Actions', href: '/reports/product-actions', icon: '✅' },
  { name: 'Roster', href: '/roster', icon: '👥' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Navigation() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="Wild Octave Organics"
                  width={120}
                  height={40}
                  className="h-10 w-auto object-contain cursor-pointer"
                  priority
                />
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                      ${isActive
                        ? 'border-primary text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <div className="sm:hidden">
      <div className="pt-2 pb-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                block pl-3 pr-4 py-2 border-l-4 text-base font-medium
                ${isActive
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }
              `}
            >
              <span className="mr-2">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}