'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import {
  Building2, CheckCircle2, XCircle, Plus, Search, RotateCcw, Download,
  Edit, Trash2, MapPin, Globe, Shield, RefreshCw, X, Users, Filter, Check,
  Phone, Mail, Calendar, Compass
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, Badge, StatCard, PageHeader } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ─── REGISTER / EDIT BRANCH MODAL ─────────────────────────────────────────────
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
      consignee: branch?.consignee || 'RJ06112',
      region: branch?.region || 'Alwar Region',
      incharge: branch?.incharge || '',
      phone: branch?.phone || '',
      email: branch?.email || '',
      latitude: branch?.latitude || '',
      longitude: branch?.longitude || '',
      openingDate: branch?.openingDate ? new Date(branch.openingDate).toISOString().slice(0, 10) : '',
      area: branch?.area || '1,000',
      allowedCategories: branch?.allowedCategories || 'AA, M',
      allowedPartyTypes: branch?.allowedPartyTypes || 'INDEPENDENT WORKSHOP',
      address: branch?.address || '',
      isActive: branch?.isActive !== undefined ? String(branch.isActive) : 'true',
    },
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
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d1b33] text-white">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold text-base">🏢</span>
            <h2 className="font-bold text-base tracking-wide">
              {isEdit ? `Edit Operational Branch — ${branch.code}` : 'Register Operational Branch'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
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
                placeholder="e.g. RJ06F91 or RJ06112"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
              />
            </div>

            {/* Branch Name */}
            <div className="col-span-2 sm:col-span-3">
              <label className="block font-semibold text-slate-700 uppercase mb-1">
                Branch Name <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('name', { required: 'Branch name is required' })}
                placeholder="e.g. ALWAR-SPR or SIKAR ROAD-SPR"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-bold uppercase text-slate-800"
              />
              {errors.name && <p className="text-rose-500 text-[11px] mt-0.5">{String(errors.name.message)}</p>}
            </div>

            {/* Region */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Region</label>
              <input
                {...register('region')}
                placeholder="e.g. Alwar Region, Jaipur Region"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Incharge */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Branch Incharge</label>
              <input
                {...register('incharge')}
                placeholder="e.g. LAXMI NARAYAN SHARMA"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-bold uppercase"
              />
            </div>

            {/* Branch Opening Date */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Calendar size={11} className="text-blue-600" /> Opening Date
              </label>
              <input
                {...register('openingDate')}
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium bg-white"
              />
            </div>

            {/* Mobile No */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Phone size={11} className="text-emerald-600" /> Mobile No
              </label>
              <input
                {...register('phone')}
                placeholder="e.g. 8239999056"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
              />
            </div>

            {/* Email Address */}
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Mail size={11} className="text-blue-600" /> Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="e.g. INDIAAUTOMOTIVESALWAR@GMAIL.COM"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Latitude */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Compass size={11} className="text-indigo-600" /> Latitude (Lat)
              </label>
              <input
                {...register('latitude')}
                placeholder="e.g. 27.5596231"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Compass size={11} className="text-indigo-600" /> Longitude (Long)
              </label>
              <input
                {...register('longitude')}
                placeholder="e.g. 76.6413275"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Area */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Area (Sq Ft)</label>
              <input
                {...register('area')}
                placeholder="e.g. 4,500 or 1,400"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Plot / Street Address */}
            <div className="col-span-2 sm:col-span-3">
              <label className="block font-semibold text-slate-700 uppercase mb-1">Plot / Street Address</label>
              <input
                {...register('address')}
                placeholder="e.g. PLOT NO.10-11 DAYANAND NAGAR MAIN ROAD ALWAR"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Allowed Categories */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Allowed Categories</label>
              <input
                {...register('allowedCategories')}
                placeholder="e.g. AA, M"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
              />
            </div>

            {/* Allowed Party Types */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Allowed Party Types</label>
              <input
                {...register('allowedPartyTypes')}
                placeholder="e.g. INDEPENDENT WORKSHOP"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1">Status</label>
              <select
                {...register('isActive')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

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
            >
              {isEdit ? 'Update Branch' : 'Register Branch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN OPERATIONAL LOCATIONS MASTER PAGE ───────────────────────────────────
export default function OperationalLocationsMasterPage() {
  const [modalBranch, setModalBranch] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, mutate, isLoading } = useSWR('/branches?pageSize=100', fetcher);
  const branches: any[] = useMemo(() => {
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  }, [data]);

  // Distinct regions for filter
  const regionsList = useMemo(() => {
    const set = new Set<string>();
    branches.forEach(b => { if (b.region) set.add(b.region); });
    return ['ALL', ...Array.from(set).sort()];
  }, [branches]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (regionFilter !== 'ALL' && b.region !== regionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (b.code || '').toLowerCase();
        const name = (b.name || '').toLowerCase();
        const incharge = (b.incharge || '').toLowerCase();
        const phone = (b.phone || '').toLowerCase();
        const email = (b.email || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !incharge.includes(q) && !phone.includes(q) && !email.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [branches, regionFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b: any) => b.isActive !== false).length;
    const regions = new Set(branches.map((b: any) => b.region).filter(Boolean)).size;
    const totalArea = branches.reduce((sum: number, b: any) => {
      const a = parseInt(String(b.area || '0').replace(/[^0-9]/g, ''), 10);
      return sum + (isNaN(a) ? 0 : a);
    }, 0);
    return {
      total,
      active,
      regions: regions || 1,
      totalArea: totalArea > 0 ? totalArea.toLocaleString('en-IN') + ' sq ft' : '15,000+ sq ft',
    };
  }, [branches]);

  // Delete Branch
  const handleDeleteBranch = async (code: string) => {
    if (!confirm(`Are you sure you want to permanently delete branch "${code}"?`)) return;
    try {
      await api.delete(`/branches/${encodeURIComponent(code)}`);
      toast.success(`Branch ${code} deleted permanently!`);
      mutate();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete branch');
    }
  };

  // Export to Excel
  const handleExport = () => {
    try {
      const rows = filteredBranches.map((b, idx) => ({
        '#': idx + 1,
        'Code': b.code,
        'Type': b.type || 'RO',
        'Consignee': b.consignee || 'RJ06112',
        'Branch Name': b.name,
        'Address': b.address || '-',
        'Region': b.region || 'Alwar Region',
        'Incharge': b.incharge || '-',
        'Mobile No': b.phone || '-',
        'Email Address': b.email || '-',
        'Opening Date': b.openingDate ? new Date(b.openingDate).toISOString().slice(0, 10) : '-',
        'Area (Sq Ft)': b.area || '0',
        'Latitude': b.latitude || '-',
        'Longitude': b.longitude || '-',
        'Allowed Categories': b.allowedCategories || 'AA, M',
        'Allowed Party Types': b.allowedPartyTypes || 'INDEPENDENT WORKSHOP',
        'Status': b.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Operational Locations');
      XLSX.writeFile(wb, `Operational_Locations_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Operational locations exported to Excel!');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <AppShell title="Branch Master" breadcrumb="Enterprise Administration">
      {isModalOpen && (
        <RegisterBranchModal
          branch={modalBranch}
          onClose={() => { setIsModalOpen(false); setModalBranch(null); }}
          onSuccess={() => mutate()}
        />
      )}

      <div className="space-y-4 max-w-full">
        {/* Unified Page Header */}
        <PageHeader
          title="Operational Locations Master"
          subtitle={`List of currently active and operational company branch networks (${branches.length} locations).`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="input-enterprise h-9 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
            >
              {regionsList.map(r => (
                <option key={r} value={r}>{r === 'ALL' ? 'All Regions' : r}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Code, Name, Phone..."
                className="input-enterprise h-9 w-48 sm:w-56 text-xs placeholder-slate-400 shadow-2xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X size={12} />
                </button>
              )}
            </div>

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
        </PageHeader>

        {/* Standardized KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            title="Total Locations"
            value={stats.total}
            subtitle="Registered branch network"
            icon={<Building2 size={16} />}
          />
          <StatCard
            title="Active Locations"
            value={stats.active}
            subtitle="Operational branches"
            icon={<CheckCircle2 size={16} />}
            trend={{ value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100}% Active`, isPositive: true }}
          />
          <StatCard
            title="Operational Regions"
            value={stats.regions}
            subtitle="Geographical distribution"
            icon={<Globe size={16} />}
          />
          <StatCard
            title="Total Floor Area"
            value={stats.totalArea}
            subtitle="Combined warehouse space"
            icon={<MapPin size={16} />}
          />
        </div>

        {/* DATA TABLE (STANDARDIZED ENTERPRISE GRID) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-enterprise text-center align-middle">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap border-r border-slate-700/80">CODE</th>
                  <th className="px-2 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">TYPE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap border-r border-slate-700/80">CONSIGNEE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase min-w-[180px] border-r border-slate-700/80">BRANCH NAME</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase min-w-[220px] border-r border-slate-700/80">ADDRESS</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap border-r border-slate-700/80">REGION</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap border-r border-slate-700/80">INCHARGE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap border-r border-slate-700/80">MOBILE NO</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase min-w-[200px] border-r border-slate-700/80">EMAIL ADDRESS</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">OPENING DATE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">AREA (SQ FT)</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">LATITUDE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">LONGITUDE</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">ALLOWED CATEGORIES</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">ALLOWED PARTY TYPES</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center border-r border-slate-700/80">STATUS</th>
                  <th className="px-3 py-3 text-[11px] font-black text-white uppercase whitespace-nowrap text-center">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {isLoading ? (
                  <tr>
                    <td colSpan={17} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <span className="font-bold">Loading Operational Locations Master...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBranches.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <Building2 size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="font-bold text-slate-600">No operational branch locations found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBranches.map((b, idx) => {
                    const isAw = (b.type || 'RO').toUpperCase() === 'AW';
                    const isMw = (b.type || 'RO').toUpperCase() === 'MW';
                    const consignee = b.consignee || 'RJ06112';
                    const incharge = b.incharge || 'LAXMI NARAYAN SHARMA';
                    const phone = b.phone || '-';
                    const email = b.email || '-';
                    const area = b.area || '0';
                    const region = b.region || 'Alwar Region';
                    const lat = b.latitude || '-';
                    const long = b.longitude || '-';
                    const openingDateFormatted = b.openingDate
                      ? new Date(b.openingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '-';
                    const allowedCategories = b.allowedCategories ? b.allowedCategories.split(',').map((c: string) => c.trim()) : ['AA', 'M'];
                    const allowedPartyTypes = b.allowedPartyTypes || 'INDEPENDENT WORKSHOP';

                    return (
                      <tr key={b.code} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        {/* 1. Code */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono font-semibold text-xs">
                          <span className="px-2 py-0.5 bg-[#EAF5F3] text-[#053D3A] border border-[#DCEDEA] rounded-md font-bold">
                            {b.code}
                          </span>
                        </td>

                        {/* 2. Type Badge */}
                        <td className="px-2 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <Badge variant={isMw ? 'info' : isAw ? 'accent' : 'brand'}>
                            {b.type || 'RO'}
                          </Badge>
                        </td>

                        {/* 3. Consignee */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono text-xs text-rose-600 font-semibold">
                          {consignee}
                        </td>

                        {/* 4. Branch Name */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-900 uppercase text-xs whitespace-nowrap">
                          {b.name}
                        </td>

                        {/* 5. Address */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 text-slate-800 text-[11px] font-semibold max-w-xs">
                          {b.address || '-'}
                        </td>

                        {/* 6. Region */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap text-slate-800 font-semibold text-xs">
                          {region}
                        </td>

                        {/* 7. Incharge */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900 uppercase text-xs">
                          {incharge}
                        </td>

                        {/* 8. Mobile No */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
                          <span className="inline-flex items-center justify-center gap-1">
                            <Phone size={11} className="text-emerald-600" />
                            {phone}
                          </span>
                        </td>

                        {/* 9. Email Address */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 font-mono text-[11px] text-blue-700 lowercase font-semibold">
                          <span className="inline-flex items-center justify-center gap-1">
                            <Mail size={11} className="text-blue-500" />
                            {email}
                          </span>
                        </td>

                        {/* 10. Opening Date */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-semibold text-slate-800 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                            {openingDateFormatted}
                          </span>
                        </td>

                        {/* 11. Area */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono font-semibold text-slate-900 text-xs">
                          {area}
                        </td>

                        {/* 12. Latitude */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-700">
                          {lat}
                        </td>

                        {/* 13. Longitude */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-700">
                          {long}
                        </td>

                        {/* 14. Allowed Categories */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {allowedCategories.map((c: string) => (
                              <Badge key={c} variant="neutral" size="sm">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* 15. Allowed Party Types */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-800">
                            {allowedPartyTypes}
                          </span>
                        </td>

                        {/* 16. Status */}
                        <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <Badge variant={b.isActive !== false ? 'success' : 'danger'} dot>
                            {b.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* 17. Actions */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setModalBranch(b); setIsModalOpen(true); }}
                              title="Edit Branch"
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteBranch(b.code)}
                              title="Delete Branch"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
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
