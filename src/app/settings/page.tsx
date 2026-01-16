'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryMarkups } from '@/components/settings/category-markups';
import { GeneralSettings } from '@/components/settings/general-settings';
import { StaffManagement } from '@/components/settings/staff-management';
import { WhiteLabelSettings } from '@/components/settings/white-label-settings';
import { UserManagement } from '@/components/settings/user-management';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your system preferences and pricing rules</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          <WhiteLabelSettings />
          <GeneralSettings />
          <UserManagement />
          <StaffManagement />
          <CategoryMarkups />
        </div>

        {/* System Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">System Information</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• Changes to category markups will apply to future invoice processing</div>
            <div>• Existing items will keep their current markups until updated</div>
            <div>• OCR provider changes take effect immediately for new invoice uploads</div>
            <div>• All settings are stored securely and backed up automatically</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}