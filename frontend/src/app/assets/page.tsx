'use client';
import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Boxes, Laptop, Monitor, Printer, Wifi, Car, Armchair, Code,
  Plus, Search, Filter, Settings, Trash2, Edit3, CheckCircle2,
  AlertTriangle, Wrench, UserCheck, ShieldCheck, RefreshCw, X,
  Building2, Calendar, Tag, ArrowRight, DollarSign, Layers
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function AssetManagerPage() {
  const { isSuperAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modals & Drawers State
  const [categoryModal, setCategoryModal] = useState<boolean>(false);
  const [assetModal, setAssetModal] = useState<{ open: boolean; isEdit: boolean; asset?: any }>({ open: false, isEdit: false });
  const [allocateModal, setAllocateModal] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [maintenanceModal, setMaintenanceModal] = useState<{ open: boolean; asset?: any }>({ open: false });

  // Keyboard shortcut (Escape to close any modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCategoryModal(false);
        setAssetModal({ open: false, isEdit: false });
        setAllocateModal({ open: false });
        setMaintenanceModal({ open: false });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Category Form State
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#2563eb');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Asset Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    allocatedToBranch: 'MUMBAI-01',
    allocatedToUser: '',
    status: 'AVAILABLE',
    vendorName: '',
    warrantyExpiry: '',
    amcExpiry: '',
    depreciationRate: 0,
  });

  // Allocation / Maintenance Form State
  const [allocBranch, setAllocBranch] = useState('MUMBAI-01');
  const [allocUser, setAllocUser] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('');
  const [maintType, setMaintType] = useState('REPAIR');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintCost, setMaintCost] = useState(0);

  const queryParams = new URLSearchParams({
    category: selectedCategory,
    status: selectedStatus,
    search,
  }).toString();

  const { data, mutate, isLoading } = useSWR(`/assets?${queryParams}`, fetcher);

  const assets: any[] = data?.assets || [];
  const categories: any[] = data?.categories || [];
  const metrics = data?.metrics || {
    totalCount: 0,
    availableCount: 0,
    allocatedCount: 0,
    maintenanceCount: 0,
    totalCost: 0,
  };

  // Category CRUD Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode || !catName) {
      toast.error('Category Code and Name are required');
      return;
    }

    try {
      await api.post('/assets/categories', {
        id: editingCatId || undefined,
        code: catCode,
        name: catName,
        description: catDesc,
        color: catColor,
      });

      toast.success(editingCatId ? 'Category updated successfully!' : 'Category created successfully!');
      setEditingCatId(null);
      setCatCode('');
      setCatName('');
      setCatDesc('');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      await api.delete(`/assets/categories/${id}`);
      toast.success(`Category "${name}" deleted`);
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete category');
    }
  };

  // Asset CRUD Handlers
  const handleOpenAssetModal = (asset?: any) => {
    if (asset) {
      setFormData({
        code: asset.code,
        name: asset.name,
        category: asset.category,
        allocatedToBranch: asset.allocatedToBranch || 'MUMBAI-01',
        allocatedToUser: asset.allocatedToUser || '',
        status: asset.status,
        vendorName: asset.vendorName || '',
        warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
        amcExpiry: asset.amcExpiry ? asset.amcExpiry.split('T')[0] : '',
        depreciationRate: asset.depreciationRate || 0,
      });
      setAssetModal({ open: true, isEdit: true, asset });
    } else {
      setFormData({
        code: `AST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        category: categories[0]?.code || 'LAPTOP',
        allocatedToBranch: 'MUMBAI-01',
        allocatedToUser: '',
        status: 'AVAILABLE',
        vendorName: '',
        warrantyExpiry: '',
        amcExpiry: '',
        depreciationRate: 0,
      });
      setAssetModal({ open: true, isEdit: false });
    }
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assets', {
        id: assetModal.isEdit ? assetModal.asset?.id : undefined,
        ...formData,
      });

      toast.success(assetModal.isEdit ? 'Asset updated successfully!' : 'Asset registered successfully!');
      setAssetModal({ open: false, isEdit: false });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save asset');
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!confirm(`Delete asset "${name}"?`)) return;
    try {
      await api.delete(`/assets/${id}`);
      toast.success('Asset deleted successfully');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete asset');
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateModal.asset) return;

    try {
      await api.post(`/assets/${allocateModal.asset.id}/allocate`, {
        branchCode: allocBranch,
        targetUserId: allocUser || undefined,
        remarks: allocRemarks,
      });

      toast.success(`Asset allocated to ${allocUser || allocBranch}`);
      setAllocateModal({ open: false });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to allocate asset');
    }
  };

  const handleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceModal.asset) return;

    try {
      await api.post(`/assets/${maintenanceModal.asset.id}/maintenance`, {
        type: maintType,
        description: maintDesc,
        cost: Number(maintCost),
      });

      toast.success('Maintenance log recorded');
      setMaintenanceModal({ open: false });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to log maintenance');
    }
  };

  return (
    <AppShell title="Asset Management & Inventory" breadcrumb="Enterprise Operations">
      <div className="space-y-6 max-w-full">
        {/* ─── 1. TOP CONTROL TOOLBAR ─── */}
        <div
          className="bg-white text-slate-800 rounded-2xl p-4 shadow-sm relative z-30 border border-slate-200/90"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            {/* Left: Filters & Search */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Dynamic Category Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
                <Tag size={15} className="text-[#053D3A] shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Categories ({categories.length})</option>
                  {categories.map((c: any) => (
                    <option key={c.id || c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs">
                <Filter size={15} className="text-[#053D3A] shrink-0" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="ALLOCATED">Allocated</option>
                  <option value="MAINTENANCE">Under Maintenance</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, name, user, vendor..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#053D3A] shadow-2xs"
                />
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Dynamic Category Manager Button — SuperAdmin Only */}
              {isSuperAdmin && (
                <button
                  onClick={() => setCategoryModal(true)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-blue-700 font-extrabold rounded-2xl text-xs flex items-center gap-2 transition border border-slate-200 shadow-md cursor-pointer"
                >
                  <Settings size={14} className="text-blue-600" />
                  <span>Manage Categories ({categories.length})</span>
                </button>
              )}

              {/* Add Asset Button */}
              <button
                onClick={() => handleOpenAssetModal()}
                className="px-4 py-2 bg-[#ed1c24] hover:bg-[#c71017] text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition shadow-lg active:scale-95"
              >
                <Plus size={15} />
                <span>Register New Asset</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 2. BENTO METRICS CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-blue-700 tracking-wider">Total Inventory</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Boxes size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
              {metrics.totalCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Assets tracked across all company branches</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-emerald-700 tracking-wider">Available Stock</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-emerald-600 tracking-tight tabular-nums">
              {metrics.availableCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Ready for instant branch or user allocation</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-pink-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-purple-700 tracking-wider">Allocated Assets</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <UserCheck size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-purple-600 tracking-tight tabular-nums">
              {metrics.allocatedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Actively deployed with staff and branches</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-red-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider">Under Maintenance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wrench size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-amber-600 tracking-tight tabular-nums">
              {metrics.maintenanceCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">In service, warranty repair, or calibration</p>
          </div>
        </div>

        {/* ─── 3. ASSETS TABLE VIEW ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-blue-600" />
              <h2 className="font-extrabold text-sm text-slate-800">
                Asset Inventory Registry ({assets.length})
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Click actions to Allocate, Log Maintenance, Edit, or Delete
            </span>
          </div>

          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead
                className="sticky top-0 z-20 text-white uppercase text-[10px] tracking-wider select-none shadow-sm border-b border-[#074B47] bg-[#053D3A]"
              >
                <tr>
                  <th className="px-4 py-3 border-r border-white/10">Asset Code</th>
                  <th className="px-4 py-3 border-r border-white/10 min-w-[180px]">Asset Name</th>
                  <th className="px-4 py-3 border-r border-white/10">Category</th>
                  <th className="px-4 py-3 border-r border-white/10">Status</th>
                  <th className="px-4 py-3 border-r border-white/10">Location / User</th>
                  <th className="px-4 py-3 border-r border-white/10">Vendor</th>
                  <th className="px-4 py-3 border-r border-white/10">Warranty / AMC</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <RefreshCw size={26} className="animate-spin text-blue-600 mx-auto mb-2" />
                      <span className="font-bold">Loading assets inventory...</span>
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <Boxes size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">No assets found</p>
                      <p className="text-xs text-slate-400 mt-1">Register new assets or adjust filter criteria</p>
                    </td>
                  </tr>
                ) : (
                  assets.map((a: any, idx: number) => {
                    const statusBg =
                      a.status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : a.status === 'ALLOCATED'
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300';

                    const catObj = categories.find((c: any) => c.code === a.category);

                    return (
                      <tr key={a.id || idx} className="even:bg-slate-50/60 hover:bg-blue-50/80 transition group">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-black text-[11px] border border-slate-200">
                            {a.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-900 text-xs">
                          {a.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              backgroundColor: `${catObj?.color || '#2563eb'}15`,
                              color: catObj?.color || '#2563eb',
                              borderColor: `${catObj?.color || '#2563eb'}40`,
                            }}
                          >
                            {catObj?.name || a.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusBg}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          <div>
                            <span className="font-bold text-slate-900">{a.allocatedToBranch || 'HQ'}</span>
                            {a.allocatedToUser && (
                              <p className="text-[10.5px] text-slate-500 font-mono">User: {a.allocatedToUser}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {a.vendorName || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setAllocateModal({ open: true, asset: a })}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                              title="Allocate Asset"
                            >
                              <UserCheck size={13} />
                            </button>
                            <button
                              onClick={() => setMaintenanceModal({ open: true, asset: a })}
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition"
                              title="Log Maintenance"
                            >
                              <Wrench size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenAssetModal(a)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                              title="Edit Asset"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(a.id, a.name)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              title="Delete Asset"
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

        {/* ─── 4. DYNAMIC CATEGORY MANAGER MODAL ─── */}
        {categoryModal && (
          <div
            onClick={() => setCategoryModal(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div className="flex items-center gap-2.5">
                  <Settings size={20} className="text-cyan-400" />
                  <h3 className="font-extrabold text-sm text-white">Dynamic Asset Category Studio</h3>
                </div>
                <button onClick={() => setCategoryModal(false)} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Form to Add / Edit Category */}
                <form onSubmit={handleSaveCategory} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <p className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    {editingCatId ? 'Edit Category' : 'Create New Category'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Code (Key)</label>
                      <input
                        type="text"
                        value={catCode}
                        onChange={(e) => setCatCode(e.target.value)}
                        placeholder="e.g. SERVER, TABLET, SCANNER"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Category Name</label>
                      <input
                        type="text"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="e.g. Enterprise Servers"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Brief summary of items in this category"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-700">Badge Color:</label>
                      <input
                        type="color"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {editingCatId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(null);
                            setCatCode('');
                            setCatName('');
                            setCatDesc('');
                          }}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl font-bold"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#0052cc] hover:bg-[#0041a3] text-white font-bold text-xs rounded-xl shadow-sm"
                      >
                        {editingCatId ? 'Save Changes' : 'Add Category'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Existing Categories List */}
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800 mb-3 uppercase tracking-wider">
                    Active Categories ({categories.length})
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {categories.map((c: any) => (
                      <div key={c.id || c.code} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color || '#2563eb' }}
                          />
                          <div>
                            <p className="font-bold text-xs text-slate-900">{c.name}</p>
                            <p className="text-[10.5px] text-slate-500 font-mono">Code: {c.code}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCatId(c.id);
                              setCatCode(c.code);
                              setCatName(c.name);
                              setCatDesc(c.description || '');
                              setCatColor(c.color || '#2563eb');
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. ASSET REGISTER / EDIT MODAL ─── */}
        {assetModal.open && (
          <div
            onClick={() => setAssetModal({ open: false, isEdit: false })}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <h3 className="font-extrabold text-sm text-white">
                  {assetModal.isEdit ? 'Edit Asset Details' : 'Register New Asset'}
                </h3>
                <button onClick={() => setAssetModal({ open: false, isEdit: false })} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAsset} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Asset Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                      required
                    >
                      {categories.map((c: any) => (
                        <option key={c.id || c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Asset Name / Model</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dell Latitude 5440 i7 16GB"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={formData.allocatedToBranch}
                      onChange={(e) => setFormData({ ...formData, allocatedToBranch: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Allocated User</label>
                    <input
                      type="text"
                      value={formData.allocatedToUser}
                      onChange={(e) => setFormData({ ...formData, allocatedToUser: e.target.value })}
                      placeholder="Username or Staff ID"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Vendor Name</label>
                    <input
                      type="text"
                      value={formData.vendorName}
                      onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Warranty Expiry</label>
                    <input
                      type="date"
                      value={formData.warrantyExpiry}
                      onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAssetModal({ open: false, isEdit: false })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0052cc] hover:bg-[#0041a3] text-white font-bold rounded-xl shadow-md"
                  >
                    {assetModal.isEdit ? 'Update Asset' : 'Register Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 6. ALLOCATE MODAL ─── */}
        {allocateModal.open && (
          <div
            onClick={() => setAllocateModal({ open: false })}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <h3 className="font-extrabold text-sm text-white">Allocate Asset: {allocateModal.asset?.name}</h3>
                <button onClick={() => setAllocateModal({ open: false })} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAllocate} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Branch</label>
                  <input
                    type="text"
                    value={allocBranch}
                    onChange={(e) => setAllocBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign to User (Username/ID)</label>
                  <input
                    type="text"
                    value={allocUser}
                    onChange={(e) => setAllocUser(e.target.value)}
                    placeholder="e.g. admin or staff-101"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Handover Remarks</label>
                  <textarea
                    value={allocRemarks}
                    onChange={(e) => setAllocRemarks(e.target.value)}
                    rows={3}
                    placeholder="Asset serial, condition, or accessories issued"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAllocateModal({ open: false })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                  >
                    Confirm Allocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 7. MAINTENANCE MODAL ─── */}
        {maintenanceModal.open && (
          <div
            onClick={() => setMaintenanceModal({ open: false })}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <h3 className="font-extrabold text-sm text-white">Log Maintenance: {maintenanceModal.asset?.name}</h3>
                <button onClick={() => setMaintenanceModal({ open: false })} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleMaintenance} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={maintType}
                    onChange={(e) => setMaintType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="REPAIR">Repair / Component Replacement</option>
                    <option value="AMC">Annual Maintenance Contract (AMC)</option>
                    <option value="WARRANTY">Warranty Claim</option>
                    <option value="CALIBRATION">Routine Calibration / Cleaning</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimated / Actual Cost (₹)</label>
                  <input
                    type="number"
                    value={maintCost}
                    onChange={(e) => setMaintCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Description & Remarks</label>
                  <textarea
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    rows={3}
                    placeholder="Details of fault, replacement parts, or service center info"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setMaintenanceModal({ open: false })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md"
                  >
                    Record Maintenance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
