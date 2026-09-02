'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import {
  UserCog, Shield, ShieldCheck, Building2, Plus, Search, RotateCcw,
  Download, Edit, CheckCircle2, XCircle, X, Users, Key, Star, Check,
  Lock, Mail, Phone, RefreshCw, Zap, Trash2, Clock, Radio
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, Badge, StatCard, PageHeader } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── 1. REGISTER / EDIT USER MODAL (PIXEL MATCHED TO SCREENSHOT) ──────────────
function RegisterUserModal({
  user,
  allBranches,
  allRoles,
  onClose,
  onSuccess,
}: {
  user?: any;
  allBranches: any[];
  allRoles: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(user?.id);
  const [loading, setLoading] = useState(false);

  // Selected branches state & primary branch
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(user?.branches || [])
  );
  const [primaryBranch, setPrimaryBranch] = useState<string>(user?.defaultBranch || '');
  const [selectedRoleName, setSelectedRoleName] = useState<string>(
    user?.roles?.[0]?.name || ''
  );

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      password: '',
      phone: user?.phone || '',
    }
  });

  const toggleBranch = (code: string) => {
    const next = new Set(selectedBranches);
    if (next.has(code)) {
      next.delete(code);
      if (primaryBranch === code) {
        setPrimaryBranch(Array.from(next)[0] || '');
      }
    } else {
      next.add(code);
      if (!primaryBranch) setPrimaryBranch(code);
    }
    setSelectedBranches(next);
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      // Find roleId for selected role name
      const matchedRole = allRoles.find(r => r.name === selectedRoleName);
      const roleIds = matchedRole ? [matchedRole.id] : [];
      const branchCodes = Array.from(selectedBranches);

      if (isEdit) {
        await api.put(`/users/${user.id}`, {
          fullName: data.username,
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          isActive: true,
        });

        // Update roles
        if (roleIds.length > 0) {
          await api.post(`/users/${user.id}/roles`, { roleIds });
        }

        // Update branch access
        await api.post(`/users/${user.id}/branches`, {
          branchCodes,
          defaultBranch: primaryBranch || branchCodes[0] || undefined,
        });

        toast.success(`User @${user.username} updated successfully!`);
      } else {
        const createdUser = await api.post('/users', {
          username: data.username.trim(),
          fullName: data.username.trim(),
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          password: data.password,
          roleIds,
          branchCodes,
          isActive: true,
        });

        if (createdUser.data?.id && primaryBranch) {
          await api.post(`/users/${createdUser.data.id}/branches`, {
            branchCodes,
            defaultBranch: primaryBranch,
          }).catch(() => null);
        }

        toast.success(`User @${data.username} registered successfully!`);
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Dark Navy Header with Lightning icon */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d1b33] text-white">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-base">⚡</span>
            <h2 className="font-bold text-base tracking-wide">
              {isEdit ? `Edit User — ${user.username}` : 'Register New User'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 text-xs">
          {/* Username */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Username</label>
            <input
              {...register('username', { required: 'Username is required' })}
              disabled={isEdit}
              placeholder="e.g., john.doe"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 disabled:bg-slate-100 font-medium"
            />
            {errors.username && <p className="text-rose-500 text-[11px] mt-0.5">{String(errors.username.message)}</p>}
          </div>

          {/* Email Address */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              {...register('email')}
              type="email"
              placeholder="e.g., john.doe@company.local"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <input
              {...register('password', {
                required: !isEdit ? 'Password is required' : false,
                minLength: { value: 6, message: 'Password must be at least 6 characters long.' }
              })}
              type="password"
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Enter secure password'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Password must be at least 6 characters long.</p>
            {errors.password && <p className="text-rose-500 text-[11px] mt-0.5">{String(errors.password.message)}</p>}
          </div>

          {/* Security Access Role */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Security Access Role</label>
            <select
              value={selectedRoleName}
              onChange={(e) => setSelectedRoleName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 bg-white font-medium"
            >
              <option value="">-- Choose Role --</option>
              <option value="Super Admin">Super Admin</option>
              <option value="HO Finance">HO Finance</option>
              <option value="Branch Manager">Branch Manager</option>
              <option value="Associate">Associate</option>
              <option value="Auditor">Auditor</option>
              <option value="Sales Executive">Sales Executive</option>
            </select>
          </div>

          {/* Branch Boundaries Mapping */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Branch Boundaries Mapping</label>
            <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 max-h-48 overflow-y-auto">
              {allBranches.length === 0 ? (
                <p className="text-slate-400 text-center py-3">Loading branches...</p>
              ) : (
                allBranches.map((b: any) => {
                  const isChecked = selectedBranches.has(b.code);
                  const isPrimary = primaryBranch === b.code;
                  const label = `${b.name || b.code} (${b.code})`;

                  return (
                    <div
                      key={b.code}
                      className="flex items-center justify-between py-1 px-1.5 hover:bg-slate-50 rounded transition"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBranch(b.code)}
                          className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-semibold text-slate-700 text-xs uppercase tracking-tight">
                          {label}
                        </span>
                      </label>

                      {isChecked && (
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 text-xs font-semibold select-none pl-2">
                          <input
                            type="radio"
                            name="primary_branch_radio"
                            checked={isPrimary}
                            onChange={() => setPrimaryBranch(b.code)}
                            className="text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className={isPrimary ? 'text-blue-700 font-bold' : 'text-slate-400'}>
                            Primary
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
              Select branch scopes. Select one branch as Primary. Leave all unchecked only for Super Admin.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              icon={<Check size={14} className="stroke-[3]" />}
            >
              {isEdit ? 'Update User' : 'Save User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper to format last login date and time
function formatLastLogin(dateStr: string | null | undefined, isOnline: boolean): string {
  if (isOnline) return 'Active now';
  if (!dateStr) return 'Never logged in';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return `${diffDays}d ago (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// ─── MAIN USER MASTER PAGE ───────────────────────────────────────────────────
export default function UserMasterPage() {
  const { isSuperAdmin, user } = useAuth();
  const [modalUser, setModalUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Unconditional Hooks (must be called before any early return)
  const { data: usersData, mutate, isLoading } = useSWR(isSuperAdmin ? '/users?pageSize=200' : null, fetcher);
  const rawUsers = usersData?.data ?? usersData?.items ?? usersData;
  const users: any[] = useMemo(() => Array.isArray(rawUsers) ? rawUsers : [], [rawUsers]);

  const isUserOnline = useCallback((u: any) => {
    if (user && (u.id === user.id || u.username === user.username)) return true;
    if (!u.lastLoginAt) return false;
    const diff = Date.now() - new Date(u.lastLoginAt).getTime();
    return diff < 15 * 60 * 1000; // within last 15 minutes
  }, [user]);

  const { data: branchesData } = useSWR(isSuperAdmin ? '/branches?pageSize=100' : null, fetcher);
  const allBranches: any[] = useMemo(() => {
    if (Array.isArray(branchesData?.items)) return branchesData.items;
    if (Array.isArray(branchesData?.data)) return branchesData.data;
    if (Array.isArray(branchesData)) return branchesData;
    return [];
  }, [branchesData]);

  const { data: rolesData } = useSWR(isSuperAdmin ? '/rbac/roles' : null, fetcher);
  const allRoles: any[] = useMemo(() => Array.isArray(rolesData) ? rolesData : [], [rolesData]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive !== false).length;
    const onlineNow = users.filter(u => isUserOnline(u)).length;
    const superAdmins = users.filter(u => u.roles?.some((r: any) => (r.name || '').toLowerCase().includes('admin'))).length;
    const branchManagers = users.filter(u => u.roles?.some((r: any) => (r.name || '').toLowerCase().includes('manager'))).length;
    return { total, active, onlineNow, superAdmins, branchManagers };
  }, [users, isUserOnline]);

  // Filtered List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && u.isActive !== false) return false;
      if (statusFilter === 'ONLINE' && !isUserOnline(u)) return false;

      if (roleFilter !== 'ALL') {
        const hasRole = u.roles?.some((r: any) => (r.name || '').toLowerCase() === roleFilter.toLowerCase());
        if (!hasRole) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (u.fullName || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        if (!name.includes(q) && !username.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery, isUserOnline]);

  // Access Guard (placed AFTER all hooks to adhere to React Rules of Hooks)
  if (!isSuperAdmin) {
    return (
      <AppShell title="Access Denied" breadcrumb="Security Restriction">
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-lg border border-rose-200">
            <Shield className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted to SuperAdmin</h2>
          <p className="text-xs text-slate-500 max-w-md font-medium leading-relaxed">
            User Master Registry & Security RBAC configuration is restricted exclusively to Super Administrator personnel. Branch Managers cannot view or alter user management accounts.
          </p>
        </div>
      </AppShell>
    );
  }

  // Delete user
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to deactivate/delete user @${username}?`)) return;
    try {
      await api.put(`/users/${userId}`, { isActive: false });
      toast.success(`User @${username} deactivated`);
      mutate();
    } catch {
      toast.error('Failed to deactivate user');
    }
  };

  // Export to Excel
  const handleExport = () => {
    try {
      const rows = filteredUsers.map((u, idx) => {
        const online = isUserOnline(u);
        return {
          '#': idx + 1,
          'Username': u.username,
          'Full Name': u.fullName || '-',
          'Email': u.email || '-',
          'Phone': u.phone || '-',
          'Roles': u.roles?.map((r: any) => r.name).join(', ') || 'No Role',
          'Branches': u.branches?.join(', ') || 'All (Global)',
          'Primary Branch': u.defaultBranch || '-',
          'Presence': online ? 'Online Now' : 'Offline',
          'Last Logged In': u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never',
          'Status': u.isActive !== false ? 'Active' : 'Inactive',
          'Created At': u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '-',
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'User Master RBAC');
      XLSX.writeFile(wb, `User_Master_RBAC_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('User list exported to Excel!');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <AppShell title="User Master" breadcrumb="Enterprise Administration">
      {/* Modal */}
      {isModalOpen && (
        <RegisterUserModal
          user={modalUser}
          allBranches={allBranches}
          allRoles={allRoles}
          onClose={() => { setIsModalOpen(false); setModalUser(null); }}
          onSuccess={() => mutate()}
        />
      )}

      <div className="space-y-4 max-w-full">
        {/* Unified Page Header */}
        <PageHeader
          title="User Master & Access Control"
          subtitle="Enterprise identity administration, role-based permissions (RBAC), and branch security boundaries."
        >
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExport}
              icon={<Download size={14} className="text-slate-500" />}
            >
              Export Excel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => { setModalUser(null); setIsModalOpen(true); }}
              icon={<Plus size={14} />}
            >
              Register User
            </Button>
          </div>
        </PageHeader>

        {/* 1. STANDARDIZED STAT CARDS (WITH LIVE ONLINE PRESENCE) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <StatCard
            title="Total Users"
            value={stats.total}
            subtitle="System accounts"
            icon={<Users size={16} />}
          />
          <StatCard
            title="Active Users"
            value={stats.active}
            subtitle="Operational logins"
            icon={<CheckCircle2 size={16} />}
            trend={{ value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100}% Active`, isPositive: true }}
          />
          <StatCard
            title="Online Now"
            value={stats.onlineNow}
            subtitle="Active sessions"
            icon={<Zap size={16} className="text-emerald-600" />}
            trend={{ value: `${stats.onlineNow} Live`, isPositive: true }}
          />
          <StatCard
            title="Administrators"
            value={stats.superAdmins}
            subtitle="Super Admin access"
            icon={<ShieldCheck size={16} />}
          />
          <StatCard
            title="Branch Managers"
            value={stats.branchManagers}
            subtitle="Location-scoped"
            icon={<Building2 size={16} />}
          />
        </div>

        {/* 2. STANDARDIZED FILTER TOOLBAR */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="w-44">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">SECURITY ROLE</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-enterprise w-full text-xs cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="HO Finance">HO Finance</option>
              <option value="Branch Manager">Branch Manager</option>
              <option value="Associate">Associate</option>
              <option value="Auditor">Auditor</option>
              <option value="Sales Executive">Sales Executive</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-44">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">STATUS & PRESENCE</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-enterprise w-full text-xs cursor-pointer font-medium"
            >
              <option value="ALL">All Status</option>
              <option value="ONLINE">🟢 Online Now ({stats.onlineNow})</option>
              <option value="ACTIVE">Active Accounts ({stats.active})</option>
              <option value="INACTIVE">Inactive Accounts ({stats.total - stats.active})</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">SEARCH ACCOUNTS</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, Username, Email, Phone..."
                className="input-enterprise w-full placeholder-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Reset Filter Button */}
          <div className="flex items-end pt-4 sm:pt-0">
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}
              title="Reset Filters"
              icon={<RotateCcw size={14} className="text-slate-500" />}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* 3. USERS TABLE (STANDARDIZED ENTERPRISE GRID) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-enterprise">
              <thead>
                <tr>
                  <th className="w-12 px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase border-r border-white/10">#</th>
                  <th className="px-4 py-3 text-left align-middle text-[11px] font-bold text-white uppercase min-w-[200px] border-r border-white/10">USER PROFILE</th>
                  <th className="px-4 py-3 text-left align-middle text-[11px] font-bold text-white uppercase min-w-[190px] border-r border-white/10">CONTACT</th>
                  <th className="px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase min-w-[160px] border-r border-white/10">SECURITY ACCESS ROLE</th>
                  <th className="px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase min-w-[140px] border-r border-white/10">BRANCH BOUNDARIES</th>
                  <th className="px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase min-w-[160px] border-r border-white/10">LAST LOGGED IN</th>
                  <th className="w-24 px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase border-r border-white/10">STATUS</th>
                  <th className="w-24 px-3 py-3 text-center align-middle text-[11px] font-bold text-white uppercase">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-[#053D3A]" />
                        <span className="font-bold text-xs">Loading User Master & RBAC...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <UserCog size={32} className="text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600 text-xs">No users found matching the filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const roles: any[] = u.roles || [];
                    const branches: string[] = u.branches || [];

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50 transition border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <td className="px-3 py-3 text-center align-middle border-r border-slate-200 font-mono font-bold text-slate-700 text-xs">
                          {idx + 1}
                        </td>

                        {/* Profile */}
                        <td className="px-4 py-3 text-left align-middle border-r border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#053D3A] text-[#FFE2B8] font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              {u.fullName?.charAt(0) || u.username?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 leading-snug text-xs uppercase truncate">
                                {u.fullName || u.username}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono font-medium truncate">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3 text-left align-middle border-r border-slate-200">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-slate-800 font-medium text-xs truncate" title={u.email}>
                              {u.email || '—'}
                            </p>
                            <p className="text-slate-500 font-mono text-[11px] font-medium">
                              {u.phone || '—'}
                            </p>
                          </div>
                        </td>

                        {/* Roles Badges */}
                        <td className="px-3 py-3 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          {roles.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic font-medium">No role assigned</span>
                          ) : (
                            <div className="flex items-center justify-center flex-wrap gap-1">
                              {roles.map((r: any) => {
                                const rawName = r.name || 'Role';
                                const formattedName = rawName
                                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                                  .replace(/_/g, ' ')
                                  .trim();
                                const isSuper = rawName.toLowerCase().includes('admin');
                                const isFinance = rawName.toLowerCase().includes('finance');
                                const isManager = rawName.toLowerCase().includes('manager');

                                return (
                                  <Badge
                                    key={r.id || r.name}
                                    variant={isSuper ? 'danger' : isFinance ? 'accent' : isManager ? 'brand' : 'info'}
                                    icon={<ShieldCheck size={11} />}
                                  >
                                    {formattedName}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Branch Access */}
                        <td className="px-3 py-3 text-center align-middle border-r border-slate-200">
                          {branches.length === 0 ? (
                            <span className="text-[10px] text-slate-400 font-medium italic">All Branches (Global Scope)</span>
                          ) : (
                            <div className="flex items-center justify-center flex-wrap gap-1">
                              {branches.slice(0, 3).map((b) => (
                                <Badge
                                  key={b}
                                  variant={b === u.defaultBranch ? 'accent' : 'neutral'}
                                  size="sm"
                                  className="font-mono"
                                  icon={b === u.defaultBranch ? <Star size={10} className="fill-amber-500 text-amber-500" /> : undefined}
                                >
                                  {b}
                                </Badge>
                              ))}
                              {branches.length > 3 && (
                                <Badge variant="neutral" size="sm">
                                  +{branches.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Last Logged In & Online Presence */}
                        <td className="px-3 py-3 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          {(() => {
                            const online = isUserOnline(u);
                            const lastLoginText = formatLastLogin(u.lastLoginAt, online);

                            return (
                              <div className="flex flex-col items-center justify-center gap-1">
                                {online ? (
                                  <Badge variant="success" dot size="sm" className="shadow-2xs font-extrabold">
                                    Online Now
                                  </Badge>
                                ) : u.lastLoginAt ? (
                                  <Badge variant="neutral" size="sm" className="font-mono text-[10px] text-slate-600">
                                    Offline
                                  </Badge>
                                ) : (
                                  <Badge variant="neutral" size="sm" className="opacity-60 text-[10px]">
                                    Never
                                  </Badge>
                                )}
                                <span
                                  className="text-[10px] font-mono text-slate-500 font-medium"
                                  title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'No login recorded'}
                                >
                                  {lastLoginText}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <Badge variant={u.isActive !== false ? 'success' : 'danger'} dot>
                            {u.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setModalUser(u); setIsModalOpen(true); }}
                              title="Edit User Profile & Access"
                              className="p-1.5 text-slate-600 hover:text-[#053D3A] hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              title="Deactivate User"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
