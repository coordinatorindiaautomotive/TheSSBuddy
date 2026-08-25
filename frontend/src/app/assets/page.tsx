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
  Building2, Calendar, Tag, ArrowRight, DollarSign, Layers,
  FileSpreadsheet, QrCode, Clock, Shield, Check, History,
  RotateCcw, Sparkles, ChevronRight, User, Eye, Smartphone,
  HardDrive, Server, Camera
} from 'lucide-react';
import * as XLSX from 'xlsx';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

// Dynamic Category Icon Resolver
const getCategoryIcon = (iconName?: string) => {
  switch ((iconName || '').toLowerCase()) {
    case 'laptop': return Laptop;
    case 'printer': return Printer;
    case 'wifi':
    case 'network': return Wifi;
    case 'server': return Server;
    case 'smartphone':
    case 'mobile': return Smartphone;
    case 'armchair':
    case 'furniture': return Armchair;
    case 'car':
    case 'vehicle': return Car;
    case 'code':
    case 'software': return Code;
    case 'shield':
    case 'cctv':
    case 'camera': return Camera;
    default: return Boxes;
  }
};

const CATEGORY_COLORS = [
  '#2563eb', '#087443', '#7c3aed', '#053D3A',
  '#d97706', '#4b5563', '#0284c7', '#dc2626',
  '#0d9488', '#e11d48'
];

