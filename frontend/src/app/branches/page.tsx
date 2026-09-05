'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2, Plus, Search, RotateCcw, Download,
  Edit, CheckCircle2, XCircle, X, MapPin, Globe,
  Shield, Navigation, Calendar, Layers, Hash, Check,
  RefreshCw, Trash2, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, Badge, StatCard, Pagination } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── 1. REGISTER / EDIT OPERATIONAL BRANCH MODAL ──────────────────────────────
function RegisterBranchModal({
  branch,
  onClose,
  onSuccess,
}: {
  branch?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = Boolean(branch?.code);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      code: branch?.code || '',
      name: branch?.name || '',
      type: branch?.type || 'RO',
      consignee: branch?.consignee || '',
      region: branch?.region || '',
      incharge: branch?.incharge || '',
      phone: branch?.phone || '',
      email: branch?.email || '',
      latitude: branch?.latitude || '',
      longitude: branch?.longitude || '',
      openingDate: branch?.openingDate ? new Date(branch.openingDate).toISOString().split('T')[0] : '',
      area: branch?.area || '',
      allowedCategories: branch?.allowedCategories || 'AA, M',
      allowedPartyTypes: branch?.allowedPartyTypes || 'INDEPENDENT WORKSHOP',
      address: branch?.address || '',
      isActive: branch?.isActive !== undefined ? String(branch.isActive) : 'true',
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const payload = {
        name: data.name.trim(),
        type: data.type,
        consignee: data.consignee?.trim() || undefined,
        region: data.region?.trim() || undefined,
        incharge: data.incharge?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        email: data.email?.trim() || undefined,
        latitude: data.latitude?.trim() || undefined,
        longitude: data.longitude?.trim() || undefined,
        coordinates: data.longitude && data.latitude ? `Lng: ${data.longitude}\nLat: ${data.latitude}` : undefined,
        openingDate: data.openingDate ? new Date(data.openingDate) : undefined,
        area: data.area?.trim() || undefined,
        allowedCategories: data.allowedCategories?.trim() || undefined,
        allowedPartyTypes: data.allowedPartyTypes?.trim() || undefined,
        address: data.address?.trim() || undefined,
        isActive: data.isActive === 'true',
      };

      if (isEdit) {
        await api.put(`/branches/${encodeURIComponent(branch.code)}`, payload);
        toast.success(`Branch ${branch.code} updated successfully!`);
      } else {
        await api.post('/branches', {
          code: data.code.trim().toUpperCase(),
          ...payload,
        });
        toast.success(`Branch ${data.code} registered successfully!`);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-[#003366] border-b-[3px] border-[#ED1C24] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#002B55] border border-[#0041A3]">
              <Building2 size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-white">
                {isEdit ? `Edit Operational Branch — ${branch.code}` : 'Register Operational Branch'}
              </h2>
              <p className="text-[11px] text-slate-300">Territory & Branch Boundary Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-[#002B55] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Branch Code */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">
                Branch Code <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('code', { required: 'Branch code is required' })}
                disabled={isEdit}
                placeholder="e.g. ALW, BER, BGI"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-bold uppercase disabled:bg-slate-100"
              />
              {errors.code && <p className="text-rose-500 text-[11px] mt-0.5">{String(errors.code.message)}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Branch Type</label>
              <select
                {...register('type')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-800"
              >
                <option value="RO">RO (Regional Office)</option>
                <option value="AW">AW (Area Warehouse)</option>
                <option value="MW">MW (Main Warehouse)</option>
                <option value="HQ">HQ (Headquarters)</option>
              </select>
            </div>

            {/* Consignee */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Consignee Code</label>
              <input
                {...register('consignee')}
                placeholder="e.g. RJ06112"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">
                Branch Name <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('name', { required: 'Branch name is required' })}
                placeholder="e.g. Alwar Depot"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
              />
              {errors.name && <p className="text-rose-500 text-[11px] mt-0.5">{String(errors.name.message)}</p>}
            </div>

            {/* Region */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Region / Zone</label>
              <input
                {...register('region')}
                placeholder="e.g. North Zone, Jaipur Cluster"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase mb-1">Complete Physical Address</label>
            <textarea
              {...register('address')}
              rows={2}
              placeholder="Building No, Industrial Area, City, Pincode"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 resize-none font-medium"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Incharge */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Branch Incharge</label>
              <input
                {...register('incharge')}
                placeholder="e.g. Rajesh Sharma"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Mobile / Phone</label>
              <input
                {...register('phone')}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Contact Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="e.g. alwar@thessbuddy.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Opening Date */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Opening Date</label>
              <input
                {...register('openingDate')}
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
              />
            </div>

            {/* Area */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Area (Sq Ft)</label>
              <input
                {...register('area')}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Latitude */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Latitude</label>
              <input
                {...register('latitude')}
                placeholder="e.g. 27.5530"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Longitude</label>
              <input
                {...register('longitude')}
                placeholder="e.g. 76.6346"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Allowed Categories */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Allowed Product Categories</label>
              <input
                {...register('allowedCategories')}
                placeholder="e.g. AA, M, 2W"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Comma-separated list (e.g., AA, M)</p>
            </div>

            {/* Allowed Party Types */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Allowed Party Types</label>
              <input
                {...register('allowedPartyTypes')}
                placeholder="e.g. INDEPENDENT WORKSHOP, BODYSHOP"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase mb-1">Operational Status</label>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="true"
                  {...register('isActive')}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-emerald-700">Active Location</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="false"
                  {...register('isActive')}
                  className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-rose-600">Inactive / Suspended</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
              {isEdit ? 'Update Branch' : 'Save Branch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN BRANCHES MANAGEMENT PAGE ────────────────────────────────────────────
export default function BranchesPage() {
  const { isSuperAdmin } = useAuth();
  const [modalBranch, setModalBranch] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: branches, error, mutate, isLoading } = useSWR('/branches', fetcher, {
    revalidateOnFocus: false,
  });

  const branchList = useMemo(() => {
    if (!Array.isArray(branches)) return [];
    return branches;
  }, [branches]);

  // Distinct regions and types for filter dropdowns
  const distinctRegions = useMemo(() => {
    const set = new Set<string>();
    branchList.forEach(b => { if (b.region) set.add(b.region); });
    return Array.from(set).sort();
  }, [branchList]);

  const distinctTypes = useMemo(() => {
    const set = new Set<string>();
    branchList.forEach(b => { if (b.type) set.add(b.type); });
    return Array.from(set).sort();
  }, [branchList]);

  // Filtered branch data
  const filteredBranches = useMemo(() => {
    return branchList.filter((b) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = (b.code || '').toLowerCase().includes(q);
        const matchesName = (b.name || '').toLowerCase().includes(q);
        const matchesIncharge = (b.incharge || '').toLowerCase().includes(q);
        const matchesRegion = (b.region || '').toLowerCase().includes(q);
        const matchesConsignee = (b.consignee || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesIncharge && !matchesRegion && !matchesConsignee) {
          return false;
        }
      }

      // 2. Region Filter
      if (regionFilter !== 'ALL' && b.region !== regionFilter) {
        return false;
      }

      // 3. Type Filter
      if (typeFilter !== 'ALL' && b.type !== typeFilter) {
        return false;
      }

      // 4. Status Filter
      if (statusFilter === 'ACTIVE' && b.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && b.isActive !== false) return false;

      return true;
    });
  }, [branchList, searchQuery, regionFilter, typeFilter, statusFilter]);

  // Paginated records
  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, currentPage, pageSize]);

  // Summary Metrics
  const activeCount = useMemo(() => branchList.filter(b => b.isActive !== false).length, [branchList]);
  const regionalOfficesCount = useMemo(() => branchList.filter(b => b.type === 'RO').length, [branchList]);
  const totalAreaSqFt = useMemo(() => {
    return branchList.reduce((acc, b) => acc + (parseFloat(b.area) || 0), 0);
  }, [branchList]);

  // Delete / Deactivate Branch
  const handleDeleteBranch = async (code: string) => {
    if (!window.confirm(`Are you sure you want to deactivate operational branch ${code}?`)) return;
    try {
      await api.delete(`/branches/${encodeURIComponent(code)}`);
      toast.success(`Branch ${code} deactivated`);
      mutate();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to deactivate branch');
    }
  };

  // Export to Excel
  const handleExport = () => {
    if (filteredBranches.length === 0) {
      toast.error('No branch records to export');
      return;
    }

    const exportRows = filteredBranches.map(b => ({
      'Branch Code': b.code,
      'Type': b.type || 'RO',
      'Consignee Code': b.consignee || '',
      'Branch Name': b.name,
      'Address': b.address || '',
      'Region': b.region || '',
      'Incharge': b.incharge || '',
      'Mobile No': b.phone || '',
      'Email Address': b.email || '',
      'Opening Date': b.openingDate ? new Date(b.openingDate).toISOString().split('T')[0] : '',
      'Area (Sq Ft)': b.area || '',
      'Latitude': b.latitude || '',
      'Longitude': b.longitude || '',
      'Allowed Categories': b.allowedCategories || '',
      'Allowed Party Types': b.allowedPartyTypes || '',
      'Status': b.isActive !== false ? 'Active' : 'Inactive',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operational_Branches');
    XLSX.writeFile(wb, `Branch_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Branch master exported to Excel');
  };

  return (
    <AppShell title="Operational Branch Master" breadcrumb="Administration / Branch Master">
      {isModalOpen && (
        <RegisterBranchModal
          branch={modalBranch}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => mutate()}
        />
      )}

      <div className="space-y-4">
        {/* 1. TOP STATS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Network Nodes"
            value={branchList.length}
            icon={<Building2 size={20} />}
            trend={{ text: 'Full Network Scope', positive: true }}
          />
          <StatCard
            label="Active Operational"
            value={activeCount}
            icon={<CheckCircle2 size={20} />}
            trend={{ text: `${((activeCount / (branchList.length || 1)) * 100).toFixed(0)}% Online`, positive: true }}
          />
          <StatCard
            label="Regional Offices (RO)"
            value={regionalOfficesCount}
            icon={<Globe size={20} />}
            trend={{ text: 'Hub Locations', positive: true }}
          />
          <StatCard
            label="Warehouse Floor Space"
            value={`${(totalAreaSqFt / 1000).toFixed(1)}k sqft`}
            icon={<Layers size={20} />}
            trend={{ text: 'Total Footprint', positive: true }}
          />
        </div>

        {/* 2. FILTER & SEARCH CONTROL STRIP */}
        <div className="card-enterprise p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
            {/* Region Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Region / Zone</label>
              <select
                value={regionFilter}
                onChange={(e) => { setRegionFilter(e.target.value); setCurrentPage(1); }}
                className="select-enterprise w-full"
              >
                <option value="ALL">All Regions ({distinctRegions.length})</option>
                {distinctRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Branch Type</label>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="select-enterprise w-full"
              >
                <option value="ALL">All Types</option>
                {distinctTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="select-enterprise w-full"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {/* Search Query */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search Details</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Code, Name, Incharge..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="input-enterprise w-full placeholder-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Primary Page Actions */}
          <div className="flex items-center gap-2 pt-2 sm:pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setRegionFilter('ALL'); setTypeFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); setCurrentPage(1); }}
              title="Reset Filters"
              icon={<RotateCcw size={14} className="text-slate-500" />}
            >
              Reset
            </Button>
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
              onClick={() => { setModalBranch(null); setIsModalOpen(true); }}
              icon={<Plus size={14} />}
            >
              Register Branch
            </Button>
          </div>
        </div>

        {/* 3. DATA TABLE (STANDARDIZED ENTERPRISE GRID) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-enterprise text-center align-middle">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap border-r border-white/10">CODE</th>
                  <th className="px-2 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">TYPE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap border-r border-white/10">CONSIGNEE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase min-w-[180px] border-r border-white/10">BRANCH NAME</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase min-w-[220px] border-r border-white/10">ADDRESS</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap border-r border-white/10">REGION</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap border-r border-white/10">INCHARGE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap border-r border-white/10">MOBILE NO</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase min-w-[200px] border-r border-white/10">EMAIL ADDRESS</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">OPENING DATE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">AREA (SQ FT)</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">LATITUDE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">LONGITUDE</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">ALLOWED CATEGORIES</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">ALLOWED PARTY TYPES</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center border-r border-white/10">STATUS</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-white uppercase whitespace-nowrap text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={17} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-[#0052CC]" />
                        <span className="font-bold text-xs">Loading operational branches...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedBranches.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="py-12 text-center text-slate-400">
                      <Building2 size={32} className="text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600">No operational locations found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedBranches.map((b, idx) => {
                    const categories: string[] = b.allowedCategories
                      ? b.allowedCategories.split(',').map((c: string) => c.trim()).filter(Boolean)
                      : ['AA', 'M'];
                    const allowedPartyTypes = b.allowedPartyTypes || 'INDEPENDENT WORKSHOP';

                    return (
                      <tr key={b.code} className={`hover:bg-slate-50 transition ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        {/* 1. Branch Code */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono font-bold text-[#003366] border-r border-slate-200">
                          {b.code}
                        </td>

                        {/* 2. Type */}
                        <td className="px-2 py-2.5 text-center align-middle border-r border-slate-200">
                          <Badge variant="brand" size="sm" className="font-mono">
                            {b.type || 'RO'}
                          </Badge>
                        </td>

                        {/* 3. Consignee Code */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200">
                          {b.consignee || 'RJ06112'}
                        </td>

                        {/* 4. Branch Name */}
                        <td className="px-3 py-2.5 text-left align-middle font-bold text-slate-900 border-r border-slate-200">
                          {b.name}
                        </td>

                        {/* 5. Address */}
                        <td className="px-3 py-2.5 text-left align-middle text-slate-600 border-r border-slate-200 max-w-xs truncate" title={b.address}>
                          {b.address || '—'}
                        </td>

                        {/* 6. Region */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <span className="font-medium text-slate-700">{b.region || '—'}</span>
                        </td>

                        {/* 7. Incharge */}
                        <td className="px-3 py-2.5 text-center align-middle font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                          {b.incharge || '—'}
                        </td>

                        {/* 8. Mobile No */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap">
                          {b.phone || '—'}
                        </td>

                        {/* 9. Email Address */}
                        <td className="px-3 py-2.5 text-left align-middle text-slate-600 border-r border-slate-200 truncate" title={b.email}>
                          {b.email || '—'}
                        </td>

                        {/* 10. Opening Date */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap">
                          {b.openingDate ? new Date(b.openingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>

                        {/* 11. Area (Sq Ft) */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                          {b.area ? `${b.area} sq ft` : '—'}
                        </td>

                        {/* 12. Latitude */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono text-[11px] text-slate-500 border-r border-slate-200">
                          {b.latitude || '—'}
                        </td>

                        {/* 13. Longitude */}
                        <td className="px-3 py-2.5 text-center align-middle font-mono text-[11px] text-slate-500 border-r border-slate-200">
                          {b.longitude || '—'}
                        </td>

                        {/* 14. Allowed Categories */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                          <div className="flex items-center justify-center flex-wrap gap-1">
                            {categories.map((c) => (
                              <Badge key={c} variant="accent" size="sm" className="font-mono">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* 15. Allowed Party Types */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-800">
                            {allowedPartyTypes}
                          </span>
                        </td>

                        {/* 16. Status */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                          <Badge variant={b.isActive !== false ? 'success' : 'danger'} dot>
                            {b.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* 17. Actions */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setModalBranch(b); setIsModalOpen(true); }}
                              title="Edit Branch"
                              className="p-1.5 text-slate-600 hover:text-[#003366] hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteBranch(b.code)}
                              title="Delete Branch"
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

          {/* Unified Enterprise Pagination */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredBranches.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemName="locations"
          />
        </div>
      </div>
    </AppShell>
  );
}
