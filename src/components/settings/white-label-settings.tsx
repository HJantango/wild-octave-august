'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast';

export function WhiteLabelSettings() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const currentSettings = useMemo(() => {
    if (!settings) return {};
    
    return {
      company_name: editedValues.company_name ?? settings.company_name?.value ?? 'Wild Octave Organics',
      logo_url: editedValues.logo_url ?? settings.logo_url?.value ?? null,
    };
  }, [settings, editedValues]);

  const handleSettingChange = (key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please select an image file (PNG, JPG, GIF, etc.)'
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Please select an image smaller than 2MB'
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      handleSettingChange('logo_url', result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      const updatesToSend = Object.entries(editedValues).map(([key, value]) => {
        let description = '';
        switch (key) {
          case 'company_name':
            description = 'Company name displayed in the navigation and branding';
            break;
          case 'logo_url':
            description = 'Company logo displayed in the navigation';
            break;
        }
        
        return { key, value, description };
      });

      await updateSettings.mutateAsync(updatesToSend);
      
      setEditedValues({});
      setHasChanges(false);
      setLogoFile(null);
      
      addToast({
        type: 'success',
        title: 'White Label Settings Saved',
        message: 'Your branding has been updated successfully!'
      });

      // Refresh page to show new branding
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Failed to save settings:', error);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save white label settings. Please try again.'
      });
    }
  };

  const handleReset = () => {
    setEditedValues({});
    setHasChanges(false);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-red-600 mb-2">Failed to load white label settings</div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>White Label Settings</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Customize the branding and appearance of your dashboard
            </p>
          </div>
          {hasChanges && (
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            Loading white label settings...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Company Name
                </label>
                <Input
                  type="text"
                  value={currentSettings.company_name || ''}
                  onChange={(e) => handleSettingChange('company_name', e.target.value)}
                  placeholder="Enter your company name"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  This name will appear in the navigation header and throughout the dashboard
                </p>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Company Logo
                </label>
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={updateSettings.isPending}
                  >
                    {logoFile ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Upload a logo image (PNG, JPG, GIF) • Max 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Preview */}
            {(logoPreview || currentSettings.logo_url) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Logo Preview
                </label>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={logoPreview || currentSettings.logo_url}
                    alt="Company Logo"
                    className="h-8 w-8 object-contain rounded"
                  />
                  <span className="text-sm text-gray-600">
                    This is how your logo will appear in the navigation
                  </span>
                </div>
              </div>
            )}

            {/* Preview Section */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-6">
              <h4 className="text-white font-medium mb-3">Preview</h4>
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center">
                  {(logoPreview || currentSettings.logo_url) ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                      <img
                        src={logoPreview || currentSettings.logo_url}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">🌿</span>
                    </div>
                  )}
                  <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    {currentSettings.company_name || 'Your Company Name'}
                  </h1>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📝 Important Notes</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Changes will take effect immediately after saving</li>
                <li>• The page will refresh automatically to show new branding</li>
                <li>• Logo images are stored as base64 data in the database</li>
                <li>• For best results, use square logos with transparent backgrounds</li>
                <li>• Recommended logo size: 32x32 pixels or larger (will be scaled down)</li>
              </ul>
            </div>

            {updateSettings.isError && (
              <div className="bg-red-50 p-3 rounded-md">
                <div className="text-red-800 text-sm">
                  Failed to save settings: {updateSettings.error?.message}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}