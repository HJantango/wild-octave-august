'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { UserIcon, DollarSignIcon, SettingsIcon, SaveIcon, PlusIcon, TrashIcon } from 'lucide-react';
import Link from 'next/link';

interface Staff {
  id: string;
  name: string;
  role: string;
  canDoBarista?: boolean;
  baseHourlyRate: number;
  saturdayHourlyRate?: number;
  sundayHourlyRate?: number;
  publicHolidayHourlyRate?: number;
  taxRate: number;
  superRate?: number | null;
  email?: string;
  phone?: string;
  isActive: boolean;
}

interface Settings {
  weeklySalesTarget: number;
  targetWagePercentage: number;
}

const DEFAULT_ROLES = [
  'Manager',
  'Barista', 
  'Counter/Roam',
  'Kitchen Staff',
  'Junior',
  'Check-in/Admin'
];

export default function AdminPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<Settings>({
    weeklySalesTarget: 25000,
    targetWagePercentage: 30
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [newStaffRate, setNewStaffRate] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load staff data
      const staffResponse = await fetch('/api/roster/staff');
      const staffResult = await staffResponse.json();
      if (staffResult.success) {
        setStaff(staffResult.data);
        
        // Extract custom roles
        const allRoles = staffResult.data.map((s: Staff) => s.role);
        const custom = allRoles.filter((r: string) => !DEFAULT_ROLES.includes(r));
        setCustomRoles([...new Set(custom)]);
      }

      // Load settings data
      const settingsResponse = await fetch('/api/settings');
      const settingsResult = await settingsResponse.json();
      if (settingsResult.success) {
        const data = settingsResult.data;
        setSettings({
          weeklySalesTarget: data.weekly_sales_target?.value || 25000,
          targetWagePercentage: data.target_wage_percentage?.value || 30
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveStaff = async () => {
    try {
      setSaving(true);
      
      // Save staff data
      const staffPromises = staff.map(async (person) => {
        // Skip temporary IDs (newly added staff that haven't been saved yet)
        if (person.id.startsWith('temp-')) {
          const response = await fetch('/api/roster/staff', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: person.name,
              role: person.role,
              baseHourlyRate: person.baseHourlyRate,
              saturdayHourlyRate: person.saturdayHourlyRate,
              sundayHourlyRate: person.sundayHourlyRate,
              publicHolidayHourlyRate: person.publicHolidayHourlyRate,
              isActive: person.isActive
            }),
          });
          return response.json();
        } else {
          const response = await fetch('/api/roster/staff', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: person.id,
              name: person.name,
              role: person.role,
              baseHourlyRate: person.baseHourlyRate,
              saturdayHourlyRate: person.saturdayHourlyRate,
              sundayHourlyRate: person.sundayHourlyRate,
              publicHolidayHourlyRate: person.publicHolidayHourlyRate,
              isActive: person.isActive
            }),
          });
          return response.json();
        }
      });

      // Save settings data
      const settingsPromise = fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            key: 'weekly_sales_target',
            value: settings.weeklySalesTarget,
            description: 'Target weekly sales amount'
          },
          {
            key: 'target_wage_percentage',
            value: settings.targetWagePercentage,
            description: 'Target wage percentage of sales'
          }
        ]),
      }).then(res => res.json());

      const [staffResults, settingsResult] = await Promise.all([
        Promise.all(staffPromises),
        settingsPromise
      ]);

      const staffFailures = staffResults.filter(result => !result.success);
      
      if (staffFailures.length === 0 && settingsResult.success) {
        toast.success('Changes Saved', 'Staff and settings updated successfully!');
        await loadData(); // Reload to get proper IDs for newly created staff
      } else {
        const errors = [];
        if (staffFailures.length > 0) {
          errors.push(`Failed to save ${staffFailures.length} staff members`);
        }
        if (!settingsResult.success) {
          errors.push('Failed to save settings');
        }
        throw new Error(errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Save Failed', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addStaff = async () => {
    if (!newStaffName || !newStaffRole || !newStaffRate) {
      toast.error('Validation Error', 'Please fill in all fields');
      return;
    }

    const isJunior = newStaffRole.toLowerCase().includes('junior');
    const newStaff: Staff = {
      id: `temp-${Date.now()}`,
      name: newStaffName,
      role: newStaffRole,
      baseHourlyRate: parseFloat(newStaffRate),
      taxRate: 30, // Default 30%
      superRate: isJunior ? null : 11.5, // No super for juniors by default
      email: newStaffEmail || undefined,
      phone: newStaffPhone || undefined,
      isActive: true
    };

    setStaff([...staff, newStaff]);
    setNewStaffName('');
    setNewStaffRole('');
    setNewStaffRate('');
    setNewStaffEmail('');
    setNewStaffPhone('');
  };

  const updateStaff = (id: string, field: keyof Staff, value: any) => {
    setStaff(staff.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStaff = (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    toast.addToast({
      type: 'warning',
      title: 'Remove Staff Member?',
      message: `This will deactivate ${staffMember?.name}`,
      duration: 0,
      action: {
        label: 'Remove',
        onClick: () => {
          setStaff(staff.map(s => s.id === id ? { ...s, isActive: false } : s));
        }
      }
    });
  };

  const addCustomRole = () => {
    if (!newRoleName.trim()) {
      toast.error('Validation Error', 'Please enter a role name');
      return;
    }
    if (getAllRoles().includes(newRoleName.trim())) {
      toast.error('Validation Error', 'This role already exists');
      return;
    }
    setCustomRoles([...customRoles, newRoleName.trim()]);
    setNewRoleName('');
  };

  const removeCustomRole = (roleName: string) => {
    toast.addToast({
      type: 'warning',
      title: 'Remove Role?',
      message: `Remove the "${roleName}" role? Staff with this role will need to be updated.`,
      duration: 0,
      action: {
        label: 'Remove',
        onClick: () => {
          setCustomRoles(customRoles.filter(r => r !== roleName));
        }
      }
    });
  };

  const getAllRoles = () => {
    return [...DEFAULT_ROLES, ...customRoles];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Roster Admin</h1>
                <p className="text-pink-100 text-lg">
                  Manage staff, wages, and roster settings
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex flex-col sm:flex-row gap-3">
                <Link href="/roster">
                  <Button
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    ← Back to Roster
                  </Button>
                </Link>
                <Button
                  onClick={saveStaff}
                  disabled={saving}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSignIcon className="w-5 h-5" />
                <span>Sales & Wage Targets</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Weekly Sales Target with Slider */}
              <div>
                <Label htmlFor="weeklySales">Weekly Sales Target</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="10000"
                    max="50000"
                    step="500"
                    value={settings.weeklySalesTarget}
                    onChange={(e) => setSettings(s => ({ ...s, weeklySalesTarget: parseFloat(e.target.value) }))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <Input
                    id="weeklySales"
                    type="number"
                    value={settings.weeklySalesTarget}
                    onChange={(e) => setSettings(s => ({ ...s, weeklySalesTarget: parseFloat(e.target.value) || 0 }))}
                    className="w-28"
                  />
                </div>
                <p className="text-lg font-semibold text-blue-600 mt-2">
                  {formatCurrency(settings.weeklySalesTarget)} / week
                </p>
              </div>

              {/* Calculate from Daily Average */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label className="text-blue-800">Calculate from Daily Average</Label>
                <p className="text-xs text-blue-600 mb-2">Enter your daily average and we'll calculate weekly (×7)</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <Input
                    type="number"
                    step="100"
                    placeholder="e.g. 3200"
                    className="w-32"
                    onChange={(e) => {
                      const daily = parseFloat(e.target.value);
                      if (daily > 0) {
                        setSettings(s => ({ ...s, weeklySalesTarget: Math.round(daily * 7) }));
                      }
                    }}
                  />
                  <span className="text-gray-500">/ day</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="font-semibold text-blue-700">{formatCurrency(settings.weeklySalesTarget)} / week</span>
                </div>
              </div>

              {/* Target Wage Percentage */}
              <div>
                <Label htmlFor="wagePercentage">Target Wage Percentage</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="15"
                    max="45"
                    step="1"
                    value={settings.targetWagePercentage}
                    onChange={(e) => setSettings(s => ({ ...s, targetWagePercentage: parseFloat(e.target.value) }))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                  <Input
                    id="wagePercentage"
                    type="number"
                    value={settings.targetWagePercentage}
                    onChange={(e) => setSettings(s => ({ ...s, targetWagePercentage: parseFloat(e.target.value) || 0 }))}
                    className="w-20"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Target wage budget: <span className="font-semibold text-green-600">{formatCurrency(settings.weeklySalesTarget * settings.targetWagePercentage / 100)}</span> / week
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PlusIcon className="w-5 h-5" />
                <span>Add New Staff</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="newName">Name</Label>
                <Input
                  id="newName"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newRole">Role</Label>
                <Select value={newStaffRole} onValueChange={setNewStaffRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllRoles().map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="newRate">Hourly Rate ($)</Label>
                <Input
                  id="newRate"
                  type="number"
                  step="0.50"
                  value={newStaffRate}
                  onChange={(e) => setNewStaffRate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newEmail">Email (Optional)</Label>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="staff@example.com"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">For roster email notifications</p>
              </div>
              <div>
                <Label htmlFor="newPhone">Phone Number (Optional)</Label>
                <Input
                  id="newPhone"
                  type="tel"
                  placeholder="0412 345 678"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">For roster SMS (Australian mobile)</p>
              </div>
              <Button onClick={addStaff} className="w-full">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Role Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SettingsIcon className="w-5 h-5" />
              <span>Role Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Add New Role */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter new role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomRole()}
                />
                <Button onClick={addCustomRole}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Role
                </Button>
              </div>
              
              {/* Roles List */}
              <div className="space-y-2">
                <Label>Available Roles</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {DEFAULT_ROLES.map((role) => (
                    <div key={role} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{role}</span>
                      <span className="text-xs text-gray-500">Default</span>
                    </div>
                  ))}
                  {customRoles.map((role) => (
                    <div key={role} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium">{role}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomRole(role)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5" />
              <span>Staff Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {staff.filter(s => s.isActive).map((person) => (
                <div key={person.id} className="grid grid-cols-1 gap-4 p-4 border rounded-lg">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={person.name}
                        onChange={(e) => updateStaff(person.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select
                        value={person.role}
                        onValueChange={(value) => updateStaff(person.id, 'role', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getAllRoles().map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Can Do Barista Toggle */}
                      {!person.role.toLowerCase().includes('barista') && (
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={person.canDoBarista || false}
                            onChange={(e) => updateStaff(person.id, 'canDoBarista', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-xs text-gray-600">Can cover barista shifts</span>
                        </label>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeStaff(person.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="staff@example.com"
                        value={person.email || ''}
                        onChange={(e) => updateStaff(person.id, 'email', e.target.value || null)}
                      />
                      <p className="text-xs text-gray-500 mt-1">For roster email notifications</p>
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        type="tel"
                        placeholder="0412 345 678"
                        value={person.phone || ''}
                        onChange={(e) => updateStaff(person.id, 'phone', e.target.value || null)}
                      />
                      <p className="text-xs text-gray-500 mt-1">For roster SMS (Australian mobile)</p>
                    </div>
                  </div>

                  {/* Hourly Rates */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                    <div>
                      <Label>Base Hourly Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={person.baseHourlyRate}
                        onChange={(e) => updateStaff(person.id, 'baseHourlyRate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Saturday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={person.saturdayHourlyRate || ''}
                        placeholder={`Default: ${person.baseHourlyRate}`}
                        onChange={(e) => updateStaff(person.id, 'saturdayHourlyRate', parseFloat(e.target.value) || null)}
                      />
                    </div>
                    <div>
                      <Label>Sunday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={person.sundayHourlyRate || ''}
                        placeholder={`Default: ${person.baseHourlyRate}`}
                        onChange={(e) => updateStaff(person.id, 'sundayHourlyRate', parseFloat(e.target.value) || null)}
                      />
                    </div>
                    <div>
                      <Label>Public Holiday Rate ($)</Label>
                      <Input
                        type="number"
                        step="0.50"
                        value={person.publicHolidayHourlyRate || ''}
                        placeholder={`Default: ${person.baseHourlyRate}`}
                        onChange={(e) => updateStaff(person.id, 'publicHolidayHourlyRate', parseFloat(e.target.value) || null)}
                      />
                    </div>
                  </div>
                  
                  {/* Tax & Super Rates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={person.taxRate}
                        placeholder="30"
                        onChange={(e) => updateStaff(person.id, 'taxRate', parseFloat(e.target.value) || 30)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Withholding tax percentage (e.g., 30 = 30%)</p>
                    </div>
                    <div>
                      <Label>Super Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={person.superRate ?? ''}
                        placeholder={person.role.toLowerCase().includes('junior') ? 'No super (junior)' : '11.5'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateStaff(person.id, 'superRate', val === '' ? null : parseFloat(val));
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for no super (juniors under 18)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}