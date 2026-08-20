'use client';
import React, { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Zap, Plus, X, Trash2, Edit3, Calendar, Layers, Check,
  AlertCircle, ChevronRight, ChevronDown, BarChart3, Calculator, Sparkles,
  ArrowRight, ShieldCheck, Tag, Info, ArrowUpRight, CheckCircle2,
  Copy, Eye, Sliders, DollarSign, Award, ArrowDownRight, RefreshCw
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

interface SlabRow {
  ruleName: string;
  minSalesValue: string | number;
  maxSalesValue: string | number;
  fixedAmt: string | number;
  percent: string | number;
}

// ─── EXACT PIXEL-MATCHED "CREATE SCHEME & SLABS" MODAL ─────────────────────────
function CreateSchemeModal({
  scheme,
  onClose,
  onSuccess,
}: {
  scheme?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [schemeName, setSchemeName] = useState(scheme?.name || '');
  const [effectiveFrom, setEffectiveFrom] = useState(
    scheme?.effectiveFrom ? new Date(scheme.effectiveFrom).toISOString().split('T')[0] : ''
  );
  const [effectiveTo, setEffectiveTo] = useState(
    scheme?.effectiveTo ? new Date(scheme.effectiveTo).toISOString().split('T')[0] : ''
  );

  const initialSlabs: SlabRow[] = useMemo(() => {
    if (scheme?.details && scheme.details.length > 0) {
      return scheme.details.map((d: any, idx: number) => ({
        ruleName: d.partCategoryCode || `Slab ${idx + 1}`,
        minSalesValue: d.slabFrom ?? 0,
        maxSalesValue: d.slabTo ?? (idx === scheme.details.length - 1 ? 9999999 : 29999),
        fixedAmt: d.minAmount ?? 0,
        percent: d.incentiveRate ?? '',
      }));
    }
    return [
      { ruleName: 'Slab 1', minSalesValue: 0, maxSalesValue: 29999, fixedAmt: 0, percent: '' },
      { ruleName: 'Slab 2', minSalesValue: 30000, maxSalesValue: 99999, fixedAmt: 0, percent: '' },
    ];
  }, [scheme]);

  const [slabs, setSlabs] = useState<SlabRow[]>(initialSlabs);
  const [loading, setLoading] = useState(false);

  const addSlabRow = () => {
    const nextIdx = slabs.length + 1;
    const lastSlab = slabs[slabs.length - 1];
    const lastMax = Number(lastSlab?.maxSalesValue) || 0;
    setSlabs([
      ...slabs,
      {
        ruleName: `Slab ${nextIdx}`,
        minSalesValue: lastMax > 0 ? lastMax + 1 : 0,
        maxSalesValue: lastMax > 0 ? lastMax + 50000 : 99999,
        fixedAmt: 0,
        percent: '',
      },
    ]);
  };

  const updateSlab = (index: number, field: keyof SlabRow, value: any) => {
    const next = [...slabs];
    next[index] = { ...next[index], [field]: value };
    setSlabs(next);
  };

  const removeSlabRow = (index: number) => {
    if (slabs.length <= 1) {
      toast.error('At least one slab rule is required');
      return;
    }
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemeName.trim()) {
      toast.error('Please enter a scheme name');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: schemeName.trim(),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : new Date().toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
        isActive: true,
        details: slabs.map((s, idx) => ({
          partCategoryCode: s.ruleName.trim() || `Slab ${idx + 1}`,
          slabFrom: Number(s.minSalesValue) || 0,
          slabTo: s.maxSalesValue !== '' && s.maxSalesValue !== null ? Number(s.maxSalesValue) : null,
          minAmount: Number(s.fixedAmt) || 0,
          incentiveRate: Number(s.percent) || 0,
          incentiveType: Number(s.fixedAmt) > 0 && Number(s.percent) === 0 ? 'FLAT' : 'PERCENTAGE',
          sortOrder: idx,
        })),
      };

      if (scheme?.id) {
        await api.put(`/incentive-schemes/${scheme.id}`, payload);
        toast.success(`Scheme "${schemeName}" updated successfully!`);
      } else {
        await api.post('/incentive-schemes', payload);
        toast.success(`Scheme "${schemeName}" created successfully!`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save incentive scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Dark Navy Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0a152d] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded flex items-center justify-center text-amber-400">
              <Zap size={18} className="fill-amber-400 text-amber-400" />
            </div>
            <h2 className="font-bold text-base tracking-wide text-white">
              {scheme?.id ? 'Edit Scheme & Slabs' : 'Create Scheme & Slabs'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          {/* Scheme Name */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase mb-1.5 text-[11px] tracking-tight">
              Scheme Name
            </label>
            <input
              type="text"
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
              placeholder="e.g., Volume Target Scheme"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              required
            />
          </div>

          {/* Two-Column Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1.5 text-[11px] tracking-tight">
                Effective From
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase mb-1.5 text-[11px] tracking-tight">
                Effective To <span className="text-slate-400 normal-case font-normal text-[11px]">(Optional - leaves scheme Ongoing)</span>
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium bg-white"
              />
            </div>
          </div>

          {/* Slabs Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">
                  Slabs & Threshold Calculations
                </h3>
              </div>
              <button
                type="button"
                onClick={addSlabRow}
                className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 transition"
              >
                + Add Slab Row
              </button>
            </div>

            {/* Slabs Table Grid */}
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-[#001744] text-white">
                  <tr>
                    <th className="px-3 py-2.5 font-extrabold uppercase text-[10px] tracking-wider text-left min-w-[140px]">
                      RULE NAME
                    </th>
                    <th className="px-3 py-2.5 font-extrabold uppercase text-[10px] tracking-wider text-center min-w-[120px]">
                      MIN SALES VALUE (₹)
                    </th>
                    <th className="px-3 py-2.5 font-extrabold uppercase text-[10px] tracking-wider text-center min-w-[120px]">
                      MAX SALES VALUE (₹)
                    </th>
                    <th className="px-3 py-2.5 font-extrabold uppercase text-[10px] tracking-wider text-center min-w-[110px]">
                      FIXED AMT (₹)
                    </th>
                    <th className="px-3 py-2.5 font-extrabold uppercase text-[10px] tracking-wider text-center min-w-[110px]">
                      PERCENT (%)
                    </th>
                    <th className="px-2 py-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {slabs.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={s.ruleName}
                          onChange={(e) => updateSlab(idx, 'ruleName', e.target.value)}
                          placeholder="e.g. Slab 1"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-700 text-xs font-semibold focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          value={s.minSalesValue}
                          onChange={(e) => updateSlab(idx, 'minSalesValue', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs font-mono text-center focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          value={s.maxSalesValue}
                          onChange={(e) => updateSlab(idx, 'maxSalesValue', e.target.value)}
                          placeholder="29999"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs font-mono text-center focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          value={s.fixedAmt}
                          onChange={(e) => updateSlab(idx, 'fixedAmt', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs font-mono text-center focus:outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={s.percent}
                          onChange={(e) => updateSlab(idx, 'percent', e.target.value)}
                          placeholder="%"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-xs font-mono text-center focus:outline-none focus:border-blue-500 font-bold"
                        />
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeSlabRow(idx)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove slab"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-60 text-xs"
            >
              <Check size={14} />
              <span>{loading ? 'Saving...' : 'Save Scheme'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ULTRA-PREMIUM SYSTEMATIC SCHEME CARD WITH PAYOUT SIMULATOR ────────────────
function UltraSchemeCard({
  scheme,
  onEdit,
  onDelete,
}: {
  scheme: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [calcInput, setCalcInput] = useState<string>('85000');
  const slabs: any[] = useMemo(() => scheme.details || [], [scheme.details]);

  const maxRate = useMemo(() => {
    return Math.max(...slabs.map((s) => Number(s.incentiveRate) || 0), 0);
  }, [slabs]);

  // Live Payout Simulation calculation
  const simulation = useMemo(() => {
    const amount = parseFloat(calcInput) || 0;
    if (amount <= 0 || slabs.length === 0) return null;

    let matchedSlab: any = null;
    let slabIdx = -1;

    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      const from = Number(s.slabFrom) || 0;
      const to = s.slabTo !== null && s.slabTo !== undefined ? Number(s.slabTo) : Infinity;

      if (amount >= from && amount <= to) {
        matchedSlab = s;
        slabIdx = i;
        break;
      }
    }

    if (!matchedSlab) {
      // Fallback to highest slab if above max
      matchedSlab = slabs[slabs.length - 1];
      slabIdx = slabs.length - 1;
    }

    const rate = Number(matchedSlab.incentiveRate) || 0;
    const fixed = Number(matchedSlab.minAmount) || 0;
    const payout = (amount * rate) / 100 + fixed;

    return {
      amount,
      slabName: matchedSlab.partCategoryCode || `Slab ${slabIdx + 1}`,
      slabIdx,
      rate,
      fixed,
      payout,
    };
  }, [calcInput, slabs]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden hover:shadow-xl transition-all duration-300 relative group">
      {/* Top Blue Glowing Indicator */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"></div>

      {/* 1. Executive Scheme Header */}
      <div className="p-6 bg-gradient-to-b from-slate-50/70 to-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Side: Scheme Identity */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Zap size={24} className="fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight font-sans">
                {scheme.name}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                {slabs.length} Slabs Configured
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1.5 shadow-sm ${
                  scheme.isActive
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                {scheme.isActive ? 'Active Scheme' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-1.5 flex-wrap">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700 font-semibold border border-slate-200">
                CODE: {scheme.code}
              </span>
              <span>•</span>
              <span className="text-slate-600 font-sans font-medium">
                Max Qualification Rate: <strong className="text-blue-700 font-bold font-mono">{maxRate}%</strong>
              </span>
              <span>•</span>
              <span className="text-slate-600 font-sans font-medium">
                Target Category: <strong className="text-slate-800 font-semibold font-mono">ALL</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Timeline & Action Controls */}
        <div className="flex items-center gap-3 flex-wrap self-end lg:self-auto">
          {/* Effective Period Tag */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs text-slate-700 font-bold shadow-inner">
            <Calendar size={14} className="text-blue-600" />
            <span>
              {scheme.effectiveFrom ? new Date(scheme.effectiveFrom).toLocaleDateString('en-IN') : '01-Apr-2026'}
            </span>
            <span className="text-slate-400">➔</span>
            <span className="text-blue-700 font-extrabold">
              {scheme.effectiveTo ? new Date(scheme.effectiveTo).toLocaleDateString('en-IN') : 'Ongoing'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-xl transition shadow-sm"
              title="Edit Scheme & Slabs"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-200 rounded-xl transition shadow-sm"
              title="Deactivate Scheme"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Structured Systematic Slabs Section */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Slabs Ladder Stepper Line */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Tiered Volume & Payout Progression
              </span>
              <span className="text-xs font-bold text-blue-700 font-mono">
                {slabs.length} Progressive Milestones
              </span>
            </div>

            {/* Stepper Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {slabs.map((d: any, idx: number) => {
                const rate = Number(d.incentiveRate) || 0;
                const fixed = Number(d.minAmount) || 0;
                const isBase = rate === 0 && fixed === 0;
                const isTop = idx === slabs.length - 1 && rate > 0;

                return (
                  <div
                    key={idx}
                    className={`relative rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                      isTop
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-400 shadow-md'
                        : isBase
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-white border-blue-200 hover:border-blue-400 text-slate-800 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Step Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isTop
                              ? 'bg-white/20 text-white'
                              : isBase
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {d.partCategoryCode || `Slab ${idx + 1}`}
                        </span>
                        {rate > 0 ? (
                          <span
                            className={`text-xs font-black font-mono px-2 py-0.5 rounded shadow-sm ${
                              isTop
                                ? 'bg-white text-orange-600'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {rate}%
                          </span>
                        ) : fixed > 0 ? (
                          <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-emerald-600 text-white">
                            ₹{fixed}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">
                            Base
                          </span>
                        )}
                      </div>

                      {/* Threshold Range */}
                      <div className="mt-1">
                        <p className={`text-xs font-bold font-mono ${isTop ? 'text-white' : 'text-slate-900'}`}>
                          ₹{Number(d.slabFrom).toLocaleString('en-IN')}
                        </p>
                        <p className={`text-[10px] font-mono ${isTop ? 'text-amber-100' : 'text-slate-400'}`}>
                          to {d.slabTo ? `₹${Number(d.slabTo).toLocaleString('en-IN')}` : 'Unlimited (∞)'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-medium">
                      <span className={isTop ? 'text-amber-100' : 'text-slate-400'}>Tier Payout</span>
                      <span className={`font-mono font-bold ${isTop ? 'text-white' : 'text-blue-700'}`}>
                        {rate > 0 ? `${rate}% of Net Sales` : fixed > 0 ? `₹${fixed} Flat` : 'No Incentive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Slabs Grid & Simulator Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
            {/* Left 2 Cols: High-Contrast Detailed Table */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-300 overflow-hidden shadow-sm bg-white">
              <div className="p-3.5 px-4 table-header-navy text-white flex items-center justify-between">
                <span className="font-extrabold text-xs uppercase tracking-wider text-white">
                  Comprehensive Slabs & Payout Matrix
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  All monetary values in INR
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center align-middle border-collapse">
                  <thead className="table-header-navy select-none">
                    <tr>
                      <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase border-r border-slate-700/80">TIER / RULE</th>
                      <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase border-r border-slate-700/80">MIN SALES</th>
                      <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase border-r border-slate-700/80">MAX SALES</th>
                      <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase border-r border-slate-700/80">INCENTIVE RATE</th>
                      <th className="px-4 py-3 text-center align-middle text-[11px] font-semibold text-white uppercase">QUALIFICATION</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white font-medium text-slate-800 align-middle">
                    {slabs.map((d: any, idx: number) => {
                      const rate = Number(d.incentiveRate) || 0;
                      const fixed = Number(d.minAmount) || 0;
                      const isTop = idx === slabs.length - 1 && rate > 0;
                      const isBase = rate === 0 && fixed === 0;

                      return (
                        <tr key={idx} className={`hover:bg-blue-50/60 transition-colors border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                          <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-semibold text-slate-900">
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 font-mono font-semibold text-[10px] flex items-center justify-center border border-blue-200">
                                {idx + 1}
                              </span>
                              <span className="uppercase text-xs">{d.partCategoryCode || `Slab ${idx + 1}`}</span>
                            </div>
                          </td>

                          <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-900 text-xs">
                            {Number(d.slabFrom).toLocaleString('en-IN')}
                          </td>

                          <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono font-semibold text-slate-800 text-xs">
                            {d.slabTo ? Number(d.slabTo).toLocaleString('en-IN') : <span className="text-blue-700 font-semibold">Unlimited (∞)</span>}
                          </td>

                          <td className="px-4 py-2.5 text-center align-middle border-r border-slate-200 font-mono">
                            {rate > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-semibold text-xs shadow-xs">
                                {rate}%
                              </span>
                            ) : fixed > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-semibold text-xs shadow-xs">
                                {fixed}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-semibold">-</span>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-center align-middle">
                            {isTop ? (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                                ★ Top Tier
                              </span>
                            ) : isBase ? (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Base Tier
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Growth Tier
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 1 Col: Live Payout Simulator Card */}
            <div className="bg-gradient-to-br from-[#0c1835] via-[#10224a] to-[#122858] text-white rounded-2xl p-5 border border-blue-900/50 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={17} className="text-cyan-400" />
                  <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    Quick Payout Simulator
                  </h4>
                </div>
                <p className="text-[11px] text-blue-200/80 mb-3">
                  Enter dealer monthly retail turnover to simulate slab qualification and payout:
                </p>

                {/* Input */}
                <div className="relative mb-4">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    value={calcInput}
                    onChange={(e) => setCalcInput(e.target.value)}
                    placeholder="e.g. 85000"
                    className="w-full pl-7 pr-3 py-2 bg-slate-900/90 border border-blue-400/40 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 font-bold"
                  />
                </div>

                {/* Calculation Output Box */}
                {simulation && (
                  <div className="bg-black/30 rounded-xl p-3.5 border border-blue-500/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Qualified Slab:</span>
                      <span className="font-bold text-cyan-300 bg-blue-500/20 px-2 py-0.5 rounded font-mono">
                        {simulation.slabName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Applicable Rate:</span>
                      <span className="font-bold text-white font-mono">
                        {simulation.rate}%
                      </span>
                    </div>

                    <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between">
                      <span className="font-bold text-blue-200 uppercase text-[10px]">Total Incentive Payout:</span>
                      <span className="text-base font-black text-amber-400 font-mono">
                        ₹{Math.round(simulation.payout).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 text-[10px] text-slate-400 flex items-center gap-1">
                <Info size={11} className="text-cyan-400" />
                <span>Calculated automatically based on active scheme slabs.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN INCENTIVE SCHEMES MASTER PAGE ───────────────────────────────────────
export default function IncentiveSchemesPage() {
  const [modalScheme, setModalScheme] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, mutate, isLoading } = useSWR('/incentive-schemes', fetcher);
  const rawSchemes = data?.items ?? data?.schemes ?? data?.data ?? data;
  const schemes: any[] = useMemo(() => (Array.isArray(rawSchemes) ? rawSchemes : []), [rawSchemes]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate scheme "${name}"?`)) return;
    try {
      await api.delete(`/incentive-schemes/${id}`);
      toast.success(`Scheme "${name}" deactivated`);
      mutate();
    } catch {
      toast.error('Failed to deactivate scheme');
    }
  };

  return (
    <AppShell title="Incentive Schemes & Slabs" breadcrumb="Corporate Intelligence">
      {/* Create / Edit Modal */}
      {isModalOpen && (
        <CreateSchemeModal
          scheme={modalScheme}
          onClose={() => {
            setIsModalOpen(false);
            setModalScheme(null);
          }}
          onSuccess={() => mutate()}
        />
      )}

      <div className="space-y-6 max-w-full">
        {/* Top Executive Header Card */}
        <div className="bg-gradient-to-r from-[#0b1b38] via-[#0f244e] to-[#122244] text-white rounded-3xl p-6 shadow-xl border border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Zap size={22} className="text-amber-400 fill-amber-400" />
              <h2 className="text-lg font-black tracking-tight text-white">
                Incentive Schemes & Threshold Slabs Master
              </h2>
            </div>
            <p className="text-xs text-blue-200/80">
              Systematic configuration of multi-tiered volume thresholds, percentages, flat incentives, and qualification rules.
            </p>
          </div>

          <button
            onClick={() => {
              setModalScheme(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-2 transition shadow-lg self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Create Scheme & Slabs</span>
          </button>
        </div>

        {/* Systematic Schemes List */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-blue-600" />
              <span>Loading incentive schemes...</span>
            </div>
          ) : schemes.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm">
              <Zap size={36} className="mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-extrabold text-slate-800">No Incentive Schemes Configured</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Create a volume or tier-based incentive scheme with custom slab thresholds to automate dealer disbursements.
              </p>
              <button
                onClick={() => {
                  setModalScheme(null);
                  setIsModalOpen(true);
                }}
                className="mt-4 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-2xl text-xs hover:bg-blue-500 transition shadow-md"
              >
                + Create Scheme & Slabs
              </button>
            </div>
          ) : (
            schemes.map((scheme) => (
              <UltraSchemeCard
                key={scheme.id}
                scheme={scheme}
                onEdit={() => {
                  setModalScheme(scheme);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDelete(scheme.id, scheme.name)}
              />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
