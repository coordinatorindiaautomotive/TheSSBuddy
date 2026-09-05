'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
import { useForm } from 'react-hook-form';
import {
  Building2, CheckCircle2, Percent, Sliders, AlertTriangle, Filter,
  Search, RotateCcw, Download, Plus, MoreVertical, Eye, Edit, UserCheck,
  X, Phone, Mail, MapPin, CreditCard, Shield, RefreshCw, Layers, Check,
  Link2, Loader2, Sparkles, Lock, FileText, Ban, Key, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Badge, StatCard, Pagination } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(r => r.data);

function formatShortPartyType(type: string): string {
  if (!type || type === '-') return '-';
  const u = type.toUpperCase().trim();
  if (u.includes('INDEPENDENT WORKSHOP') || u === 'IW' || u === 'MWS') return 'IW';
  if (u === 'MASS' || u === 'MSZ') return 'MASS';
  if (u.includes('TRADER') || u.includes('RETAILER')) return 'Trader';
  if (u.includes('WALK-IN') || u.includes('WALKIN') || u.includes('OTHERS')) return 'Walk-in';
  if (u === 'CO-DEALER' || u === 'CODEALER') return 'Co-Dealer';
  if (u === 'CO-DISTRIBUTOR' || u === 'CODISTRIBUTOR') return 'Co-Distributor';
  return type;
}

function getTypeBadgeStyle(shortType: string): string {
  switch (shortType) {
    case 'IW':
      return 'bg-violet-50 text-violet-700 border-violet-200 font-bold';
    case 'MASS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
    case 'Co-Dealer':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
    case 'Co-Distributor':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 font-bold';
    case 'Trader':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'Walk-in':
      return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-bold';
  }
}

