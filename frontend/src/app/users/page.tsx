'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import {
  UserCog, Shield, ShieldCheck, Building2, Plus, Search, RotateCcw,
  Download, Edit, CheckCircle2, XCircle, X, Users, Key, Star, Check,
  Lock, Mail, Phone, RefreshCw, Zap, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#00b87c] hover:bg-[#00a36d] text-white font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Check size={14} className="stroke-[3]" />
              <span>{loading ? 'Saving...' : 'Save User'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN USER MASTER PAGE ───────────────────────────────────────────────────
export default function UserMasterPage() {
  const { isSuperAdmin } = useAuth();
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
    const superAdmins = users.filter(u => u.roles?.some((r: any) => (r.name || '').toLowerCase().includes('admin'))).length;
    const branchManagers = users.filter(u => u.roles?.some((r: any) => (r.name || '').toLowerCase().includes('manager'))).length;
    return { total, active, superAdmins, branchManagers };
  }, [users]);

  // Filtered List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && u.isActive !== false) return false;

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
  }, [users, roleFilter, statusFilter, searchQuery]);

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
      const rows = filteredUsers.map((u, idx) => ({
        '#': idx + 1,
        'Username': u.username,
        'Full Name': u.fullName || '-',
        'Email': u.email || '-',
        'Phone': u.phone || '-',
        'Roles': u.roles?.map((r: any) => r.name).join(', ') || 'No Role',
        'Branches': u.branches?.join(', ') || 'All (Global)',
        'Primary Branch': u.defaultBranch || '-',
        'Status': u.isActive !== false ? 'Active' : 'Inactive',
        'Created At': u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '-',
      }));

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
        {/* 1. STAT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-blue-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TOTAL USERS</span>
              <Users size={16} className="text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{stats.total}</p>
            <p className="text-[11px] text-blue-600 font-semibold mt-1">System Accounts</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ACTIVE USERS</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 mt-2">{stats.active}</p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">Operational</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-purple-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ADMINISTRATORS</span>
              <ShieldCheck size={16} className="text-purple-600" />
            </div>
            <p className="text-2xl font-extrabold text-purple-600 mt-2">{stats.superAdmins}</p>
            <p className="text-[11px] text-purple-700 font-semibold mt-1">Full Privileges</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">BRANCH MANAGERS</span>
              <Building2 size={16} className="text-amber-500" />
            </div>
            <p className="text-2xl font-extrabold text-amber-600 mt-2">{stats.branchManagers}</p>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">Branch Scope</p>
          </div>
        </div>

        {/* 2. NAVY FILTER TOOLBAR */}
        <div className="bg-[#121f3d] text-white rounded-xl p-3 shadow-md flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="w-40">
            <label className="block text-[10px] font-bold text-blue-300/80 uppercase mb-1">ROLE</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900/80 border border-blue-400/30 rounded-lg text-xs font-semibold text-white focus:outline-none"
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
          <div className="w-32">
            <label className="block text-[10px] font-bold text-blue-300/80 uppercase mb-1">STATUS</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900/80 border border-blue-400/30 rounded-lg text-xs font-semibold text-white focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold text-blue-300/80 uppercase mb-1">SEARCH</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, Username, Email, Phone..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-1.5 pt-4 sm:pt-0">
            <button
              onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}
              title="Reset Filters"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-blue-300 border border-blue-400/30 text-xs transition"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleExport}
              title="Export to Excel"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-blue-300 border border-blue-400/30 text-xs transition"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => { setModalUser(null); setIsModalOpen(true); }}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm"
            >
              <Plus size={14} />
              <span>Register User</span>
            </button>
          </div>
        </div>

        {/* 3. USERS TABLE WITH HIGH VISIBILITY ENTERPRISE GRID */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center align-middle border-collapse">
              <thead className="table-header-navy select-none">
                <tr>
                  <th className="w-10 px-3 py-3 text-center align-middle text-[11px] font-black text-white uppercase border-r border-slate-700/80">#</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase min-w-[200px] border-r border-slate-700/80">USER PROFILE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase border-r border-slate-700/80">CONTACT</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase border-r border-slate-700/80">SECURITY ACCESS ROLE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase border-r border-slate-700/80">BRANCH BOUNDARIES</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase text-center border-r border-slate-700/80">STATUS</th>
                  <th className="w-24 px-3 py-3 text-center align-middle text-[11px] font-black text-white uppercase">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <span className="font-bold">Loading User Master & RBAC...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <UserCog size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="font-bold text-slate-600">No users found matching the filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const roles: any[] = u.roles || [];
                    const branches: string[] = u.branches || [];

                    return (
                      <tr key={u.id} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-900 text-xs">{idx + 1}</td>

                        {/* Profile */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs flex-shrink-0 shadow-sm">
                              {u.fullName?.charAt(0) || u.username?.charAt(0) || 'U'}
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-slate-900 leading-tight text-xs uppercase">{u.fullName || u.username}</p>
                              <p className="text-[11px] text-blue-700 font-mono font-semibold">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800">
                          <p className="text-slate-900 font-semibold text-xs">{u.email || '-'}</p>
                          <p className="text-slate-600 font-mono font-semibold text-[11px]">{u.phone || '-'}</p>
                        </td>

                        {/* Roles Badges */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          {roles.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic font-semibold">No role assigned</span>
                          ) : (
                            <div className="flex items-center justify-center flex-wrap gap-1">
                              {roles.map((r: any) => {
                                const roleName = r.name || 'Role';
                                const isSuper = roleName.toLowerCase().includes('admin');
                                const isFinance = roleName.toLowerCase().includes('finance');
                                const isManager = roleName.toLowerCase().includes('manager');

                                return (
                                  <span
                                    key={r.id || r.name}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                                      isSuper
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : isFinance
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : isManager
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    <Shield size={9} />
                                    {roleName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Branch Access */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                          {branches.length === 0 ? (
                            <span className="text-[10px] text-slate-500 font-semibold italic">All Branches (Global Scope)</span>
                          ) : (
                            <div className="flex items-center justify-center flex-wrap gap-1">
                              {branches.slice(0, 3).map((b) => (
                                <span
                                  key={b}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${
                                    b === u.defaultBranch
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-slate-50 text-slate-800 border-slate-200'
                                  }`}
                                  title={b === u.defaultBranch ? 'Primary Branch' : b}
                                >
                                  {b === u.defaultBranch && '⭐ '}
                                  {b}
                                </span>
                              ))}
                              {branches.length > 3 && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                  +{branches.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          {u.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                              <XCircle size={10} /> Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setModalUser(u); setIsModalOpen(true); }}
                              title="Edit User Profile & Access"
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition border border-slate-200"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              title="Deactivate User"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200"
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