export default function AssetManagerPage() {
  const { isSuperAdmin, isBranchUser, userBranch, userBranchName } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modals & Drawers State
  const [categoryModal, setCategoryModal] = useState<boolean>(false);
  const [assetModal, setAssetModal] = useState<{ open: boolean; isEdit: boolean; asset?: any }>({ open: false, isEdit: false });
  const [detailsDrawer, setDetailsDrawer] = useState<{ open: boolean; asset?: any; activeTab: 'OVERVIEW' | 'HISTORY' | 'MAINTENANCE' }>({
    open: false,
    activeTab: 'OVERVIEW',
  });
  const [allocateModal, setAllocateModal] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [returnModal, setReturnModal] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [maintenanceModal, setMaintenanceModal] = useState<{ open: boolean; asset?: any }>({ open: false });

  // Category Form State
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#2563eb');
  const [catIcon, setCatIcon] = useState('Boxes');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // Asset Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    allocatedToBranch: '',
    allocatedToUser: '',
    allocatedToUserName: '',
    status: 'AVAILABLE',
    serialNumber: '',
    modelNumber: '',
    specifications: '',
    purchaseDate: '',
    purchaseCost: 0,
    currentValue: 0,
    billNumber: '',
    vendorName: '',
    warrantyExpiry: '',
    amcExpiry: '',
    insuranceExpiry: '',
    depreciationRate: 0,
    notes: '',
  });

  // Allocation Form State
  const [allocBranch, setAllocBranch] = useState('');
  const [allocUser, setAllocUser] = useState('');
  const [allocUserName, setAllocUserName] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('');

  // Return Form State
  const [returnRemarks, setReturnRemarks] = useState('');

  // Maintenance Form State
  const [maintType, setMaintType] = useState('REPAIR');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintCost, setMaintCost] = useState(0);
  const [maintVendor, setMaintVendor] = useState('');
  const [maintTech, setMaintTech] = useState('');

  // Query parameters
  const queryParams = new URLSearchParams({
    category: selectedCategory,
    status: selectedStatus,
    branchCode: isBranchUser && userBranch ? userBranch : selectedBranch,
    search,
  }).toString();

  const { data, mutate, isLoading } = useSWR(`/assets?${queryParams}`, fetcher);

  // Fetch branches for branch assignment
  const { data: branchesData } = useSWR('/branches?pageSize=100', fetcher);
  const branches: any[] = useMemo(() => {
    if (Array.isArray(branchesData?.data)) return branchesData.data;
    if (Array.isArray(branchesData)) return branchesData;
    if (Array.isArray(data?.branches)) return data.branches;
    return [];
  }, [branchesData, data?.branches]);

  const assets: any[] = data?.assets || [];
  const categories: any[] = data?.categories || [];
  const metrics = data?.metrics || {
    totalCount: 0,
    availableCount: 0,
    allocatedCount: 0,
    maintenanceCount: 0,
    disposedCount: 0,
    totalPurchaseCost: 0,
    totalCurrentValuation: 0,
  };

  // Keyboard shortcut (Escape to close any modal/drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCategoryModal(false);
        setAssetModal({ open: false, isEdit: false });
        setDetailsDrawer({ open: false, activeTab: 'OVERVIEW' });
        setAllocateModal({ open: false });
        setReturnModal({ open: false });
        setMaintenanceModal({ open: false });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── CATEGORY CRUD HANDLERS ────────────────────────────────────────────────
  const handleOpenEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setCatCode(cat.code);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatColor(cat.color || '#2563eb');
    setCatIcon(cat.icon || 'Boxes');
  };

  const handleResetCategoryForm = () => {
    setEditingCatId(null);
    setCatCode('');
    setCatName('');
    setCatDesc('');
    setCatColor('#2563eb');
    setCatIcon('Boxes');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode.trim() || !catName.trim()) {
      toast.error('Category Code and Name are required');
      return;
    }

    setSavingCategory(true);
    try {
      await api.post('/assets/categories', {
        id: editingCatId || undefined,
        code: catCode.trim().toUpperCase(),
        name: catName.trim(),
        description: catDesc.trim(),
        color: catColor,
        icon: catIcon,
      });

      toast.success(editingCatId ? 'Category updated successfully!' : 'Category created successfully!', {
        icon: '🏷️',
      });
      handleResetCategoryForm();
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete or deactivate category "${name}"?`)) return;

    try {
      const res = await api.delete(`/assets/categories/${id}`);
      toast.success(res.data?.message || `Category "${name}" processed successfully`);
      if (editingCatId === id) handleResetCategoryForm();
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete category');
    }
  };

  // ─── ASSET CRUD HANDLERS ───────────────────────────────────────────────────
  const handleOpenAssetModal = (asset?: any) => {
    if (asset) {
      setFormData({
        code: asset.code,
        name: asset.name,
        category: asset.category,
        allocatedToBranch: asset.allocatedToBranch || (branches[0]?.code || 'BSE'),
        allocatedToUser: asset.allocatedToUser || '',
        allocatedToUserName: asset.allocatedToUserName || '',
        status: asset.status,
        serialNumber: asset.serialNumber || '',
        modelNumber: asset.modelNumber || '',
        specifications: asset.specifications || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        purchaseCost: asset.purchaseCost || 0,
        currentValue: asset.currentValue || asset.purchaseCost || 0,
        billNumber: asset.billNumber || '',
        vendorName: asset.vendorName || '',
        warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
        amcExpiry: asset.amcExpiry ? asset.amcExpiry.split('T')[0] : '',
        insuranceExpiry: asset.insuranceExpiry ? asset.insuranceExpiry.split('T')[0] : '',
        depreciationRate: asset.depreciationRate || 0,
        notes: asset.notes || '',
      });
      setAssetModal({ open: true, isEdit: true, asset });
    } else {
      const defaultBranch = isBranchUser && userBranch ? userBranch : (branches[0]?.code || 'BSE');
      const defaultCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0]?.code || 'LAPTOP');
      setFormData({
        code: `AST-${Math.floor(100000 + Math.random() * 900000)}`,
        name: '',
        category: defaultCat,
        allocatedToBranch: defaultBranch,
        allocatedToUser: '',
        allocatedToUserName: '',
        status: 'AVAILABLE',
        serialNumber: '',
        modelNumber: '',
        specifications: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseCost: 0,
        currentValue: 0,
        billNumber: '',
        vendorName: '',
        warrantyExpiry: '',
        amcExpiry: '',
        insuranceExpiry: '',
        depreciationRate: 15,
        notes: '',
      });
      setAssetModal({ open: true, isEdit: false });
    }
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.category) {
      toast.error('Asset Code, Name, and Category are required');
      return;
    }

    try {
      if (assetModal.isEdit && assetModal.asset?.id) {
        await api.put(`/assets/${assetModal.asset.id}`, formData);
        toast.success('Asset updated successfully!', { icon: '✅' });
      } else {
        await api.post('/assets', formData);
        toast.success('New asset registered successfully!', { icon: '📦' });
      }

      setAssetModal({ open: false, isEdit: false });
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save asset');
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete asset "${name}"?`)) return;
    try {
      await api.delete(`/assets/${id}`);
      toast.success('Asset deleted successfully', { icon: '🗑️' });
      if (detailsDrawer.open && detailsDrawer.asset?.id === id) {
        setDetailsDrawer({ open: false, activeTab: 'OVERVIEW' });
      }
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete asset');
    }
  };

  // ─── ALLOCATION & RETURN HANDLERS ──────────────────────────────────────────
  const handleOpenAllocate = (asset: any) => {
    setAllocBranch(asset.allocatedToBranch || (isBranchUser && userBranch ? userBranch : branches[0]?.code || 'BSE'));
    setAllocUser(asset.allocatedToUser || '');
    setAllocUserName(asset.allocatedToUserName || '');
    setAllocRemarks('');
    setAllocateModal({ open: true, asset });
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateModal.asset) return;

    try {
      await api.post(`/assets/${allocateModal.asset.id}/allocate`, {
        branchCode: allocBranch,
        userId: allocUser || undefined,
        userName: allocUserName || undefined,
        remarks: allocRemarks,
      });

      toast.success(`Asset allocated to ${allocUserName || allocBranch}!`, { icon: '📍' });
      setAllocateModal({ open: false });
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to allocate asset');
    }
  };

  const handleOpenReturn = (asset: any) => {
    setReturnRemarks('');
    setReturnModal({ open: true, asset });
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModal.asset) return;

    try {
      await api.post(`/assets/${returnModal.asset.id}/return`, {
        remarks: returnRemarks,
      });

      toast.success('Asset returned to available stock!', { icon: '↩️' });
      setReturnModal({ open: false });
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to return asset');
    }
  };

  // ─── MAINTENANCE HANDLERS ──────────────────────────────────────────────────
  const handleOpenMaintenance = (asset: any) => {
    setMaintType('REPAIR');
    setMaintDesc('');
    setMaintCost(0);
    setMaintVendor(asset.vendorName || '');
    setMaintTech('');
    setMaintenanceModal({ open: true, asset });
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceModal.asset) return;
    if (!maintDesc.trim()) {
      toast.error('Please enter a service/maintenance description');
      return;
    }

    try {
      await api.post(`/assets/${maintenanceModal.asset.id}/maintenance`, {
        type: maintType,
        description: maintDesc,
        cost: Number(maintCost) || 0,
        vendorName: maintVendor || undefined,
        performedBy: maintTech || undefined,
      });

      toast.success('Service log recorded successfully!', { icon: '🔧' });
      setMaintenanceModal({ open: false });
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to log maintenance');
    }
  };

  // ─── EXCEL EXPORT ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (assets.length === 0) {
      toast.error('No assets to export in the current view');
      return;
    }

    const rows = assets.map((a, idx) => ({
      '#': idx + 1,
      'Asset Code / Tag': a.code,
      'Asset Name': a.name,
      'Category': a.category,
      'Status': a.status,
      'Assigned Branch': a.allocatedToBranch || 'Unassigned',
      'Assigned Custodian': a.allocatedToUserName || 'In Storage',
      'Serial Number': a.serialNumber || '-',
      'Model Number': a.modelNumber || '-',
      'Purchase Date': a.purchaseDate ? a.purchaseDate.split('T')[0] : '-',
      'Purchase Cost (₹)': a.purchaseCost || 0,
      'Current Book Value (₹)': a.currentValue || a.purchaseCost || 0,
      'Vendor': a.vendorName || '-',
      'Warranty Expiry': a.warrantyExpiry ? a.warrantyExpiry.split('T')[0] : '-',
      'AMC Expiry': a.amcExpiry ? a.amcExpiry.split('T')[0] : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Inventory');
    XLSX.writeFile(wb, `TheSSBuddy_Asset_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Asset Inventory exported to Excel!', { icon: '📊' });
  };

  return (
    <AppShell title="Asset Inventory & Lifecycle Management" breadcrumb="Enterprise Infrastructure">
      <div className="space-y-5 max-w-full">
        {/* ─── 1. DYNAMIC CATEGORY NAVIGATION TABS ─── */}
        <div className="bg-white rounded-2xl p-2.5 shadow-2xs border border-slate-200/90 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-[#053D3A] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <Boxes size={14} className={selectedCategory === 'ALL' ? 'text-[#FFE2B8]' : 'text-slate-500'} />
              <span>All Categories</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {metrics.totalCount}
              </span>
            </button>

            {categories.map((cat: any) => {
              const IconComp = getCategoryIcon(cat.icon);
              const isSelected = selectedCategory === cat.code;
              return (
                <button
                  key={cat.id || cat.code}
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#053D3A] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  <IconComp size={14} style={{ color: isSelected ? '#FFE2B8' : cat.color || '#2563eb' }} />
                  <span>{cat.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cat.assetCount || 0}
                  </span>
                </button>
              );
            })}

            {isSuperAdmin && (
              <button
                onClick={() => setCategoryModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 flex items-center gap-1.5 transition ml-auto cursor-pointer"
                title="Add or Edit Categories"
              >
                <Settings size={13} />
                <span>Manage Categories ({categories.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── 2. EXECUTIVE 5-CARD VALUATION & LIFECYCLE COCKPIT ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: TOTAL INVENTORY & VALUATION */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Inventory</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                <Boxes size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{metrics.totalCount.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-[#053D3A] mt-0.5 font-mono">
              ₹{Math.round(metrics.totalCurrentValuation || metrics.totalPurchaseCost || 0).toLocaleString('en-IN')} CapVal
            </p>
          </div>

          {/* Card 2: ALLOCATED / IN ACTIVE SERVICE */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">In Active Service</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                <UserCheck size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-indigo-900 mt-1 font-mono">{metrics.allocatedCount.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
              {metrics.totalCount > 0 ? Math.round((metrics.allocatedCount / metrics.totalCount) * 100) : 0}% fleet deployed
            </p>
          </div>

          {/* Card 3: AVAILABLE IN STOCK */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Available in Stock</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-emerald-700 mt-1 font-mono">{metrics.availableCount.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Ready for allocation</p>
          </div>

          {/* Card 4: UNDER MAINTENANCE */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">In Maintenance</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Wrench size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-amber-800 mt-1 font-mono">{metrics.maintenanceCount.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-amber-600 mt-0.5">Repair & service queue</p>
          </div>

          {/* Card 5: RETIRED / SALVAGE */}
          <div className="bg-[#FFF8EC] rounded-2xl p-4 border border-[#FFE2B8] shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Retired / Disposed</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center border border-amber-300">
                <ShieldCheck size={14} />
              </div>
            </div>
            <p className="text-xl font-black text-[#053D3A] mt-1 font-mono">{(metrics.disposedCount || 0).toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-amber-800 mt-0.5">Off-book salvage</p>
          </div>
        </div>

        {/* ─── 3. ADVANCED TOOLBAR & SEARCH ─── */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, name, serial, user..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available in Stock</option>
                  <option value="ALLOCATED">Allocated / In Use</option>
                  <option value="MAINTENANCE">Under Maintenance</option>
                  <option value="DISPOSED">Disposed / Retired</option>
                </select>
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Branch:</span>
                <select
                  value={isBranchUser && userBranch ? userBranch : selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={Boolean(isBranchUser && userBranch)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer disabled:opacity-75"
                >
                  {isBranchUser && userBranch ? (
                    <option value={userBranch}>{userBranchName || userBranch}</option>
                  ) : (
                    <>
                      <option value="ALL">All Branches ({branches.length})</option>
                      {branches.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition border border-slate-300 shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet size={14} className="text-emerald-700" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={() => handleOpenAssetModal()}
                className="px-4 py-1.5 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer border border-[#053D3A]"
              >
                <Plus size={14} className="text-[#FFE2B8]" />
                <span>Register Asset</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 4. ASSET INVENTORY DATAGRID MATRIX ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes size={15} className="text-[#053D3A]" />
              <span className="font-extrabold text-xs text-slate-900">
                Asset Inventory Records ({assets.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Manage complete lifecycle, maintenance logs, and custodian allocations
            </span>
          </div>

          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-20 table-header-navy select-none">
                <tr>
                  <th className="px-3.5 py-2.5 border-r border-white/10 w-12 text-center">#</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 min-w-[140px]">Asset Code & Tag</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 min-w-[200px]">Asset Details</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 text-center">Category</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 text-center">Location & Custodian</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 text-center">Status</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 text-right">Valuation (₹)</th>
                  <th className="px-3.5 py-2.5 border-r border-white/10 text-center">Warranty</th>
                  <th className="px-3.5 py-2.5 text-center min-w-[160px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <RefreshCw size={24} className="animate-spin text-[#053D3A] mx-auto mb-2" />
                      <span className="font-bold">Loading enterprise asset records...</span>
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <Boxes size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">No assets found</p>
                      <p className="text-xs text-slate-400 mt-1">Register new assets or adjust filter criteria above.</p>
                    </td>
                  </tr>
                ) : (
                  assets.map((a: any, idx: number) => {
                    const catObj = categories.find((c: any) => c.code.toUpperCase() === a.category.toUpperCase());
                    const CatIcon = getCategoryIcon(catObj?.icon);

                    const isAllocated = a.status === 'ALLOCATED';
                    const isAvailable = a.status === 'AVAILABLE';
                    const isMaintenance = a.status === 'MAINTENANCE';

                    return (
                      <tr key={a.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-400 border-r border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Code & Tag */}
                        <td className="px-3.5 py-2.5 border-r border-slate-200">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#053D3A] font-mono font-black text-xs border border-slate-200 shadow-2xs">
                            {a.code}
                          </span>
                          {a.serialNumber && (
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                              S/N: {a.serialNumber}
                            </p>
                          )}
                        </td>

                        {/* Name & Model */}
                        <td className="px-3.5 py-2.5 border-r border-slate-200">
                          <p className="font-extrabold text-slate-900 text-xs leading-snug">{a.name}</p>
                          {a.modelNumber && (
                            <p className="text-[10px] text-slate-500 font-medium">{a.modelNumber}</p>
                          )}
                        </td>

                        {/* Category Badge */}
                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border"
                            style={{
                              backgroundColor: `${catObj?.color || '#053D3A'}15`,
                              color: catObj?.color || '#053D3A',
                              borderColor: `${catObj?.color || '#053D3A'}30`,
                            }}
                          >
                            <CatIcon size={11} />
                            <span>{catObj?.name || a.category}</span>
                          </span>
                        </td>

                        {/* Location & Custodian */}
                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-[10px] text-slate-800">
                              {a.allocatedToBranch || 'Storage'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[120px]">
                              {a.allocatedToUserName || (isAvailable ? 'In Storage' : '-')}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : isAllocated
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                : isMaintenance
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-rose-50 text-rose-700 border-rose-300'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>

                        {/* Valuation */}
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          ₹{Math.round(a.currentValue || a.purchaseCost || 0).toLocaleString('en-IN')}
                        </td>

                        {/* Warranty / AMC */}
                        <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                          {a.warrantyExpiry ? (
                            <span className="text-[10px] font-mono font-semibold text-slate-600">
                              {new Date(a.warrantyExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Details / Timeline Drawer */}
                            <button
                              onClick={() => setDetailsDrawer({ open: true, asset: a, activeTab: 'OVERVIEW' })}
                              className="p-1 text-slate-600 hover:text-[#053D3A] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="View Details & History Timeline"
                            >
                              <Eye size={14} />
                            </button>

                            {/* Allocate / Reassign */}
                            <button
                              onClick={() => handleOpenAllocate(a)}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Allocate / Reassign Asset"
                            >
                              <UserCheck size={14} />
                            </button>

                            {/* Return (if allocated) */}
                            {isAllocated && (
                              <button
                                onClick={() => handleOpenReturn(a)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Return to Storage"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}

                            {/* Log Maintenance */}
                            <button
                              onClick={() => handleOpenMaintenance(a)}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Log Service / Repair"
                            >
                              <Wrench size={14} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenAssetModal(a)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Asset Details"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Delete (SuperAdmin Only) */}
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleDeleteAsset(a.id, a.name)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Asset"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
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

        {/* ─── 5. CATEGORY MANAGEMENT MODAL ─── */}
        {categoryModal && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47]">
                <div className="flex items-center gap-2.5">
                  <Tag size={17} className="text-[#FFE2B8]" />
                  <div>
                    <h2 className="font-extrabold text-sm text-white">Dynamic Asset Categories</h2>
                    <p className="text-[11px] text-[#DCEDEA]">Manage company-wide infrastructure categories</p>
                  </div>
                </div>
                <button
                  onClick={() => setCategoryModal(false)}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Form to Add / Edit Category */}
                <form onSubmit={handleSaveCategory} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <span className="text-xs font-black text-slate-800">
                      {editingCatId ? 'Edit Category' : '+ Add New Category'}
                    </span>
                    {editingCatId && (
                      <button
                        type="button"
                        onClick={handleResetCategoryForm}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Category Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CCTV, SERVER"
                        value={catCode}
                        onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Category Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Security & Surveillance"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Brief details about items in this category"
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    />
                  </div>

                  {/* Color & Icon Palette */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Theme Color</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {CATEGORY_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setCatColor(col)}
                            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                              catColor === col ? 'scale-125 ring-2 ring-[#053D3A]' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingCategory || !catCode.trim() || !catName.trim()}
                      className="px-4 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0 mt-3"
                    >
                      {savingCategory ? 'Saving...' : editingCatId ? 'Update Category' : '+ Add Category'}
                    </button>
                  </div>
                </form>

                {/* Existing Categories List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Existing Categories ({categories.length})
                  </span>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {categories.map((cat: any) => {
                      const IconComp = getCategoryIcon(cat.icon);
                      return (
                        <div key={cat.id || cat.code} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${cat.color || '#2563eb'}20`, color: cat.color || '#2563eb' }}
                            >
                              <IconComp size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900">{cat.name}</span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] font-bold">
                                  {cat.code}
                                </span>
                              </div>
                              {cat.description && (
                                <p className="text-[10px] text-slate-400 truncate">{cat.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                              {cat.assetCount || 0} Assets
                            </span>

                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit Category"
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Category"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setCategoryModal(false)}
                  className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 6. ASSET REGISTRATION & EDIT MODAL ─── */}
        {assetModal.open && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47]">
                <div className="flex items-center gap-2.5">
                  <Boxes size={17} className="text-[#FFE2B8]" />
                  <div>
                    <h2 className="font-extrabold text-sm text-white">
                      {assetModal.isEdit ? 'Edit Asset Record' : 'Register New Enterprise Asset'}
                    </h2>
                    <p className="text-[11px] text-[#DCEDEA]">Track specifications, financial valuation, and warranty</p>
                  </div>
                </div>
                <button
                  onClick={() => setAssetModal({ open: false, isEdit: false })}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveAsset}>
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Row 1: Code & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Asset Code / Tag <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="AST-100234"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A]"
                      >
                        {categories.map((c: any) => (
                          <option key={c.id || c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Asset Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Asset Name & Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Dell Latitude 5420 i7 16GB"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A]"
                    />
                  </div>

                  {/* Row 3: Serial & Model */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number</label>
                      <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        placeholder="e.g. SN-98234872"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Model Number</label>
                      <input
                        type="text"
                        value={formData.modelNumber}
                        onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                        placeholder="e.g. Latitude-5420"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>
                  </div>

                  {/* Row 4: Branch & Custodian */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Assigned Branch <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.allocatedToBranch}
                        onChange={(e) => setFormData({ ...formData, allocatedToBranch: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A]/20 focus:border-[#053D3A]"
                      >
                        <option value="">Select Branch ({branches.length} available)</option>
                        {branches.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.code} — {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Custodian / Employee Name</label>
                      <input
                        type="text"
                        value={formData.allocatedToUserName}
                        onChange={(e) => setFormData({ ...formData, allocatedToUserName: e.target.value })}
                        placeholder="e.g. Rajesh Kumar"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>
                  </div>

                  {/* Row 5: Financials (Purchase Date & Cost) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Cost (₹)</label>
                      <input
                        type="number"
                        value={formData.purchaseCost}
                        onChange={(e) => setFormData({ ...formData, purchaseCost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Depreciation % / yr</label>
                      <input
                        type="number"
                        value={formData.depreciationRate}
                        onChange={(e) => setFormData({ ...formData, depreciationRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>
                  </div>

                  {/* Row 6: Vendor & Warranty */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Supplier</label>
                      <input
                        type="text"
                        value={formData.vendorName}
                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                        placeholder="e.g. Infotech Solutions Pvt Ltd"
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Warranty Expiry</label>
                      <input
                        type="date"
                        value={formData.warrantyExpiry}
                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAssetModal({ open: false, isEdit: false })}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl text-xs shadow-sm transition cursor-pointer"
                  >
                    {assetModal.isEdit ? 'Save Changes' : 'Register Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 7. ASSET ALLOCATION MODAL ─── */}
        {allocateModal.open && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47]">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-[#FFE2B8]" />
                  <h2 className="font-extrabold text-sm text-white">Allocate / Reassign Asset</h2>
                </div>
                <button
                  onClick={() => setAllocateModal({ open: false })}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAllocateSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-extrabold text-xs text-slate-900">{allocateModal.asset?.name}</p>
                  <p className="font-mono text-[10px] text-[#053D3A] font-bold mt-0.5">{allocateModal.asset?.code}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={allocBranch}
                    onChange={(e) => setAllocBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  >
                    <option value="">Select Branch ({branches.length} available)</option>
                    {branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custodian / Employee Name</label>
                  <input
                    type="text"
                    value={allocUserName}
                    onChange={(e) => setAllocUserName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocation Remarks</label>
                  <input
                    type="text"
                    value={allocRemarks}
                    onChange={(e) => setAllocRemarks(e.target.value)}
                    placeholder="e.g. Issued for Regional Sales visit"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocateModal({ open: false })}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-sm"
                  >
                    Confirm Allocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 8. ASSET RETURN MODAL ─── */}
        {returnModal.open && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47]">
                <div className="flex items-center gap-2">
                  <RotateCcw size={16} className="text-[#FFE2B8]" />
                  <h2 className="font-extrabold text-sm text-white">Return Asset to Storage</h2>
                </div>
                <button
                  onClick={() => setReturnModal({ open: false })}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleReturnSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-extrabold text-xs text-slate-900">{returnModal.asset?.name}</p>
                  <p className="font-mono text-[10px] text-[#053D3A] font-bold mt-0.5">{returnModal.asset?.code}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current Holder: <strong>{returnModal.asset?.allocatedToUserName || 'Branch'}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Return Condition & Remarks</label>
                  <input
                    type="text"
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    placeholder="e.g. Returned in good working condition"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnModal({ open: false })}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm"
                  >
                    Confirm Return
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 9. MAINTENANCE & SERVICE MODAL ─── */}
        {maintenanceModal.open && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47]">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-[#FFE2B8]" />
                  <h2 className="font-extrabold text-sm text-white">Log Asset Maintenance</h2>
                </div>
                <button
                  onClick={() => setMaintenanceModal({ open: false })}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleMaintenanceSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-extrabold text-xs text-slate-900">{maintenanceModal.asset?.name}</p>
                  <p className="font-mono text-[10px] text-[#053D3A] font-bold mt-0.5">{maintenanceModal.asset?.code}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={maintType}
                    onChange={(e) => setMaintType(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  >
                    <option value="REPAIR">Hardware Repair</option>
                    <option value="SERVICE">Preventive Service / Calibration</option>
                    <option value="UPGRADE">Part / RAM / SSD Upgrade</option>
                    <option value="INSPECTION">Physical Inspection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issue Description / Action Taken <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    placeholder="Describe the issue, parts replaced, or service details..."
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Service Cost (₹)</label>
                    <input
                      type="number"
                      value={maintCost}
                      onChange={(e) => setMaintCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Technician / Vendor</label>
                    <input
                      type="text"
                      value={maintTech}
                      onChange={(e) => setMaintTech(e.target.value)}
                      placeholder="e.g. Dell Authorized Tech"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintenanceModal({ open: false })}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-extrabold text-xs rounded-xl shadow-sm"
                  >
                    Save Service Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 10. ASSET 360° DETAILS & TIMELINE DRAWER ─── */}
        {detailsDrawer.open && detailsDrawer.asset && (
          <div className="portal-modal-backdrop">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="bg-[#032F2D] text-white px-5 py-4 flex items-center justify-between border-b border-[#074B47] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#053D3A] border border-[#074B47] flex items-center justify-center text-[#FFE2B8]">
                    <QrCode size={18} />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-white">{detailsDrawer.asset.name}</h2>
                    <p className="font-mono text-xs text-[#FFE2B8] font-bold">{detailsDrawer.asset.code}</p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailsDrawer({ open: false, activeTab: 'OVERVIEW' })}
                  className="text-[#DCEDEA] hover:text-white p-1 rounded-lg hover:bg-[#053D3A] transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sub-Nav Tabs */}
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDetailsDrawer({ ...detailsDrawer, activeTab: 'OVERVIEW' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    detailsDrawer.activeTab === 'OVERVIEW' ? 'bg-[#053D3A] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Overview & Specs
                </button>

                <button
                  onClick={() => setDetailsDrawer({ ...detailsDrawer, activeTab: 'HISTORY' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                    detailsDrawer.activeTab === 'HISTORY' ? 'bg-[#053D3A] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <History size={13} />
                  <span>Allocation History ({detailsDrawer.asset.allocations?.length || 0})</span>
                </button>

                <button
                  onClick={() => setDetailsDrawer({ ...detailsDrawer, activeTab: 'MAINTENANCE' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                    detailsDrawer.activeTab === 'MAINTENANCE' ? 'bg-[#053D3A] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Wrench size={13} />
                  <span>Service Logs ({detailsDrawer.asset.maintenanceLogs?.length || 0})</span>
                </button>
              </div>

              {/* Content Area */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {detailsDrawer.activeTab === 'OVERVIEW' && (
                  <div className="space-y-4 text-xs">
                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Status</span>
                        <span className="font-extrabold text-sm text-slate-900 mt-1 block">{detailsDrawer.asset.status}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Category</span>
                        <span className="font-extrabold text-sm text-slate-900 mt-1 block">{detailsDrawer.asset.category}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Branch</span>
                        <span className="font-extrabold text-sm text-slate-900 mt-1 block">{detailsDrawer.asset.allocatedToBranch || 'Storage'}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Custodian</span>
                        <span className="font-extrabold text-sm text-slate-900 mt-1 block">{detailsDrawer.asset.allocatedToUserName || 'In Stock'}</span>
                      </div>
                    </div>

                    {/* Detailed Specifications */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                      <span className="font-black text-xs text-slate-900 uppercase tracking-wider block">Financial & Warranty Details</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Purchase Cost:</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            ₹{Math.round(detailsDrawer.asset.purchaseCost || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Book Value:</span>
                          <span className="font-mono font-bold text-[#053D3A] text-xs">
                            ₹{Math.round(detailsDrawer.asset.currentValue || detailsDrawer.asset.purchaseCost || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Serial Number:</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">{detailsDrawer.asset.serialNumber || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Model:</span>
                          <span className="font-bold text-slate-900 text-xs">{detailsDrawer.asset.modelNumber || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Vendor:</span>
                          <span className="font-bold text-slate-900 text-xs">{detailsDrawer.asset.vendorName || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-semibold">Warranty Expiry:</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {detailsDrawer.asset.warrantyExpiry ? detailsDrawer.asset.warrantyExpiry.split('T')[0] : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailsDrawer.activeTab === 'HISTORY' && (
                  <div className="space-y-3">
                    {(!detailsDrawer.asset.allocations || detailsDrawer.asset.allocations.length === 0) ? (
                      <div className="py-8 text-center text-slate-400 text-xs">No previous allocation logs found.</div>
                    ) : (
                      detailsDrawer.asset.allocations.map((al: any, i: number) => (
                        <div key={al.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                            <UserCheck size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-extrabold text-xs text-slate-900">{al.userName || 'Assigned User'}</p>
                              <span className="text-[10px] font-mono text-slate-500">
                                {new Date(al.allocatedAt).toLocaleDateString('en-GB')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">Branch: {al.branchCode}</p>
                            {al.remarks && <p className="text-[10px] text-slate-500 mt-1 italic">"{al.remarks}"</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {detailsDrawer.activeTab === 'MAINTENANCE' && (
                  <div className="space-y-3">
                    {(!detailsDrawer.asset.maintenanceLogs || detailsDrawer.asset.maintenanceLogs.length === 0) ? (
                      <div className="py-8 text-center text-slate-400 text-xs">No maintenance or repair logs found.</div>
                    ) : (
                      detailsDrawer.asset.maintenanceLogs.map((ml: any, i: number) => (
                        <div key={ml.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Wrench size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                {ml.type}
                              </span>
                              <span className="font-mono font-bold text-xs text-slate-900">
                                ₹{Math.round(ml.cost || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 font-bold mt-1.5">{ml.description}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                              <span>Date: {new Date(ml.serviceDate).toLocaleDateString('en-GB')}</span>
                              {ml.performedBy && <span>Tech: {ml.performedBy}</span>}
                              {ml.vendorName && <span>Vendor: {ml.vendorName}</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setDetailsDrawer({ open: false, activeTab: 'OVERVIEW' })}
                  className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
