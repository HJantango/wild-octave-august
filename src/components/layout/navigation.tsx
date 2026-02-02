'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState, useRef, useEffect } from 'react';

interface NavItem {
  name: string;
  href?: string;
  icon: string;
  submenu?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  {
    name: 'Ordering',
    icon: '🛒',
    submenu: [
      { name: '6 Week Sales Order', href: '/orders' },
      { name: 'Extended Sales Analysis', href: '/orders/extended' },
      { name: 'Pie Calculator', href: '/orders/pie-calculator' },
      { name: 'Purchase Orders', href: '/ordering/purchase-orders' },
      { name: 'Order Calendar', href: '/ordering/calendar' },
      { name: 'Vendor Schedules', href: '/ordering/vendor-schedules' },
      { name: 'Cafe Schedule', href: '/ordering/cafe-schedule' },
      { name: 'AI Smart Order', href: '/ordering/suggestions' },
      { name: 'Invoice Based Suggestions', href: '/ordering/historical' },
      { name: 'Manage Inventory', href: '/ordering/inventory' },
      { name: 'Vendor Settings', href: '/ordering/vendors' },
    ],
  },
  {
    name: 'Receiving',
    icon: '📦',
    submenu: [
      { name: 'Invoices', href: '/invoices' },
      { name: 'Upload Invoice', href: '/invoices/upload' },
      { name: 'Rectification', href: '/rectification' },
    ],
  },
  {
    name: 'Shop Ops',
    icon: '🏪',
    submenu: [
      { name: 'Diary', href: '/shop-diary' },
      { name: 'Roster', href: '/roster' },
      { name: 'Staff Leave', href: '/leave' },
      { name: 'Timesheets', href: '/team/timesheets' },
      { name: 'Xmas Schedule', href: '/ordering/christmas-closures' },
      { name: 'Cafe Schedule', href: '/ordering/cafe-schedule' },
      { name: 'Cafe Labels', href: '/labels/cafe' },
    ],
  },
  {
    name: 'Efficiencies',
    icon: '📈',
    submenu: [
      { name: 'Profit Margins', href: '/reports/margins' },
      { name: 'Vendor Performance', href: '/reports/vendor-performance' },
      { name: 'Wastage & Discounts', href: '/reports/wastage-discounts' },
      { name: 'Product Actions', href: '/reports/product-actions' },
      { name: 'Missing Products', href: '/orders/missing-products' },
    ],
  },
  { name: 'Items', href: '/items', icon: '📋' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

function DropdownMenu({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center px-1 pt-1 pb-1 border-b-2 text-sm font-medium h-16
          ${isActive
            ? 'border-primary text-gray-900'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }
        `}
      >
        <span className="mr-2">{item.icon}</span>
        {item.name}
        <svg
          className={`ml-1 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && item.submenu && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {item.submenu.map((subItem) => {
              const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
              return (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    block px-4 py-2 text-sm
                    ${isSubActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {subItem.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isItemActive = (item: NavItem) => {
    if (item.href) {
      return pathname === item.href;
    }
    if (item.submenu) {
      return item.submenu.some(subItem =>
        pathname === subItem.href || pathname.startsWith(subItem.href + '/')
      );
    }
    return false;
  };

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
                const isActive = isItemActive(item);

                if (item.submenu) {
                  return <DropdownMenu key={item.name} item={item} isActive={isActive} />;
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href!}
                    className={`
                      inline-flex items-center px-1 pt-1 pb-1 border-b-2 text-sm font-medium h-16
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
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const isItemActive = (item: NavItem) => {
    if (item.href) {
      return pathname === item.href;
    }
    if (item.submenu) {
      return item.submenu.some(subItem =>
        pathname === subItem.href || pathname.startsWith(subItem.href + '/')
      );
    }
    return false;
  };

  return (
    <div className="sm:hidden">
      <div className="pt-2 pb-3 space-y-1">
        {navigation.map((item) => {
          const isActive = isItemActive(item);
          const isOpen = openMenus.includes(item.name);

          if (item.submenu) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={`
                    w-full flex items-center justify-between pl-3 pr-4 py-2 border-l-4 text-base font-medium
                    ${isActive
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                    }
                  `}
                >
                  <span>
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </span>
                  <svg
                    className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="bg-gray-50">
                    {item.submenu.map((subItem) => {
                      const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`
                            block pl-10 pr-4 py-2 text-sm
                            ${isSubActive
                              ? 'bg-primary/20 text-primary font-medium'
                              : 'text-gray-600 hover:bg-gray-100'
                            }
                          `}
                        >
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href!}
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
