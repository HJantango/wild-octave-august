'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2, ShoppingCart, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TodaysOrder {
  scheduleId: string;
  scheduledOrderId: string | null;
  vendorId: string;
  vendorName: string;
  orderDay: string;
  orderDeadline: string | null;
  deliveryDay: string | null;
  frequency: string;
  status: 'upcoming' | 'due-now' | 'overdue' | 'placed';
  purchaseOrder: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  notes: string | null;
}

interface TodaysOrdersData {
  date: string;
  dayName: string;
  orders: TodaysOrder[];
  summary: {
    total: number;
    overdue: number;
    dueNow: number;
    upcoming: number;
    placed: number;
  };
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'overdue':
      return {
        label: 'Overdue',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-400',
        badgeClass: 'bg-red-500 text-white',
        icon: AlertTriangle,
      };
    case 'due-now':
      return {
        label: 'Due Now',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-400',
        badgeClass: 'bg-yellow-500 text-white',
        icon: Clock,
      };
    case 'placed':
      return {
        label: 'Placed',
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        borderColor: 'border-green-400',
        badgeClass: 'bg-green-500 text-white',
        icon: CheckCircle2,
      };
    default:
      return {
        label: 'Upcoming',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-800',
        borderColor: 'border-purple-300',
        badgeClass: 'bg-purple-500 text-white',
        icon: ShoppingCart,
      };
  }
}

function getCountdownText(deadline: string | null): string | null {
  if (!deadline) return null;
  const match = deadline.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const now = new Date();
  const deadlineTime = new Date(now);
  deadlineTime.setHours(hour, minute, 0, 0);

  const minutesUntil = Math.round((deadlineTime.getTime() - now.getTime()) / (1000 * 60));

  if (minutesUntil < 0) {
    const overMinutes = Math.abs(minutesUntil);
    if (overMinutes >= 60) {
      return `${Math.floor(overMinutes / 60)}h ${overMinutes % 60}m overdue`;
    }
    return `${overMinutes}m overdue`;
  }
  if (minutesUntil === 0) return 'Due now!';
  if (minutesUntil < 60) return `${minutesUntil}m remaining`;
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  return `${hours}h ${mins}m remaining`;
}

export function TodaysOrders() {
  const { data, isLoading } = useQuery<{ data: TodaysOrdersData }>({
    queryKey: ['todaysOrders'],
    queryFn: async () => {
      const res = await fetch('/api/todays-orders');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute for countdown updates
  });

  const ordersData = data?.data;

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="flex items-center space-x-2">
            <span>📋</span>
            <span>Orders Due Today</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ordersData || ordersData.orders.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span>
              <span>Orders Due Today</span>
            </CardTitle>
            <Badge className="bg-green-100 text-green-800">All Clear</Badge>
          </div>
          <CardDescription>{ordersData?.dayName || 'Today'} — No orders due</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-4 text-gray-500">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400" />
            <p>No vendor orders scheduled for today</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary } = ordersData;

  return (
    <Card className={`border-0 shadow-lg ${
      summary.overdue > 0 ? 'ring-2 ring-red-300' : summary.dueNow > 0 ? 'ring-2 ring-yellow-300' : ''
    }`}>
      <CardHeader className={`${
        summary.overdue > 0
          ? 'bg-gradient-to-r from-red-50 to-orange-50'
          : 'bg-gradient-to-r from-purple-50 to-pink-50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>{summary.overdue > 0 ? '🚨' : '📋'}</span>
              <span>Orders Due Today</span>
            </CardTitle>
            <CardDescription>
              {ordersData.dayName} — {summary.total} order{summary.total !== 1 ? 's' : ''} scheduled
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {summary.overdue > 0 && (
              <Badge className="bg-red-500 text-white">{summary.overdue} Overdue</Badge>
            )}
            {summary.dueNow > 0 && (
              <Badge className="bg-yellow-500 text-white">{summary.dueNow} Due Now</Badge>
            )}
            {summary.placed > 0 && (
              <Badge className="bg-green-100 text-green-800">{summary.placed} Placed</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {ordersData.orders.map((order) => {
            const config = getStatusConfig(order.status);
            const countdown = order.status !== 'placed' ? getCountdownText(order.orderDeadline) : null;
            const StatusIcon = config.icon;

            return (
              <div
                key={order.scheduleId}
                className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${config.bgColor} ${config.borderColor}`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <StatusIcon className={`h-5 w-5 flex-shrink-0 ${config.textColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-gray-900 truncate">{order.vendorName}</p>
                      <Badge className={config.badgeClass}>{config.label}</Badge>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      {order.orderDeadline && (
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          by {order.orderDeadline}
                        </span>
                      )}
                      {countdown && (
                        <span className={`font-medium ${
                          order.status === 'overdue' ? 'text-red-600' :
                          order.status === 'due-now' ? 'text-yellow-700' :
                          'text-purple-600'
                        }`}>
                          ({countdown})
                        </span>
                      )}
                      {order.deliveryDay && (
                        <span>→ Delivery: {order.deliveryDay}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {order.status === 'placed' && order.purchaseOrder ? (
                    <Link href={`/ordering/purchase-orders/${order.purchaseOrder.id}`}>
                      <Button size="sm" variant="outline" className="text-green-700">
                        View PO
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/orders?vendorId=${order.vendorId}`}>
                      <Button size="sm" className={`${
                        order.status === 'overdue'
                          ? 'bg-red-600 hover:bg-red-700'
                          : order.status === 'due-now'
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                      } text-white`}>
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Order
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
