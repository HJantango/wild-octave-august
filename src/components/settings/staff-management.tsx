'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserIcon, EditIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

interface Staff {
  id: string;
  name: string;
  role: string;
  baseHourlyRate: number;
  email?: string;
  phone?: string;
  isActive: boolean;
}

const DEFAULT_ROLES = [
  'Manager',
  'Barista',
  'Counter/Roam',
  'Kitchen',
  'Junior',
  'Check-in/Admin'
];

export function StaffManagement() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [baseHourlyRate, setBaseHourlyRate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/roster/staff');
      const result = await response.json();
      if (result.success) {
        setStaff(result.data);
        
        // Extract custom roles
        const allRoles = result.data.map((s: Staff) => s.role);
        const custom = allRoles.filter((r: string) => !DEFAULT_ROLES.includes(r));
        setCustomRoles([...new Set(custom)]);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (staffMember?: Staff) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setName(staffMember.name);
      setRole(staffMember.role);
      setBaseHourlyRate(staffMember.baseHourlyRate.toString());
      setEmail(staffMember.email || '');
      setPhone(staffMember.phone || '');
      setIsActive(staffMember.isActive);
    } else {
      setEditingStaff(null);
      setName('');
      setRole('');
      setCustomRole('');
      setBaseHourlyRate('');
      setEmail('');
      setPhone('');
      setIsActive(true);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingStaff(null);
    setName('');
    setRole('');
    setCustomRole('');
    setBaseHourlyRate('');
    setEmail('');
    setPhone('');
    setIsActive(true);
  };

  const handleSave = async () => {
    const finalRole = role === 'custom' ? customRole : role;
    
    if (!name || !finalRole || !baseHourlyRate) {
      toast.error('Validation Error', 'Please fill in all required fields');
      return;
    }

    const staffData = {
      name,
      role: finalRole,
      baseHourlyRate: parseFloat(baseHourlyRate),
      email: email.trim() || null,
      phone: phone.trim() || null,
      isActive
    };

    try {
      const url = editingStaff ? '/api/roster/staff' : '/api/roster/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingStaff ? { ...staffData, id: editingStaff.id } : staffData)
      });

      const result = await response.json();
      if (result.success) {
        await loadStaff();
        closeModal();
        toast.success('Success', editingStaff ? 'Staff member updated successfully' : 'Staff member added successfully');
      } else {
        toast.error('Save Failed', `Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error('Error', 'Failed to save staff member');
    }
  };

  const handleDelete = async (staffId: string) => {
    toast.addToast({
      type: 'warning',
      title: 'Deactivate Staff Member?',
      message: 'This will remove them from future rosters',
      duration: 0,
      action: {
        label: 'Deactivate',
        onClick: async () => {
          await performDelete(staffId);
        }
      }
    });
  };

  const performDelete = async (staffId: string) => {
    try {
      const response = await fetch('/api/roster/staff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: staffId, isActive: false })
      });

      const result = await response.json();
      if (result.success) {
        await loadStaff();
        toast.success('Deactivated', 'Staff member has been deactivated');
      } else {
        toast.error('Deactivation Failed', `Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deactivating staff:', error);
      toast.error('Error', 'Failed to deactivate staff member');
    }
  };

  const allRoles = [...DEFAULT_ROLES, ...customRoles];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserIcon className="w-5 h-5" />
            <span>Staff Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5" />
              <span>Staff Management</span>
            </div>
            <Button onClick={() => openModal()} className="flex items-center space-x-1">
              <PlusIcon className="w-4 h-4" />
              <span>Add Staff</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  staffMember.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    staffMember.isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{staffMember.name}</div>
                    <div className="text-sm text-gray-500">{staffMember.role}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        staffMember.email 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {staffMember.email ? '📧 Email configured' : '⚠️ No email'}
                      </span>
                      {staffMember.phone && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          📱 Phone
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(staffMember.baseHourlyRate)}/hr</div>
                    <div className={`text-xs ${staffMember.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {staffMember.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(staffMember)}
                      className="h-8 w-8 p-0"
                    >
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    {staffMember.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(staffMember.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {staff.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No staff members found. Click "Add Staff" to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
            </DialogTitle>
            <DialogDescription>
              {editingStaff ? 'Update staff member details' : 'Add a new staff member to the roster system'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter staff member name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((roleOption) => (
                    <SelectItem key={roleOption} value={roleOption}>
                      {roleOption}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Add Custom Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {role === 'custom' && (
              <div className="grid gap-2">
                <Label htmlFor="customRole">Custom Role</Label>
                <Input
                  id="customRole"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Enter custom role name"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="rate">Base Hourly Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Input
                  id="rate"
                  type="number"
                  step="0.50"
                  value={baseHourlyRate}
                  onChange={(e) => setBaseHourlyRate(e.target.value)}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email Address (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
              />
              <p className="text-xs text-gray-500">
                Required for automatic roster email notifications
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0412 345 678"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="active" className="text-sm font-normal">
                Active staff member
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingStaff ? 'Update' : 'Add'} Staff Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}