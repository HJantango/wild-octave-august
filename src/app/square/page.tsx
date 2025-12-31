'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { SquareDashboard } from '@/components/square/SquareDashboard';

export default function SquarePage() {
  return (
    <DashboardLayout>
      <SquareDashboard />
    </DashboardLayout>
  );
}