// ─── Quick Preview Modal ──────────────────────────────────────────────────────
function QuickPreviewModal({ party, onClose }: { party: any; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!party) return null;

  const code = party.code || party.consPartyCode || '-';
  const origCode = party.originalCode || code;
  const isMapped = origCode && origCode !== code && origCode !== '-';

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-200 m-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                <Building2 size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight text-white">{party.name || party.consPartyName || 'Party Details'}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-blue-200/80 font-mono">Code: {code}</span>
                  {isMapped && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-400/30">
                      <Link2 size={10} /> Master: {origCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <p className="text-[11px] font-semibold text-blue-600 uppercase">Party Type</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{party.type || party.partyType || 'DEALER'}</p>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <p className="text-[11px] font-semibold text-purple-600 uppercase">Incentive Rule</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{party.incentiveRule || party.incentiveType || 'Slab-Based'}</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <p className="text-[11px] font-semibold text-emerald-600 uppercase">Location</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{party.baseLoc || party.primaryBranchCode || 'All Branches'}</p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact & Master Profile</h3>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Party Code:</span>
                  <span className="font-mono font-bold text-blue-700">{code}</span>
                </div>
                {isMapped && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 bg-amber-50/40 px-1 rounded">
                    <span className="text-amber-800 font-semibold flex items-center gap-1">
                      <Link2 size={12} /> Master Party Code:
                    </span>
                    <span className="font-mono font-bold text-amber-900">{origCode}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Sales Executive:</span>
                  <span className="font-medium text-slate-800">{party.salesExecutive || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Mobile Phone:</span>
                  <span className="font-medium text-slate-800 font-mono">{party.phone || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="font-mono text-slate-800 text-xs">{party.gstIn || party.gstin || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">PAN:</span>
                  <span className="font-mono text-slate-800 text-xs">{party.pan || '-'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Master Setup</h3>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Bank Name:</span>
                  <span className="font-medium text-slate-800">{party.bankName || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Branch Name:</span>
                  <span className="font-medium text-slate-800">{party.branchName || party.bankBranch || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Account No:</span>
                  <span className="font-mono text-slate-800 font-medium">{party.accountNumber && party.accountNumber !== '-' ? party.accountNumber : '⚠️ Pending Setup'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">IFSC Code:</span>
                  <span className="font-mono text-slate-800 text-xs font-bold text-emerald-700">{party.ifscCode || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Account Holder:</span>
                  <span className="font-medium text-slate-800">{party.accountHolder || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Total Sales (YTD):</span>
                  <span className="font-bold text-blue-700">₹{Number(party.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition">
              Close
            </button>
          </div>
        </div>
      </div>
    </ClientPortal>
  );
}

// ─── Edit Party Modal ────────────────────────────────────────────────────────
function EditPartyModal({
  party,
  onClose,
  onSuccess,
  isSuperAdmin = true,
  branchesList = [],
}: {
  party: any;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin?: boolean;
  branchesList?: string[];
}) {
  const currentCode = party?.code || party?.consPartyCode || '';
  const currentName = party?.name || party?.consPartyName || '';
  const currentType = party?.type || party?.partyType || 'INDEPENDENT WORKSHOP';
  const initialRule = party?.incentiveRule || party?.incentiveType || 'Slab-Based';
  const isFixedInitial = initialRule.toLowerCase().includes('fixed');
  const extractedFixedVal = isFixedInitial ? (initialRule.match(/\d+(\.\d+)?/)?.[0] || '8.0') : '8.0';

  const [ruleType, setRuleType] = useState<string>(isFixedInitial ? 'Fixed' : initialRule.includes('Custom') ? 'Custom Formula' : 'Slab-Based');
  const [fixedRate, setFixedRate] = useState<string>(extractedFixedVal);
  const [isLookingUpIfsc, setIsLookingUpIfsc] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: currentName,
      code: currentCode,
      originalCode: party?.originalCode || currentCode,
      partyType: currentType,
      salesExecutive: party?.salesExecutive && party?.salesExecutive !== '-' ? party.salesExecutive : '',
      phone: party?.phone && party?.phone !== '-' ? party.phone : '',
      baseLoc: party?.baseLoc || party?.primaryBranchCode || 'BSE',
      bankName: party?.bankName && party?.bankName !== '-' ? party.bankName : '',
      bankBranch: party?.branchName || party?.bankBranch || '',
      accountNumber: party?.accountNumber && party?.accountNumber !== '-' ? party.accountNumber : '',
      ifscCode: party?.ifscCode && party?.ifscCode !== '-' ? party.ifscCode : '',
      accountHolder: party?.accountHolder && party?.accountHolder !== 'Pending Setup' ? party.accountHolder : '',
      pan: party?.pan && party?.pan !== '-' ? party.pan : '',
      gstIn: party?.gstIn || party?.gstin || '',
    }
  });

  // Handle IFSC lookup
  const handleIfscInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.trim().toUpperCase();
    setValue('ifscCode', rawVal);

    if (rawVal.length === 11) {
      setIsLookingUpIfsc(true);
      try {
        const res = await api.get(`/parties/ifsc/${rawVal}`);
        if (res.data && res.data.ok) {
          if (res.data.bankName) setValue('bankName', res.data.bankName);
          if (res.data.branchName) setValue('bankBranch', res.data.branchName);
          toast.success(`🏦 Detected: ${res.data.bankName} - ${res.data.branchName}`);
        } else {
          toast.error(res.data?.message || 'IFSC details not found');
        }
      } catch {
        toast.error('IFSC lookup failed. Please enter Bank Name manually.');
      } finally {
        setIsLookingUpIfsc(false);
      }
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const code = party?.code || party?.consPartyCode;
      if (code && code !== '-') {
        const computedIncentiveRule = ruleType === 'Fixed' ? `Fixed (${fixedRate || '8.0'}%)` : ruleType;

        const payload: any = {
          salesExecutive: data.salesExecutive,
          phone: data.phone,
          pan: data.pan,
          gstIn: data.gstIn,
          bankName: data.bankName,
          bankBranch: data.bankBranch,
          accountNumber: data.accountNumber,
          ifscCode: data.ifscCode,
          accountHolder: data.accountHolder,
        };

        // Only SuperAdmin can modify master codes, branches, and incentive types
        if (isSuperAdmin) {
          payload.originalCode = data.originalCode?.trim() || code;
          if (data.baseLoc) payload.baseLoc = data.baseLoc;
          payload.incentiveRule = computedIncentiveRule;
          payload.incentiveType = computedIncentiveRule;
        }

        await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, payload);
      }
      toast.success(isSuperAdmin ? 'Party updated successfully!' : 'Bank & KYC details saved successfully!');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update party details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-slate-200 m-auto flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              {isSuperAdmin ? (
                <Edit size={18} className="text-blue-400" />
              ) : (
                <CreditCard size={18} className="text-emerald-400" />
              )}
              <div>
                <h2 className="font-bold text-base text-white">
                  {isSuperAdmin ? `Edit Party — ${currentCode}` : `Bank & KYC Setup — ${currentName || currentCode}`}
                </h2>
                {!isSuperAdmin && (
                  <p className="text-[10px] text-emerald-300 font-mono">Branch Manager Mode: Bank Detail & KYC Setup</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Top Identity Row */}
              {isSuperAdmin ? (
                <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50/90 rounded-xl border border-slate-200">
                  {/* 1. Party Code */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <Building2 size={12} className="text-blue-600" /> Party Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={currentCode}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-700 select-all cursor-default"
                      title="Current System Party Code"
                    />
                  </div>

                  {/* 2. Party Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Party Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...register('name')}
                      placeholder="Enter Party Name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 text-xs font-semibold bg-white"
                    />
                  </div>

                  {/* 3. Original / Master Code */}
                  <div>
                    <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Link2 size={12} className="text-blue-600" /> Original Code
                      </span>
                      <span className="text-[9px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-bold">Master</span>
                    </label>
                    <input
                      {...register('originalCode')}
                      placeholder={`e.g. ${currentCode} (Master Code)`}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 bg-white font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Party Code</p>
                    <p className="font-mono font-bold text-blue-700">{currentCode}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Party Name</p>
                    <p className="font-bold text-slate-800 truncate">{currentName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Party Type</p>
                    <p className="font-semibold text-slate-700 truncate">{currentType}</p>
                  </div>
                </div>
              )}

              {/* Party Type, Branch & Incentive Rule (SuperAdmin Only) */}
              {isSuperAdmin && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Party Type</label>
                    <select {...register('partyType')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-800">
                      <option value="INDEPENDENT WORKSHOP">INDEPENDENT WORKSHOP</option>
                      <option value="CO-DEALER">CO-DEALER</option>
                      <option value="CO-DISTRIBUTOR">CO-DISTRIBUTOR</option>
                      <option value="MASS">MASS</option>
                      <option value="TRADER/RETAILER">TRADER/RETAILER</option>
                      <option value="WALK-IN CUSTOMER">WALK-IN CUSTOMER</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-blue-900 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Building2 size={12} className="text-blue-600" /> Branch / Location
                      </span>
                      <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">Admin Only</span>
                    </label>
                    <select
                      {...register('baseLoc')}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-bold font-mono text-slate-800 text-xs cursor-pointer"
                    >
                      {branchesList.map((b: string) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Incentive Structure</label>
                    <select
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                    >
                      <option value="Slab-Based">Slab-Based (Tiered)</option>
                      <option value="Fixed">Fixed Rate (%)</option>
                      <option value="Custom Formula">Custom Formula</option>
                    </select>
                  </div>

                  {ruleType === 'Fixed' && (
                    <div className="col-span-2 p-3 bg-purple-50/80 rounded-xl border border-purple-200 transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                          <Sparkles size={13} className="text-purple-600" /> Enter Custom Fixed Commission Percentage (%)
                        </label>
                        <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                          Dynamic %
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={fixedRate}
                          onChange={(e) => setFixedRate(e.target.value)}
                          placeholder="e.g. 7.5 or 8.0 or 10.0"
                          className="w-full pl-3 pr-8 py-2 border border-purple-300 bg-white rounded-lg focus:ring-1 focus:ring-purple-500 font-bold text-purple-900 text-xs font-mono"
                          autoFocus
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-700 font-black text-xs">%</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Sales Executive & Mobile Phone */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sales Executive</label>
                <input {...register('salesExecutive')} placeholder="e.g. Rajesh Sharma" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input {...register('phone')} placeholder="e.g. 9876543210" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-xs" />
              </div>

              {/* Bank Master Details Header */}
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <CreditCard size={14} className="text-emerald-600" /> Bank Master & Settlement Details
                  </h3>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                    ⚡ Auto-fills on IFSC entry
                  </span>
                </div>
              </div>

              {/* IFSC Code with Live Auto-Detection */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>IFSC Code <span className="text-rose-500">*</span></span>
                  {isLookingUpIfsc && (
                    <span className="text-[10px] text-blue-600 flex items-center gap-1 font-normal">
                      <Loader2 size={10} className="animate-spin" /> Looking up...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    {...register('ifscCode')}
                    onChange={handleIfscInput}
                    placeholder="e.g. SBIN0001746"
                    maxLength={11}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Bank Name (Auto-filled) */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                <input
                  {...register('bankName')}
                  placeholder="Auto-filled from IFSC"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-slate-800 font-medium text-xs"
                />
              </div>

              {/* Branch Name (Auto-filled) */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
                <input
                  {...register('bankBranch')}
                  placeholder="Auto-filled from IFSC"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-slate-800 font-medium text-xs"
                />
              </div>

              {/* Account Number */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">Account Number <span className="text-rose-500">*</span></label>
                <input {...register('accountNumber')} placeholder="Bank account number" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-xs font-bold" />
              </div>

              {/* Account Holder Name */}
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
                <input {...register('accountHolder')} placeholder="Account holder name (as per passbook)" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs" />
              </div>

              {/* PAN & GSTIN */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PAN Number</label>
                <input {...register('pan')} placeholder="e.g. ABCDE1234F" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                <input {...register('gstIn')} placeholder="GST identification number" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs" />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-60">
                {loading ? 'Saving...' : isSuperAdmin ? 'Save Changes' : 'Save Bank & KYC Details'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ClientPortal>
  );
}

function AnchoredActionDropdownMenu({
  party,
  anchor,
  isSuperAdmin,
  onClose,
  onEditBank,
  onEditMaster,
  onPreview,
  onAssignExec,
  onToggleStatus,
}: {
  party: any;
  anchor: { top: number; left: number };
  isSuperAdmin: boolean;
  onClose: () => void;
  onEditBank: () => void;
  onEditMaster: () => void;
  onPreview: () => void;
  onAssignExec: () => void;
  onToggleStatus: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!party) return null;

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[9999] pointer-events-auto select-none">
        {/* Invisible backdrop click-away */}
        <div
          className="fixed inset-0 bg-transparent"
          onClick={onClose}
        />

        {/* Anchored Popover Dropdown Menu floating exactly where button was clicked */}
        <div
          style={{ top: `${anchor.top}px`, left: `${anchor.left}px` }}
          className="fixed z-[10000] w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 text-left font-sans animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
            <p className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">
              {party.name || party.consPartyName}
            </p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] text-blue-600 font-mono font-semibold">
                Code: {party.code || party.consPartyCode}
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                party.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {party.isActive !== false ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onEditBank}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition cursor-pointer"
          >
            <CreditCard size={14} className="text-blue-600 shrink-0" />
            <span>Bank & KYC Details</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={onEditMaster}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <Edit size={14} className="text-slate-600 shrink-0" />
              <span>Edit Party Master</span>
            </button>
          )}

          <button
            type="button"
            onClick={onPreview}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Eye size={14} className="text-slate-600 shrink-0" />
            <span>Quick Preview</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={onAssignExec}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <UserCheck size={14} className="text-slate-600 shrink-0" />
              <span>Assign Executive</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={onToggleStatus}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold transition cursor-pointer border-t border-slate-100 ${
                party.isActive !== false
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {party.isActive !== false ? (
                <>
                  <Ban size={14} className="text-rose-600 shrink-0" />
                  <span>Disable Party (Hide from Branch)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Enable Party Code</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </ClientPortal>
  );
}

// ─── Assign Executive Modal ──────────────────────────────────────────────────
function AssignExecutiveModal({ party, onClose, onSuccess }: { party: any; onClose: () => void; onSuccess: () => void }) {
  const [executive, setExecutive] = useState(party?.salesExecutive && party?.salesExecutive !== '-' ? party.salesExecutive : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!executive.trim()) {
      toast.error('Please enter executive name');
      return;
    }
    setLoading(true);
    try {
      const code = party?.code || party?.consPartyCode;
      await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, {
        salesExecutive: executive.trim(),
      });
      toast.success(`Executive assigned to ${party.name || party.consPartyName}`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to assign executive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 border border-slate-200 m-auto flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-blue-600" />
              <h2 className="font-bold text-slate-800 text-base">Assign Sales Executive</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs">
            <p className="text-slate-500 font-semibold">Party:</p>
            <p className="font-bold text-slate-800 mt-0.5">{party?.name || party?.consPartyName}</p>
            <p className="text-slate-400 font-mono mt-0.5">Code: {party?.code || party?.consPartyCode}</p>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Executive Name</label>
            <input
              type="text"
              value={executive}
              onChange={(e) => setExecutive(e.target.value)}
              placeholder="Enter Sales Executive Name"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 text-slate-800"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-60">
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </ClientPortal>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PartyMasterRegistryPage() {
  const { isBranchUser, userBranch, isSuperAdmin } = useAuth();
  // State for filters
  const [locationFilter, setLocationFilter] = useState('All Branches');
  const [executiveFilter, setExecutiveFilter] = useState('All Executives');
  const [partyTypeFilter, setPartyTypeFilter] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [anchoredMenu, setAnchoredMenu] = useState<{
    party: any;
    anchor: { top: number; left: number };
  } | null>(null);

  const handleOpenActionMenu = (e: React.MouseEvent<HTMLButtonElement>, party: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    const menuWidth = 224; // w-56
    const leftPos = Math.max(16, rect.right - menuWidth);

    const menuHeight = 210;
    const spaceBelow = window.innerHeight - rect.bottom;
    const topPos = spaceBelow < menuHeight + 20
      ? Math.max(16, rect.top - menuHeight - 4)
      : rect.bottom + 4;

    setAnchoredMenu({
      party,
      anchor: { top: topPos, left: leftPos },
    });
  };

  const handleTogglePartyStatus = async (party: any) => {
    const code = party.code || party.consPartyCode;
    const newStatus = party.isActive === false ? true : false;
    try {
      await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, {
        isActive: newStatus,
      });
      toast.success(
        newStatus
          ? `Party ${code} Enabled & Visible to Branches!`
          : `Party ${code} Disabled & Hidden from Branches!`,
      );
      mutateSsot();
      setAnchoredMenu(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update party status');
    }
  };

  // Modals state
  const [previewParty, setPreviewParty] = useState<any>(null);
  const [editParty, setEditParty] = useState<any>(null);
  const [assignExecParty, setAssignExecParty] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());

  const effectiveLocation = isBranchUser && userBranch ? userBranch : locationFilter;

  // Data fetching: SSOT Registry from backend & live announcements
  const ssotUrl = isBranchUser && userBranch
    ? `/parties/ssot-registry?branchCode=${encodeURIComponent(userBranch)}`
    : '/parties/ssot-registry';

  const { data: ssotData, mutate: mutateSsot, isLoading } = useSWR(ssotUrl, fetcher);
  const { data: branchesData } = useSWR('/branches', fetcher);
  const { data: announcementsData } = useSWR('/notifications/announcements', fetcher, { revalidateOnFocus: true });

  const activeAnnouncement = useMemo(() => {
    if (!Array.isArray(announcementsData) || announcementsData.length === 0) return null;
    const filtered = announcementsData.filter((a: any) => a.isActive && !dismissedAnnouncementIds.has(a.id));
    return filtered.length > 0 ? filtered[0] : null;
  }, [announcementsData, dismissedAnnouncementIds]);

  const rawList: any[] = useMemo(() => {
    const list = Array.isArray(ssotData) ? ssotData : Array.isArray(ssotData?.data) ? ssotData.data : [];
    return list.filter((p: any) => {
      const code = String(p.code || p.consPartyCode || '').trim();
      const name = String(p.name || p.consPartyName || '').trim();
      const type = String(p.type || p.partyType || '').toLowerCase();
      if (!code || code === '-' || code === 'N/A' || code === 'NA' || code.startsWith('-')) return false;
      if (code.toUpperCase().startsWith('CONSPARTY-') || code.startsWith('raw-party-') || name.toUpperCase().startsWith('CONSPARTY-')) return false;
      return true;
    });
  }, [ssotData]);

  // Extract distinct dropdown values dynamically from actual party_master data & branches master
  const branchesList = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(branchesData)) {
      branchesData.forEach((b: any) => {
        if (b.code) set.add(b.code);
      });
    }
    rawList.forEach((p: any) => {
      const loc = p.baseLoc || p.primaryBranchCode;
      if (loc && loc !== '-') set.add(loc);
    });
    return ['All Branches', ...Array.from(set).sort()];
  }, [branchesData, rawList]);

  const executivesList = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach(p => {
      if (p.salesExecutive && p.salesExecutive !== '-') set.add(p.salesExecutive);
    });
    return ['All Executives', ...Array.from(set).sort()];
  }, [rawList]);

  const partyTypesList = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach(p => {
      let type = String(p.type || p.partyType || '').trim();
      const shortType = formatShortPartyType(type);
      if (shortType && shortType !== '-') {
        set.add(shortType);
      }
    });
    return ['All Types', ...Array.from(set).sort()];
  }, [rawList]);

  // Filtered list
  const filteredList = useMemo(() => {
    return rawList.filter(p => {
      const pLoc = p.baseLoc || p.primaryBranchCode || '';
      const pExec = p.salesExecutive || '';
      const pType = p.type || p.partyType || '';
      const pCode = (p.code || p.consPartyCode || '').toLowerCase();
      const pName = (p.name || p.consPartyName || '').toLowerCase();
      const pPhone = (p.phone || '').toLowerCase();
      const pGst = (p.gstIn || p.gstin || '').toLowerCase();

      if (effectiveLocation !== 'All Branches' && pLoc.toUpperCase() !== effectiveLocation.toUpperCase()) return false;
      if (executiveFilter !== 'All Executives' && pExec !== executiveFilter) return false;
      if (partyTypeFilter !== 'All Types' && formatShortPartyType(pType) !== partyTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = pCode.includes(q) || pName.includes(q) || pPhone.includes(q) || pGst.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rawList, effectiveLocation, executiveFilter, partyTypeFilter, searchQuery]);

  // Sorting
  const [sortField, setSortField] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sorted & Filtered list
  const sortedList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'location':
          valA = (a.baseLoc || a.primaryBranchCode || '').toLowerCase();
          valB = (b.baseLoc || b.primaryBranchCode || '').toLowerCase();
          break;
        case 'code':
          valA = (a.code || a.consPartyCode || '').toLowerCase();
          valB = (b.code || b.consPartyCode || '').toLowerCase();
          break;
        case 'originalCode':
          valA = (a.originalCode || a.code || a.consPartyCode || '').toLowerCase();
          valB = (b.originalCode || b.code || b.consPartyCode || '').toLowerCase();
          break;
        case 'name':
          valA = (a.name || a.consPartyName || '').toLowerCase();
          valB = (b.name || b.consPartyName || '').toLowerCase();
          break;
        case 'type':
          valA = (a.type || a.partyType || '').toLowerCase();
          valB = (b.type || b.partyType || '').toLowerCase();
          break;
        case 'executive':
          valA = (a.salesExecutive || '').toLowerCase();
          valB = (b.salesExecutive || '').toLowerCase();
          break;
        case 'rule':
          valA = (a.incentiveRule || a.incentiveType || '').toLowerCase();
          valB = (b.incentiveRule || b.incentiveType || '').toLowerCase();
          break;
        case 'phone':
          valA = (a.phone || '').toLowerCase();
          valB = (b.phone || '').toLowerCase();
          break;
        case 'accHolder':
          valA = (a.accountHolder || '').toLowerCase();
          valB = (b.accountHolder || '').toLowerCase();
          break;
        case 'bankAcc':
          valA = (a.accountNumber || '').toLowerCase();
          valB = (b.accountNumber || '').toLowerCase();
          break;
        case 'ifsc':
          valA = (a.ifscCode || '').toLowerCase();
          valB = (b.ifscCode || '').toLowerCase();
          break;
        case 'bankBranch':
          valA = (a.bankBranch || '').toLowerCase();
          valB = (b.bankBranch || '').toLowerCase();
          break;
        case 'bankName':
          valA = (a.bankName || '').toLowerCase();
          valB = (b.bankName || '').toLowerCase();
          break;
        case 'pan':
          valA = (a.pan || '').toLowerCase();
          valB = (b.pan || '').toLowerCase();
          break;
        case 'status':
          valA = a.isActive !== false ? 'active' : 'disabled';
          valB = b.isActive !== false ? 'active' : 'disabled';
          break;
        default:
          valA = (a.code || '').toLowerCase();
          valB = (b.code || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredList, sortField, sortOrder]);

  // Displayed records according to currentPage & pageSize
  const displayedList = useMemo(() => {
    if (pageSize === 0) return sortedList; // All
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  // Metrics computation for Stat Cards
  const stats = useMemo(() => {
    const listToCount = effectiveLocation !== 'All Branches' ? filteredList : rawList;
    const total = listToCount.length;
    const active = listToCount.filter(p => p.status === 'Active' || p.isActive !== false).length;
    const fixedRate = listToCount.filter(p => (p.incentiveRule || p.incentiveType || '').toLowerCase().includes('fixed')).length;
    const slabBased = listToCount.filter(p => (p.incentiveRule || p.incentiveType || '').toLowerCase().includes('slab')).length;
    const hasBank = listToCount.filter(p => p.accountNumber && p.accountNumber !== '-' && p.accountNumber !== 'Pending Setup').length;
    const pendingBank = total - hasBank;

    return { total, active, fixedRate, slabBased, hasBank, pendingBank, reviewQueue: 0 };
  }, [rawList, filteredList, effectiveLocation]);

  // Sync Party Master from raw sales
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/parties/party-master/sync');
      toast.success(`Sync complete: ${res.data?.added || 0} added, ${res.data?.updated || 0} updated!`);
      mutateSsot();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export to Excel with Rich Corporate Formatting & Original Code details
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Generating rich formatted Excel export...');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TheSSBuddy Portal';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Party Master Registry', {
        views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
      });

      // ── 1. TITLE BANNER (Row 1) ──
      worksheet.mergeCells('A1:R1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'THE SS BUDDY — MARUTI SUZUKI DEALER & PARTY MASTER REGISTRY';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF053D3A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // ── 2. METADATA STRIP (Row 2) ──
      worksheet.mergeCells('A2:R2');
      const metaCell = worksheet.getCell('A2');
      const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      metaCell.value = `Export As-Of: ${nowStr}  |  Total Parties: ${filteredList.length.toLocaleString('en-IN')}  |  Location: ${locationFilter}  |  Party Type: ${partyTypeFilter}  |  Executive: ${executiveFilter}`;
      metaCell.font = { name: 'Segoe UI', size: 9.5, italic: true, bold: true, color: { argb: 'FF053D3A' } };
      metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4F1' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 22;

      // ── 3. EMPTY SEPARATOR (Row 3) ──
      worksheet.getRow(3).height = 6;

      // ── 4. TABLE HEADERS (Row 4) ──
      const headers = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Original / Parent Code', key: 'originalCode', width: 22 },
        { header: 'Party Code', key: 'code', width: 18 },
        { header: 'Party Name', key: 'name', width: 34 },
        { header: 'Party Type', key: 'partyType', width: 22 },
        { header: 'Assigned Branch', key: 'branch', width: 16 },
        { header: 'Sales Executive', key: 'salesExecutive', width: 22 },
        { header: 'Mobile Number', key: 'phone', width: 16 },
        { header: 'PAN Number', key: 'pan', width: 16 },
        { header: 'GSTIN', key: 'gstIn', width: 18 },
        { header: 'Incentive Scheme Rule', key: 'incentiveRule', width: 20 },
        { header: 'Bank Name', key: 'bankName', width: 24 },
        { header: 'Bank Branch', key: 'branchName', width: 20 },
        { header: 'Account Number', key: 'accountNumber', width: 20 },
        { header: 'IFSC Code', key: 'ifscCode', width: 15 },
        { header: 'Account Holder', key: 'accountHolder', width: 26 },
        { header: 'Total Sales Turnover (₹)', key: 'totalSales', width: 24 },
        { header: 'Account Status', key: 'status', width: 15 },
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.values = headers.map(h => h.header);
      headerRow.height = 28;
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF053D3A' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      const thinBorder: any = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      headerRow.eachCell((cell) => {
        cell.border = thinBorder;
      });

      // ── 5. DATA ROWS ──
      filteredList.forEach((p, idx) => {
        const code = p.code || p.consPartyCode || '-';
        const origCode = p.originalCode && p.originalCode !== '-' ? p.originalCode : code;
        const totalSalesNum = typeof p.totalSales === 'number' ? p.totalSales : parseFloat(p.totalSales || '0') || 0;
        const status = p.status || (p.isActive ? 'Active' : 'Disabled');

        const row = worksheet.addRow([
          idx + 1,
          origCode,
          code,
          p.name || p.consPartyName || '-',
          p.type || p.partyType || '-',
          p.baseLoc || p.primaryBranchCode || '-',
          p.salesExecutive || '-',
          p.phone || '-',
          p.pan || '-',
          p.gstIn || p.gstin || '-',
          p.incentiveRule || p.incentiveType || 'Slab-Based',
          p.bankName || '-',
          p.branchName || p.bankBranch || '-',
          p.accountNumber || 'Pending Setup',
          p.ifscCode || '-',
          p.accountHolder || (p.bankName ? (p.name || p.consPartyName) : 'Pending Setup'),
          totalSalesNum,
          status,
        ]);

        const isEven = idx % 2 === 0;
        row.height = 21;
        row.font = { name: 'Segoe UI', size: 9.5 };

        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
          };

          // Alignment
          if ([1, 2, 3, 6, 8, 9, 10, 11, 14, 15, 18].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 17) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '₹#,##,##0.00';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          // Special highlight for mapped Original Code
          if (colNumber === 2 && origCode !== code && origCode !== '-') {
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }

          // Status Badge styling
          if (colNumber === 18) {
            const isActive = String(status).toLowerCase() === 'active';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isActive ? 'FF166534' : 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isActive ? 'FFDCFCE7' : 'FFFEE2E2' } };
          }
        });
      });

      // ── 6. SUMMARY / TOTALS ROW ──
      const lastRowNum = 4 + filteredList.length;
      const totalRow = worksheet.addRow([
        'TOTALS',
        `${filteredList.length} Parties`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        { formula: `SUM(Q5:Q${lastRowNum})` },
        '',
      ]);

      totalRow.height = 25;
      totalRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF053D3A' } };
      totalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF053D3A' } },
          bottom: { style: 'double', color: { argb: 'FF053D3A' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 17) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##,##0.00';
        } else if (colNumber === 1 || colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });

      // Apply Column Widths
      headers.forEach((h, idx) => {
        worksheet.getColumn(idx + 1).width = h.width;
      });

      // Write buffer and download in browser
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TheSSBuddy_Party_Master_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Rich Excel Export generated for ${filteredList.length.toLocaleString('en-IN')} parties!`, { id: toastId, icon: '📊' });
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error('Export failed: ' + (err?.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setLocationFilter('All Branches');
    setExecutiveFilter('All Executives');
    setPartyTypeFilter('All Types');
    setSearchQuery('');
    setPageSize(100);
    toast.success('Filters reset');
  };

  // Select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(displayedList.map((p, idx) => String(p.id || p.code || idx)));
      setSelectedRows(allIds);
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleRowSelect = (id: string) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  return (
    <AppShell title="Party Master" breadcrumb="Dealer Incentive Management">
      {/* Modals */}
      {previewParty && <QuickPreviewModal party={previewParty} onClose={() => setPreviewParty(null)} />}
      {editParty && (
        <EditPartyModal
          party={editParty}
          onClose={() => setEditParty(null)}
          onSuccess={() => mutateSsot()}
          isSuperAdmin={isSuperAdmin}
          branchesList={branchesList.filter(b => b !== 'All Branches')}
        />
      )}
      {assignExecParty && <AssignExecutiveModal party={assignExecParty} onClose={() => setAssignExecParty(null)} onSuccess={() => mutateSsot()} />}

      <div className="space-y-4 max-w-full">
        {/* 1. TOP ANNOUNCEMENT BANNER — Only rendered when an actual announcement is published */}
        {activeAnnouncement && (
          <div className="bg-[#121f3d] text-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-blue-900/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/90 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                <Shield size={13} className="text-indigo-200" />
                {activeAnnouncement.type || 'ANNOUNCEMENT'}
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{activeAnnouncement.title}</span>
              </div>
              {activeAnnouncement.message && (
                <span className="text-xs text-blue-100 font-normal hidden md:inline">
                  — {activeAnnouncement.message}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeAnnouncement.link && (
                <a
                  href={activeAnnouncement.link}
                  className="text-[11px] text-blue-300 hover:text-white underline font-medium"
                >
                  View Details
                </a>
              )}
              <button
                onClick={() => setDismissedAnnouncementIds(prev => new Set(prev).add(activeAnnouncement.id))}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 2. SUB-STATUS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-1 text-slate-600">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">⏱ Last Sync:</span>
              <span className="font-semibold text-slate-800">Just now</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">🏢 Active Records:</span>
              <span className="font-bold text-slate-900">{stats.active.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">📋 Review Queue:</span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                {stats.reviewQueue} Pending
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              System Live
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px]">
              <Shield size={11} className="text-slate-500" />
              Master Admin
            </span>
          </div>
        </div>

        {/* 3. STANDARDIZED METRIC STAT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <StatCard
            title="Total Parties"
            value={isLoading ? '...' : stats.total.toLocaleString()}
            subtitle="Registered master"
            icon={<Building2 size={16} />}
          />
          <StatCard
            title="Active Parties"
            value={isLoading ? '...' : stats.active.toLocaleString()}
            subtitle="Operational & invoiced"
            icon={<CheckCircle2 size={16} />}
            trend={{ value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100}% Active`, isPositive: true }}
          />
          <StatCard
            title="Fixed Rate"
            value={isLoading ? '...' : stats.fixedRate.toLocaleString()}
            subtitle="Fixed commission %"
            icon={<Percent size={16} />}
          />
          <StatCard
            title="Slab Based"
            value={isLoading ? '...' : stats.slabBased.toLocaleString()}
            subtitle="Tiered incentive model"
            icon={<Sliders size={16} />}
          />
          <StatCard
            title="Bank Setup"
            value={`${stats.hasBank} / ${stats.total.toLocaleString()}`}
            subtitle={`${stats.pendingBank.toLocaleString()} pending`}
            icon={<CreditCard size={16} />}
          />
          <StatCard
            title="Review Queue"
            value={stats.reviewQueue}
            subtitle="Location mismatch"
            icon={<Filter size={16} />}
          />
        </div>

        {/* 4. FILTER TOOLBAR — CLEAN BRANDED CONTAINER */}
        <div
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-wrap items-center gap-3 text-slate-800"
        >
          {/* Location Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-[#053D3A]" /> LOCATION
            </label>
            {isBranchUser && userBranch ? (
              <div className="w-full px-3 py-2 bg-amber-400 text-slate-950 border border-amber-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-2xs">
                <Lock size={12} className="text-slate-950" />
                <span>Branch: {userBranch}</span>
              </div>
            ) : (
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A] shadow-2xs"
              >
                {branchesList.map((b) => (
                  <option key={b} value={b} className="bg-white text-slate-900 font-bold">
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Executive Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserCheck size={12} className="text-[#053D3A]" /> EXECUTIVE
            </label>
            <select
              value={executiveFilter}
              onChange={(e) => setExecutiveFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A] shadow-2xs"
            >
              {executivesList.map((ex) => (
                <option key={ex} value={ex} className="bg-white text-slate-900 font-bold">
                  {ex}
                </option>
              ))}
            </select>
          </div>

          {/* Party Type Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Layers size={12} className="text-[#053D3A]" /> PARTY TYPE
            </label>
            <select
              value={partyTypeFilter}
              onChange={(e) => setPartyTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A] shadow-2xs"
            >
              {partyTypesList.map((c) => (
                <option key={c} value={c} className="bg-white text-slate-900 font-bold">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="flex-[1.5] min-w-[220px]">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Search size={12} className="text-[#053D3A]" /> SEARCH
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Code, Name, Mobile, GST..."
                className="input-enterprise w-full placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Show count dropdown */}
          <div className="w-24">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">SHOW</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input-enterprise w-full cursor-pointer"
            >
              <option value={25} className="bg-white text-slate-900 font-bold">25</option>
              <option value={50} className="bg-white text-slate-900 font-bold">50</option>
              <option value={100} className="bg-white text-slate-900 font-bold">100</option>
              <option value={0} className="bg-white text-slate-900 font-bold">All</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2 pt-4 sm:pt-0">
            {/* Reset Filters */}
            <Button
              variant="secondary"
              size="md"
              onClick={handleResetFilters}
              title="Reset Filters"
              icon={<RotateCcw size={14} className="text-slate-500" />}
            />

            {/* Sync from raw_sales (SuperAdmin Only) */}
            {isSuperAdmin && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleSync}
                disabled={isSyncing}
                isLoading={isSyncing}
                title="Sync Party Master from Sales"
                icon={<RefreshCw size={14} className="text-emerald-600" />}
              />
            )}

            {/* Export Excel (Rich Formatted) */}
            <Button
              variant="secondary"
              size="md"
              onClick={handleExport}
              disabled={isExporting}
              isLoading={isExporting}
              title="Export filtered records with rich formatting to Excel"
              icon={<Download size={14} className="text-slate-600" />}
            >
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* + Party button (SuperAdmin Only) */}
            {isSuperAdmin && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setEditParty({ code: '', name: '', type: 'INDEPENDENT WORKSHOP', incentiveRule: 'Slab-Based' })}
                icon={<Plus size={14} />}
              >
                Party
              </Button>
            )}
          </div>
        </div>

        {/* 5. DATA TABLE WITH HIGH VISIBILITY ENTERPRISE GRID */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 relative overflow-hidden">
          <div className="w-full max-h-[72vh] overflow-y-auto pb-20">
            <table className="w-full text-[10px] text-center align-middle border-collapse">
              {/* Dark Forest Green Sticky Header */}
              <thead className="sticky top-0 z-20 bg-[#053D3A] text-white select-none shadow-sm">
                <tr className="border-b border-slate-800">
                  <th className="px-1.5 py-2.5 text-center align-middle border-r border-slate-700/60 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={displayedList.length > 0 && selectedRows.size === displayedList.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-600 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </th>
                  <th className="px-1 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black text-slate-300 uppercase whitespace-nowrap">#</th>
                  
                  <th onClick={() => handleSort('location')} title="Sort by Location" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'location' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>LOC</span>
                      <ArrowUpDown size={9} className={sortField === 'location' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('code')} title="Sort by Party Code" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'code' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>CODE</span>
                      <ArrowUpDown size={9} className={sortField === 'code' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('originalCode')} title="Sort by Original Code" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'originalCode' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>ORIG CODE</span>
                      <ArrowUpDown size={9} className={sortField === 'originalCode' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('name')} title="Sort by Party Name" className={`px-2.5 py-2.5 text-left align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'name' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center gap-0.5">
                      <span>PARTY NAME</span>
                      <ArrowUpDown size={9} className={sortField === 'name' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('type')} title="Sort by Type" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'type' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>TYPE</span>
                      <ArrowUpDown size={9} className={sortField === 'type' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('executive')} title="Sort by Executive" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'executive' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>EXEC</span>
                      <ArrowUpDown size={9} className={sortField === 'executive' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('rule')} title="Sort by Incentive Type" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'rule' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>RULE</span>
                      <ArrowUpDown size={9} className={sortField === 'rule' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('phone')} title="Sort by Mobile" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'phone' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>MOBILE</span>
                      <ArrowUpDown size={9} className={sortField === 'phone' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('accHolder')} title="Sort by Account Holder" className={`px-2.5 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'accHolder' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>ACC HOLDER</span>
                      <ArrowUpDown size={9} className={sortField === 'accHolder' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('bankAcc')} title="Sort by Account No" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'bankAcc' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>ACC NO</span>
                      <ArrowUpDown size={9} className={sortField === 'bankAcc' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('ifsc')} title="Sort by IFSC Code" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'ifsc' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>IFSC</span>
                      <ArrowUpDown size={9} className={sortField === 'ifsc' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('bankBranch')} title="Sort by Branch" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'bankBranch' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>BRANCH</span>
                      <ArrowUpDown size={9} className={sortField === 'bankBranch' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('pan')} title="Sort by PAN No" className={`px-2 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'pan' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>PAN</span>
                      <ArrowUpDown size={9} className={sortField === 'pan' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th onClick={() => handleSort('status')} title="Sort by Status" className={`px-2.5 py-2.5 text-center align-middle border-r border-slate-700/60 text-[9px] font-black uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap min-w-[75px] ${sortField === 'status' ? 'text-amber-300' : 'text-slate-200'}`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <span>STATUS</span>
                      <ArrowUpDown size={9} className={sortField === 'status' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                    </div>
                  </th>

                  <th className="px-3 py-2.5 text-center align-middle text-[9px] font-black text-slate-300 uppercase whitespace-nowrap min-w-[85px]">ACT</th>
                </tr>
              </thead>

              {/* Table Body with High-Contrast Grid Boundaries */}
              <tbody className="bg-white font-medium text-slate-800 align-middle">
                {isLoading ? (
                  <tr>
                    <td colSpan={18} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-blue-500" />
                        <span className="font-bold">Loading Party Master Registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedList.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="py-12 text-center align-middle text-slate-400 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 size={32} className="text-slate-200" />
                        <span className="font-bold text-slate-600">No parties found matching the current filters.</span>
                        <button
                          onClick={handleResetFilters}
                          className="mt-1 text-xs text-blue-600 hover:underline font-bold"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedList.map((p, index) => {
                    const rowId = String(p.id || p.code || index);
                    const isSelected = selectedRows.has(rowId);
                    const code = p.code || p.consPartyCode || '-';
                    const origCode = p.originalCode && p.originalCode !== '-' ? p.originalCode : code;
                    const name = p.name || p.consPartyName || '-';
                    const rawCategory = p.type || p.partyType || 'INDEPENDENT WORKSHOP';
                    const category = formatShortPartyType(rawCategory);
                    const rule = p.incentiveRule || p.incentiveType || 'Slab Based';
                    const phone = p.phone && p.phone !== '-' ? p.phone : '-';
                    const pan = p.pan && p.pan !== '-' ? p.pan : '-';
                    const executive = p.salesExecutive && p.salesExecutive !== '-' ? p.salesExecutive : '-';
                    const accHolder = p.accountHolder && p.accountHolder !== '-' ? p.accountHolder : '-';
                    const bankAcc = p.accountNumber && p.accountNumber !== '-' ? p.accountNumber : 'Pending Setup';
                    const ifsc = p.ifscCode && p.ifscCode !== '-' ? p.ifscCode : '-';
                    const bankBranch = p.bankBranch && p.bankBranch !== '-' ? p.bankBranch : '-';
                    const bankName = p.bankName && p.bankName !== '-' ? p.bankName : '-';
                    const location = p.baseLoc || p.primaryBranchCode || 'ALWAR-SPR';
                    const isFixed = rule.toLowerCase().includes('fixed');

                    return (
                      <tr
                        key={rowId}
                        className={`hover:bg-blue-50/70 transition-colors border-b border-slate-200/80 ${
                          isSelected ? 'bg-blue-50/90 border-l-4 border-l-blue-600' : index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-1.5 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelect(rowId)}
                            className="rounded text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>

                        {/* Index */}
                        <td className="px-1 py-2 text-center align-middle border-r border-slate-200/80 font-medium text-slate-500 text-[10px] whitespace-nowrap">
                          {index + 1}
                        </td>

                        {/* Location */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 text-[10px] whitespace-nowrap">
                          <span className="inline-flex items-center justify-center font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[9px] shadow-2xs" title={location}>
                            {location}
                          </span>
                        </td>

                        {/* Party Code badge */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50/90 border border-blue-200/90 text-blue-700 font-mono text-[9.5px] font-bold shadow-2xs" title={code}>
                            {code}
                          </span>
                        </td>
                        
                        {/* Original Code badge */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50/90 border border-amber-200/90 text-amber-900 font-mono text-[9.5px] font-extrabold shadow-2xs" title={`Original Code: ${origCode}`}>
                            {origCode}
                          </span>
                        </td>

                        {/* Party Name */}
                        <td className="px-2.5 py-2 text-left align-middle border-r border-slate-200/80 font-semibold text-slate-900 text-[10px] uppercase tracking-tight whitespace-nowrap hover:text-blue-600 transition-colors" title={name}>
                          {name}
                        </td>

                        {/* Type badge */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[8.5px] border shadow-2xs ${getTypeBadgeStyle(category)}`} title={`Party Type: ${rawCategory}`}>
                            {category}
                          </span>
                        </td>

                        {/* Executive */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-[10px] whitespace-nowrap" title={executive}>
                          {executive}
                        </td>

                        {/* Incentive Type pill */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          {isFixed ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-purple-50 border border-purple-200 text-purple-700 shadow-2xs">
                              <Percent size={8} />
                              {rule}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs">
                              <Sliders size={8} />
                              Slab
                            </span>
                          )}
                        </td>

                        {/* Mobile */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-slate-700 text-[10px] whitespace-nowrap" title={phone}>
                          {phone}
                        </td>

                        {/* Account Holder */}
                        <td className="px-2.5 py-2 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-[10px] whitespace-nowrap" title={accHolder}>
                          {accHolder}
                        </td>

                        {/* Bank Account */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                          {bankAcc === 'Pending Setup' ? (
                            <button
                              type="button"
                              onClick={() => setEditParty(p)}
                              title="Click to Add Bank Details"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 transition cursor-pointer shadow-2xs"
                            >
                              <AlertTriangle size={9} className="text-amber-600 shrink-0" />
                              <span>Pending</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditParty(p)}
                              title="Click to Edit Bank Details"
                              className="font-mono text-slate-800 hover:text-blue-600 font-semibold text-[10px] hover:underline"
                            >
                              <span>{bankAcc}</span>
                            </button>
                          )}
                        </td>

                        {/* IFSC Code */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-[10px] text-slate-700 whitespace-nowrap" title={ifsc}>
                          {ifsc}
                        </td>

                        {/* Bank Branch */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-[10px] whitespace-nowrap" title={bankBranch}>
                          {bankBranch}
                        </td>

                        {/* PAN NO */}
                        <td className="px-2 py-2 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-[10px] whitespace-nowrap">
                          {pan !== '-' ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 font-mono text-[9px] font-bold shadow-2xs" title={pan}>
                              {pan}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-2.5 py-2 text-center align-middle border-r border-slate-200/80 whitespace-nowrap min-w-[75px]">
                          <Badge variant={p.isActive !== false ? 'success' : 'danger'} dot size="sm">
                            {p.isActive !== false ? 'Active' : 'Disabled'}
                          </Badge>
                        </td>

                        {/* Actions Menu */}
                        <td className="px-3 py-2 text-center align-middle whitespace-nowrap min-w-[85px]">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditParty(p)}
                              title={isSuperAdmin ? "Edit Party Master" : "Set Bank & KYC Details"}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition font-bold cursor-pointer"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewParty(p)}
                              title="Quick Preview"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenActionMenu(e, p)}
                              title="Party Action Menu"
                              className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 transition cursor-pointer"
                            >
                              <MoreVertical size={14} />
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
            totalItems={filteredList.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[25, 50, 100, 200]}
            itemName="parties"
          />
        </div>
      </div>

      {/* Anchored Contextual Popover Dropdown Menu */}
      {anchoredMenu && (
        <AnchoredActionDropdownMenu
          party={anchoredMenu.party}
          anchor={anchoredMenu.anchor}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setAnchoredMenu(null)}
          onEditBank={() => {
            setEditParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onEditMaster={() => {
            setEditParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onPreview={() => {
            setPreviewParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onAssignExec={() => {
            setAssignExecParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onToggleStatus={() => handleTogglePartyStatus(anchoredMenu.party)}
        />
      )}
    </AppShell>
  );
}
