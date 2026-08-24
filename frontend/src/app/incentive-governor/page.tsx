'use client';

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import {
  Sliders, SlidersHorizontal, Zap, ShieldCheck, Play, Lock, Unlock, Eye, CheckCircle2,
  AlertTriangle, RefreshCw, Plus, Trash2, Download, Upload, Search,
  Filter, Layers, Building2, Tag, Calendar, Calculator, Info, FileSpreadsheet,
  ArrowUpDown, Check, X, History, UserCheck, ArrowRight, BookOpen, FileCheck, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface GovernorRule {
  branch: string;
  categories: string[];
  partyTypes: string[];
}

interface IncentiveRecord {
  id?: string;
  year?: number;
  month?: number;
  originalPartyCode: string;
  partyName: string;
  baseBranch: string;
  partyType: string;
  nrs: number;
  totalDiscount: number;
  incentiveType: string;
  applicableRate: number;
  applicableSlab: string;
  grossIncentive: number;
  finalIncentive: number;
  processingMethod: string;
  validationStatus: string;
  validationErrors?: string[];
  payoutStatus?: string;
  transferredAmount?: number;
  transferDate?: string;
  accountHolder?: string;
  accountNo?: string;
  ifscCode?: string;
  utrNo?: string;
  payoutBatchId?: string;
  status: string;
}

// ─── MULTI-SELECT PERIOD DROPDOWN COMPONENT ───
const PeriodMultiSelectDropdown = ({
  availablePeriods,
  selectedPeriodKeys,
  setSelectedPeriodKeys,
  onlyWithData = false,
}: {
  availablePeriods: { m: number; y: number; label: string; hasData?: boolean }[];
  selectedPeriodKeys: string[];
  setSelectedPeriodKeys: (keys: string[]) => void;
  onlyWithData?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort ascending (oldest → newest)
  const visiblePeriods = (onlyWithData
    ? availablePeriods.filter((p) => p.hasData)
    : availablePeriods
  ).slice().sort((a, b) => a.y !== b.y ? a.y - b.y : a.m - b.m);

  const withData    = visiblePeriods.filter((p) =>  p.hasData);
  const withoutData = onlyWithData ? [] : visiblePeriods.filter((p) => !p.hasData);

  const allKeys = visiblePeriods.map((p) => `${p.m}-${p.y}`);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedPeriodKeys.includes(k));

  const selectedLabels = visiblePeriods
    .filter((p) => selectedPeriodKeys.includes(`${p.m}-${p.y}`))
    .map((p) => p.label);

  const displayText =
    selectedLabels.length === 0
      ? 'Select Periods'
      : allSelected
      ? 'All Periods'
      : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} Periods`;

  const toggleKey = (pKey: string, isChecked: boolean) => {
    if (isChecked) {
      if (selectedPeriodKeys.length > 1) {
        setSelectedPeriodKeys(selectedPeriodKeys.filter((k) => k !== pKey));
      }
    } else {
      setSelectedPeriodKeys([...selectedPeriodKeys, pKey]);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-300 hover:border-[#053D3A] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 shadow-2xs transition cursor-pointer"
      >
        <Calendar size={14} className="text-[#053D3A]" />
        <span className="max-w-[200px] truncate">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

          {/* Select All / Deselect All */}
          <div className="px-2 pt-2 pb-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  // Keep at least one selected — keep the first with data
                  const firstWithData = withData[0];
                  setSelectedPeriodKeys(firstWithData ? [`${firstWithData.m}-${firstWithData.y}`] : allKeys.slice(0, 1));
                } else {
                  setSelectedPeriodKeys(allKeys);
                }
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-[#053D3A] hover:bg-[#053D3A]/5 transition cursor-pointer"
            >
              <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              <span className="text-[10px] font-bold text-slate-400">{allKeys.length} periods</span>
            </button>
          </div>

          <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
            {/* Periods with data */}
            {withData.length > 0 && (
              <>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase px-2.5 pt-1 pb-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Has Register Data
                </div>
                {withData.map((p) => {
                  const pKey = `${p.m}-${p.y}`;
                  const isChecked = selectedPeriodKeys.includes(pKey);
                  return (
                    <label
                      key={pKey}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                        isChecked ? 'bg-[#053D3A]/5 text-[#053D3A]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleKey(pKey, isChecked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#053D3A] focus:ring-[#053D3A] cursor-pointer"
                      />
                      <span>{p.label}</span>
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    </label>
                  );
                })}
              </>
            )}

            {/* Periods without data */}
            {withoutData.length > 0 && (
              <>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase px-2.5 pt-2 pb-0.5 flex items-center gap-1.5 border-t border-slate-100 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                  No Data Yet
                </div>
                {withoutData.map((p) => {
                  const pKey = `${p.m}-${p.y}`;
                  const isChecked = selectedPeriodKeys.includes(pKey);
                  return (
                    <label
                      key={pKey}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                        isChecked ? 'bg-[#053D3A]/5 text-[#053D3A]' : 'hover:bg-slate-50 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleKey(pKey, isChecked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#053D3A] focus:ring-[#053D3A] cursor-pointer"
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function IncentiveGovernorContent() {
  const { isSuperAdmin, isBranchUser, userBranch } = useAuth();

  // Dynamic Masters State (Fetched from API / DB)
  const [availableBranches, setAvailableBranches] = useState<string[]>([
    'ALW', 'BER', 'BGI', 'BSE', 'BWI', 'CR9', 'DUS', 'F33', 'GRL', 'HDN',
    'HMR', 'HUH', 'ISN', 'JGT', 'JNU', 'JPD', 'JSK', 'KNO', 'LQU', 'NBT',
    'OR7', 'PKT', 'PPH', 'PSS', 'RQL', 'SDH', 'SGH', 'SGN', 'SJG', 'SKF',
    'SKR', 'STO', 'TNG', 'UTD', 'VBZ'
  ]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    'AA', 'AG', 'M', 'T'
  ]);
  const [availablePartyTypes, setAvailablePartyTypes] = useState<string[]>([
    'CO-DEALER', 'CO-DISTRIBUTOR', 'INDEPENDENT WORKSHOP', 'MASS', 'TRADER/RETAILER', 'WALK-IN CUSTOMER'
  ]);

  const [availablePeriods, setAvailablePeriods] = useState<{ m: number; y: number; label: string; hasData?: boolean }[]>([
    { m: 6, y: 2026, label: 'Jun 2026', hasData: true },
    { m: 5, y: 2026, label: 'May 2026', hasData: true },
  ]);

  // Fetch Dynamic Masters on Mount
  useEffect(() => {
    fetchGovernorMasters();
    fetchAvailablePeriods();
  }, []);

  const fetchAvailablePeriods = async () => {
    try {
      const res = await api.get('/incentive-governor/available-periods');
      if (res.data && res.data.length > 0) {
        setAvailablePeriods(res.data);
        // Auto-select: pick the most recent period(s) that have actual DB data
        const withData: { m: number; y: number; hasData?: boolean }[] = res.data.filter((p: { hasData?: boolean }) => p.hasData);
        if (withData.length > 0) {
          // Sort desc and take latest
          const sorted = [...withData].sort((a, b) => b.y !== a.y ? b.y - a.y : b.m - a.m);
          const latestKey = `${sorted[0].m}-${sorted[0].y}`;
          setSelectedPeriodKeys([latestKey]);
          setSelectedMonth(sorted[0].m);
          setSelectedYear(sorted[0].y);
        }
      }
    } catch (err) {
      console.error('Error fetching available periods:', err);
    }
  };

  const fetchGovernorMasters = async () => {
    try {
      const res = await api.get('/incentive-governor/masters');
      if (res.data) {
        const branchesList = res.data.branches?.length ? res.data.branches : availableBranches;
        const catsList = res.data.categories?.length ? res.data.categories : ['AA', 'AG', 'M', 'T'];
        const typesList = res.data.partyTypes?.length ? res.data.partyTypes : [
          'CO-DEALER', 'CO-DISTRIBUTOR', 'INDEPENDENT WORKSHOP', 'MASS', 'TRADER/RETAILER', 'WALK-IN CUSTOMER'
        ];

        setAvailableBranches(branchesList);
        setAvailableCategories(catsList);
        setAvailablePartyTypes(typesList);

        // Pre-populate all 35 branches with default 'M', 'AA' & 'INDEPENDENT WORKSHOP' selected
        setRules(
          branchesList.map((b: string) => ({
            branch: b,
            categories: ['M', 'AA'],
            partyTypes: ['INDEPENDENT WORKSHOP'],
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching governor masters:', err);
    }
  };

  // Multi-Select Periods State
  // Default = Jun 2026 (latest with data). fetchAvailablePeriods() will auto-correct to actual latest on load.
  const [selectedPeriodKeys, setSelectedPeriodKeys] = useState<string[]>(['6-2026']);
  const [selectedMonth, setSelectedMonth] = useState<number>(6);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [processingMethod, setProcessingMethod] = useState<'DYNAMIC' | 'PRE_CALCULATED'>('DYNAMIC');

  // Governor Rules State (Pre-populated for all 35 branches with M, AA & INDEPENDENT WORKSHOP)
  const [rules, setRules] = useState<GovernorRule[]>(
    [
      'ALW', 'BER', 'BGI', 'BSE', 'BWI', 'CR9', 'DUS', 'F33', 'GRL', 'HDN',
      'HMR', 'HUH', 'ISN', 'JGT', 'JNU', 'JPD', 'JSK', 'KNO', 'LQU', 'NBT',
      'OR7', 'PKT', 'PPH', 'PSS', 'RQL', 'SDH', 'SGH', 'SGN', 'SJG', 'SKF',
      'SKR', 'STO', 'TNG', 'UTD', 'VBZ'
    ].map((b) => ({
      branch: b,
      categories: ['M', 'AA'],
      partyTypes: ['INDEPENDENT WORKSHOP'],
    }))
  );

  // State Management
  const [periodStatus, setPeriodStatus] = useState<any>({
    status: 'NOT_PROCESSED',
    processingMethod: 'DYNAMIC',
  });
  const [records, setRecords] = useState<IncentiveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'GOVERNOR' | 'REGISTER'>(isSuperAdmin ? 'GOVERNOR' : 'REGISTER');

  useEffect(() => {
    if (!isSuperAdmin) {
      setActiveTab('REGISTER');
    }
  }, [isSuperAdmin]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPartyType, setFilterPartyType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayoutStatus, setFilterPayoutStatus] = useState('ALL');
  const [filterActivity, setFilterActivity] = useState<'TRANSACTING' | 'ALL' | 'ZERO_SALES'>('TRANSACTING');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Bank Payout Reconciliation Upload State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutMonth, setPayoutMonth] = useState<number>(6);
  const [payoutYear, setPayoutYear] = useState<number>(2026);
  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [isUploadingPayout, setIsUploadingPayout] = useState(false);
  const [payoutResult, setPayoutResult] = useState<any>(null);

  const handleUploadPayoutFile = async () => {
    if (!payoutFile) {
      toast.error('Please select a Bank Transfer Excel file first.');
      return;
    }

    setIsUploadingPayout(true);
    setPayoutResult(null);

    try {
      const formData = new FormData();
      formData.append('file', payoutFile);
      formData.append('year', String(payoutYear));
      formData.append('month', String(payoutMonth));

      const res = await api.post('/incentive-governor/upload-bank-payout', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data && res.data.success) {
        setPayoutResult(res.data);
        toast.success(`Bank Payout reconciled! ${res.data.matchedCount} records updated.`);
        fetchPeriodData(selectedPeriodKeys);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error uploading file';
      toast.error(msg);
    } finally {
      setIsUploadingPayout(false);
    }
  };

  // Pre-calculated Upload State & Handler
  const [preCalcFile, setPreCalcFile] = useState<File | null>(null);
  const [isUploadingPreCalc, setIsUploadingPreCalc] = useState(false);

  const handlePreCalculatedFileProcess = async (file: File) => {
    if (!file) return;

    setIsUploadingPreCalc(true);
    toast.loading(`Processing Pre-Calculated Excel file (${file.name})...`, { id: 'precalc' });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonRecords: any[] = XLSX.utils.sheet_to_json(sheet);

      if (!jsonRecords || jsonRecords.length === 0) {
        toast.error('The uploaded Excel file contains no valid data rows.', { id: 'precalc' });
        return;
      }

      const res = await api.post('/incentive-governor/upload-precalculated', {
        year: selectedYear,
        month: selectedMonth,
        records: jsonRecords,
        uploadedBy: 'SuperAdmin',
      });

      if (res.data && res.data.success) {
        toast.success(
          `Pre-Calculated Excel Uploaded! ${res.data.totalUploaded} records processed for ${MONTH_NAMES_SHORT[selectedMonth - 1] || 'Month'} ${selectedYear}.`,
          { id: 'precalc' }
        );
        fetchPeriodData(selectedPeriodKeys);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error processing pre-calculated file.';
      toast.error(msg, { id: 'precalc' });
    } finally {
      setIsUploadingPreCalc(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'Cons Party Code': 'WRJ010120962',
        'Cons Party Name': 'GIYA MOTORS',
        'Location': 'ALW',
        'Net Retail Selling': 17498,
        'Discount Amount': 0,
        'Slab': '0%',
        'Incentive': 0,
      },
      {
        'Cons Party Code': 'WRJ0106112',
        'Cons Party Name': 'MEHANDIRATTA SRV CENTER',
        'Location': 'ALW',
        'Net Retail Selling': 123093,
        'Discount Amount': 9620,
        'Slab': '6%',
        'Incentive': 0,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PreCalculatedIncentives');
    XLSX.writeFile(wb, `PreCalculated_Incentive_Template.xlsx`);
    toast.success('Downloaded Pre-Calculated Incentive Excel Template!');
  };

  // Sync tab from URL search parameters
  useEffect(() => {
    if (searchParams && searchParams.get('tab') === 'register') {
      setActiveTab('REGISTER');
    }
  }, [searchParams]);

  // Modals & Drawers
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [calcModalRecord, setCalcModalRecord] = useState<IncentiveRecord | null>(null);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [showAuditDrawer, setShowAuditDrawer] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Fetch Period Status & Records on Multi-Select Periods change
  const fetchPeriodData = useCallback(async (keys: string[]) => {
    if (!keys || keys.length === 0) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const promises = keys.map((pKey) => {
        const [m, y] = pKey.split('-').map(Number);
        return api.get('/incentive-governor/preview', {
          params: { year: y, month: m },
        });
      });

      const results = await Promise.all(promises);
      let combinedRecords: any[] = [];
      let latestControl = null;

      results.forEach((res) => {
        if (res.data) {
          if (res.data.periodControl) latestControl = res.data.periodControl;
          if (res.data.records) {
            combinedRecords = combinedRecords.concat(res.data.records);
          }
        }
      });

      if (latestControl) setPeriodStatus(latestControl);
      setRecords(combinedRecords);
      setSelectedRecordIds(combinedRecords.map((r: any) => r.id || r.originalPartyCode));
    } catch (err) {
      console.error('Error fetching period preview data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced fetch — waits 350ms after user stops clicking before hitting the API
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPeriodData(selectedPeriodKeys);
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedPeriodKeys, fetchPeriodData]);

  // Rule Handlers
  const handleAddRule = () => {
    const nextBranch = availableBranches.find((b) => !rules.some((r) => r.branch === b)) || availableBranches[0] || 'ALW';
    setRules([...rules, { branch: nextBranch, categories: [availableCategories[0] || 'M'], partyTypes: [availablePartyTypes[0] || 'IW'] }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof GovernorRule, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const toggleArrayItem = (arr: string[], item: string) => {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  };

  // Calculation Trigger (Queries Real DB Data)
  const handleExecuteCalculation = async () => {
    if (rules.length === 0) {
      toast.error('Please configure at least one Governor Branch Rule.');
      return;
    }

    setCalculating(true);
    try {
      const res = await api.post('/incentive-governor/calculate', {
        year: selectedYear,
        month: selectedMonth,
        rules: rules,
        executedBy: 'SuperAdmin',
      });

      if (res.data && res.data.success) {
        toast.success(`DB Incentive Calculation Executed for ${rules.length} Branches!`);
        if (res.data.periodControl) setPeriodStatus(res.data.periodControl);
        if (res.data.records) {
          setRecords(res.data.records);
          setSelectedRecordIds(res.data.records.map((r: any) => r.id || r.originalPartyCode));
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error executing DB calculation.';
      toast.error(msg);
    } finally {
      setCalculating(false);
    }
  };

  // Commit Handler
  const handleCommitPeriod = async () => {
    setCommitting(true);
    try {
      const res = await api.post('/incentive-governor/commit', {
        year: selectedYear,
        month: selectedMonth,
        committedBy: 'SuperAdmin',
        selectedIds: selectedRecordIds,
      });

      if (res.data) {
        toast.success('Incentive Register COMMITTED & MONTH LOCKED successfully!', { id: 'commit', icon: '🔒' });
        if (res.data.periodControl) setPeriodStatus(res.data.periodControl);
        setActiveTab('REGISTER');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error committing period.';
      toast.error(msg, { id: 'commit' });
    } finally {
      setCommitting(false);
      setShowCommitModal(false);
    }
  };

  // Reopen Handler
  const handleReopenPeriod = async () => {
    if (!reopenReason || reopenReason.trim().length < 5) {
      toast.error('Please enter a valid reason (min 5 characters) to reopen period.');
      return;
    }

    try {
      const res = await api.post('/incentive-governor/reopen', {
        year: selectedYear,
        month: selectedMonth,
        reopenedBy: 'SuperAdmin',
        reason: reopenReason,
      });

      if (res.data) {
        toast.success('Incentive Period REOPENED for editing.', { icon: '🔓' });
        if (res.data.periodControl) setPeriodStatus(res.data.periodControl);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error reopening period.';
      toast.error(msg);
    } finally {
      setShowReopenModal(false);
      setReopenReason('');
    }
  };

  // Export Formatted Incentive Register to Excel
  const handleExportToExcel = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      toast.error('No records available to export.');
      return;
    }

    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = monthNames[selectedMonth - 1] || `Month-${selectedMonth}`;

      // 1. Prepare Main Register Rows
      const exportRows = filteredRecords.map((r, index) => ({
        'S.No': index + 1,
        'Month / Year': `${monthLabel} ${selectedYear}`,
        'Original Party Code': r.originalPartyCode,
        'Party / Customer Name': r.partyName,
        'Party Master Base Branch': r.baseBranch,
        'Eligible Party Type': r.partyType,
        'Sales NRS (₹)': Math.round(r.nrs),
        'Total Discount (₹)': Math.round(r.totalDiscount),
        'Incentive Scheme / Slab': r.applicableSlab || 'N/A',
        'Incentive Rate (%)': `${(r.applicableRate || 0).toFixed(1)}%`,
        'Gross Incentive (₹)': Math.round(r.grossIncentive),
        'Final Payable Incentive (₹)': Math.round(r.finalIncentive),
        'Validation Status': r.validationStatus,
        'Validation Notes': Array.isArray(r.validationErrors) ? r.validationErrors.join('; ') : '',
      }));

      // Add Total Summary Row at bottom
      const totalNrsSum = filteredRecords.reduce((a, b) => a + (b.nrs || 0), 0);
      const totalDiscSum = filteredRecords.reduce((a, b) => a + (b.totalDiscount || 0), 0);
      const totalGrossSum = filteredRecords.reduce((a, b) => a + (b.grossIncentive || 0), 0);
      const totalFinalSum = filteredRecords.reduce((a, b) => a + (b.finalIncentive || 0), 0);

      exportRows.push({
        'S.No': 'TOTAL',
        'Month / Year': `${monthLabel} ${selectedYear}`,
        'Original Party Code': `${filteredRecords.length} Parties`,
        'Party / Customer Name': 'TOTAL INCENTIVE REGISTER SUMMARY',
        'Party Master Base Branch': `${rules.length} Branches`,
        'Eligible Party Type': 'ALL TYPES',
        'Sales NRS (₹)': Math.round(totalNrsSum),
        'Total Discount (₹)': Math.round(totalDiscSum),
        'Incentive Scheme / Slab': 'SUMMARY',
        'Incentive Rate (%)': '-',
        'Gross Incentive (₹)': Math.round(totalGrossSum),
        'Final Payable Incentive (₹)': Math.round(totalFinalSum),
        'Validation Status': 'AUDITED',
        'Validation Notes': `Period: ${monthLabel} ${selectedYear}`,
      } as any);

      // Create Worksheet 1
      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      // Set Column Widths for readability
      worksheet['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 14 }, // Month / Year
        { wch: 22 }, // Original Party Code
        { wch: 35 }, // Party / Customer Name
        { wch: 24 }, // Base Branch
        { wch: 24 }, // Party Type
        { wch: 18 }, // Sales NRS
        { wch: 18 }, // Total Discount
        { wch: 28 }, // Incentive Scheme / Slab
        { wch: 16 }, // Incentive Rate
        { wch: 18 }, // Gross Incentive
        { wch: 22 }, // Final Payable
        { wch: 16 }, // Validation Status
        { wch: 40 }, // Validation Notes
      ];

      // 2. Prepare Period Audit Summary Sheet
      const summaryRows = [
        { Parameter: 'Period Month', Value: monthLabel },
        { Parameter: 'Period Year', Value: selectedYear },
        { Parameter: 'Period Control Status', Value: periodStatus.status || 'PREVIEW' },
        { Parameter: 'Processing Method', Value: processingMethod },
        { Parameter: 'Configured Governor Branches', Value: rules.length },
        { Parameter: 'Total Master Eligible Parties', Value: records.length },
        { Parameter: 'Exported Transacting Parties', Value: filteredRecords.length },
        { Parameter: 'Total Sales NRS (₹)', Value: totalNrsSum.toFixed(2) },
        { Parameter: 'Total Discount Amount (₹)', Value: totalDiscSum.toFixed(2) },
        { Parameter: 'Total Gross Incentive (₹)', Value: totalGrossSum.toFixed(2) },
        { Parameter: 'Total Final Payable Incentive (₹)', Value: totalFinalSum.toFixed(2) },
        { Parameter: 'Exported Timestamp', Value: new Date().toLocaleString() },
      ];
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
      summaryWorksheet['!cols'] = [{ wch: 32 }, { wch: 35 }];

      // Create Workbook & Append Sheets
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Incentive Register');
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Period Audit Summary');

      // Trigger Download
      const fileName = `Incentive_Governor_Register_${monthLabel}_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Successfully exported formatted Excel file: ${fileName}`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      toast.error('Failed to export Excel file.');
    }
  };

  // ── Pagination State ──
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterBranch, filterPartyType, filterStatus, filterPayoutStatus, filterActivity, selectedPeriodKeys, activeTab]);

  // Set default branch for branch users
  useEffect(() => {
    if (isBranchUser && userBranch && userBranch !== 'ALL') {
      setFilterBranch(userBranch);
    }
  }, [isBranchUser, userBranch]);

  // ── Memoized filter + totals — only recomputes when data or filters change ──
  const filteredRecords = useMemo(() => records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.originalPartyCode.toLowerCase().includes(q) ||
      r.partyName.toLowerCase().includes(q) ||
      r.baseBranch.toLowerCase().includes(q);

    const effectiveBranch = (isBranchUser && userBranch) ? userBranch : filterBranch;
    const matchesBranch      = effectiveBranch  === 'ALL' || r.baseBranch    === effectiveBranch;
    const matchesPartyType   = filterPartyType  === 'ALL' || r.partyType     === filterPartyType;
    const matchesStatus      = filterStatus     === 'ALL' || r.validationStatus === filterStatus;
    const matchesActivity    =
      filterActivity === 'ALL'          ? true
      : filterActivity === 'TRANSACTING' ? r.nrs > 0
      : r.nrs === 0;
    const matchesPayoutStatus =
      filterPayoutStatus === 'ALL'      ? true
      : filterPayoutStatus === 'Pending' ? (!r.payoutStatus || r.payoutStatus === 'Pending')
      : filterPayoutStatus === 'Success' ? ['Success', 'Paid'].includes(r.payoutStatus || '')
      : r.payoutStatus === filterPayoutStatus;

    return matchesSearch && matchesBranch && matchesPartyType && matchesStatus && matchesActivity && matchesPayoutStatus;
  }), [records, searchQuery, filterBranch, filterPartyType, filterStatus, filterActivity, filterPayoutStatus, isBranchUser, userBranch]);

  const transactingPartiesCount = useMemo(() => records.filter((r) => r.nrs > 0).length, [records]);

  const totalNrs            = useMemo(() => filteredRecords.reduce((a, r) => a + r.nrs, 0),            [filteredRecords]);
  const totalDiscount       = useMemo(() => filteredRecords.reduce((a, r) => a + r.totalDiscount, 0),  [filteredRecords]);
  const totalGrossIncentive = useMemo(() => filteredRecords.reduce((a, r) => a + r.grossIncentive, 0), [filteredRecords]);
  const totalFinalIncentive = useMemo(() => filteredRecords.reduce((a, r) => a + r.finalIncentive, 0), [filteredRecords]);
  const totalWarnings       = useMemo(() => filteredRecords.filter((r) => r.validationStatus === 'WARNING').length, [filteredRecords]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.ceil(filteredRecords.length / pageSize) || 1;
  }, [filteredRecords.length, pageSize]);

  const paginatedRecords = useMemo(() => {
    if (pageSize === 0) return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const renderPagination = () => {
    if (filteredRecords.length <= 25 && pageSize === 100) return null;
    const startIdx = pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredRecords.length);
    const endIdx = pageSize === 0 ? filteredRecords.length : Math.min(currentPage * pageSize, filteredRecords.length);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 font-semibold rounded-b-2xl select-none">
        <div className="flex items-center gap-2">
          <span>Showing <strong className="text-slate-900">{filteredRecords.length === 0 ? 0 : startIdx}</strong> to <strong className="text-slate-900">{endIdx}</strong> of <strong className="text-[#053D3A]">{filteredRecords.length.toLocaleString()}</strong> records</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#053D3A] cursor-pointer"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={0}>All ({filteredRecords.length})</option>
            </select>
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer transition"
                title="First Page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer transition"
                title="Previous Page"
              >
                ‹
              </button>
              <span className="px-3 py-1 bg-[#053D3A]/5 text-[#053D3A] font-extrabold rounded-lg border border-[#053D3A]/10">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer transition"
                title="Next Page"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer transition"
                title="Last Page"
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isLocked = periodStatus.status === 'COMMITTED' || periodStatus.status === 'LOCKED';

  return (
    <AppShell
      title={activeTab === 'REGISTER' ? "Committed Incentive Register" : "Incentive Governor & Processing Engine"}
      breadcrumb={activeTab === 'REGISTER' ? "Financial Register" : "Enterprise Operations"}
    >
      <div className="space-y-6 max-w-full">
        {/* ─── 1. TOP HEADER STEPPER BAR (Governor Tab Only) ─── */}
        {activeTab === 'GOVERNOR' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#053D3A] text-[#FFE2B8] shadow-2xs">
                  <Sliders size={18} />
                </span>
                <div>
                  <h2 className="text-base font-black text-[#053D3A] tracking-tight">
                    Incentive Governor Control Center
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Multi-Branch Party Master Eligibility • DB-Level Aggregation • Month Lock Engine
                  </p>
                </div>
              </div>
            </div>

            {/* Period Status Badge */}
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-2xs ${
                  isLocked
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : periodStatus.status === 'PREVIEW'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                <span>
                  Status: <strong>{periodStatus.status}</strong> ({processingMethod})
                </span>
              </div>

              {isLocked && isSuperAdmin && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
                >
                  <Unlock size={13} className="text-amber-600" />
                  <span>Reopen Period</span>
                </button>
              )}
            </div>
          </div>

          {/* Stepper Steps (01 to 06) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            {[
              { step: '01', title: 'Period Select', active: true, done: true },
              { step: '02', title: 'Governor Rules', active: true, done: rules.length > 0 },
              { step: '03', title: 'DB Calculation', active: calculating, done: records.length > 0 },
              { step: '04', title: 'Preview & Rules', active: periodStatus.status === 'PREVIEW', done: periodStatus.status === 'PREVIEW' || isLocked },
              { step: '05', title: 'Commit Register', active: showCommitModal, done: isLocked },
              { step: '06', title: 'Locked & Audited', active: isLocked, done: isLocked },
            ].map((st, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                  st.done
                    ? 'bg-[#053D3A]/5 border-[#053D3A]/30 text-[#053D3A]'
                    : st.active
                    ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <span className="text-[10px] font-bold font-mono opacity-80">{st.step}</span>
                <span className="text-xs font-extrabold">{st.title}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* ─── 1.5 NAVIGATION TAB BAR (Governor Tab Only) ─── */}
        {activeTab === 'GOVERNOR' && (
          <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('GOVERNOR')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'GOVERNOR'
                    ? 'bg-[#053D3A] text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <SlidersHorizontal size={15} />
                <span>Incentive Governor & Calculation Engine</span>
              </button>

              <button
                onClick={() => setActiveTab('REGISTER')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer relative bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200`}
              >
                <BookOpen size={15} />
                <span>Committed Incentive Register</span>
                {isLocked ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white flex items-center gap-1 shadow-2xs">
                    <Lock size={10} /> LOCKED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    REGISTER VIEW
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs font-extrabold text-[#053D3A] px-3.5 py-1.5 bg-[#053D3A]/5 rounded-xl border border-[#053D3A]/10 hidden md:block">
              Governor Rules & Live Preview Engine
            </div>
          </div>
        )}

        {/* ─── 2. PERIOD & METHOD SELECTOR TOOLBAR ─── */}
        {activeTab === 'GOVERNOR' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Multi-Select Periods Dropdown */}
            <PeriodMultiSelectDropdown
              availablePeriods={availablePeriods}
              selectedPeriodKeys={selectedPeriodKeys}
              setSelectedPeriodKeys={setSelectedPeriodKeys}
            />

            {/* Processing Method Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setProcessingMethod('DYNAMIC')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  processingMethod === 'DYNAMIC'
                    ? 'bg-[#053D3A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Method A: Dynamic Calculation
              </button>
              <button
                type="button"
                onClick={() => setProcessingMethod('PRE_CALCULATED')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  processingMethod === 'PRE_CALCULATED'
                    ? 'bg-[#053D3A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Method B: Pre-Calculated Upload
              </button>
            </div>
          </div>

          {/* Audit History Trigger */}
          <button
            onClick={() => setShowAuditDrawer(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
          >
            <History size={14} className="text-[#053D3A]" />
            <span>Audit Trail Log</span>
          </button>
        </div>

        {/* ─── 3. METHOD A: DYNAMIC GOVERNOR RULE BUILDER (MODAL & COMPACT VIEW) ─── */}
        {processingMethod === 'DYNAMIC' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#053D3A]/10 text-[#053D3A] font-bold">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#053D3A] flex items-center gap-2">
                    <span>Governor Multi-Branch Configuration Rules</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                      {rules.length} Branches Configured
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Party Master Base Branch filters eligible customers. Sales from all transaction branches will be aggregated.
                  </p>
                </div>
              </div>

              {!isLocked && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRulesModal(true)}
                    className="px-4.5 py-2.5 bg-[#053D3A] hover:bg-[#074B47] text-white text-xs font-extrabold rounded-xl flex items-center gap-2 transition.all shadow-sm hover:shadow-md cursor-pointer border border-[#053D3A]/40 group"
                  >
                    <span className="p-1 rounded-lg bg-white/10 group-hover:bg-white/20 transition">
                      <SlidersHorizontal size={15} className="text-[#FFE2B8]" />
                    </span>
                    <span>Configure Branch Rules ({rules.length} Branches)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Configured Rules Preview Badges */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Active Branches:</span>
                {rules.slice(0, 10).map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-[11px] font-bold text-[#053D3A]">
                    {r.branch}
                  </span>
                ))}
                {rules.length > 10 && (
                  <span className="text-xs font-bold text-slate-600">
                    +{rules.length - 10} more branches...
                  </span>
                )}
              </div>

              {!isLocked && (
                <button
                  onClick={handleExecuteCalculation}
                  disabled={calculating}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#053D3A] to-[#085C57] hover:from-[#074B47] hover:to-[#0A6E68] text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 shrink-0 border border-emerald-600/30 group"
                >
                  {calculating ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-amber-300" />
                      <span>Aggregating DB Data...</span>
                    </>
                  ) : (
                    <>
                      <span className="p-1 rounded-lg bg-amber-400/20 group-hover:bg-amber-400/30 transition">
                        <Zap size={15} className="text-amber-300 fill-amber-300" />
                      </span>
                      <span>Run Governor Calculation</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── GOVERNOR MULTI-BRANCH RULES MODAL VIEW ─── */}
        {showRulesModal && (
          <div
            onClick={() => setShowRulesModal(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D] shrink-0">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-[#053D3A] text-[#FFE2B8]">
                    <Sliders size={20} />
                  </span>
                  <div>
                    <h3 className="font-black text-base text-white">
                      Configure Governor Multi-Branch Rules ({rules.length} Branches)
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">
                      Select Party Master Base Branch, Part Categories, and Eligible Customer Party Types
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Toolbar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setRules(
                        availableBranches.map((b) => ({
                          branch: b,
                          categories: ['M', 'AA'],
                          partyTypes: ['INDEPENDENT WORKSHOP'],
                        }))
                      );
                      toast.success(`Populated all ${availableBranches.length} branches (Default: M, AA & INDEPENDENT WORKSHOP)!`);
                    }}
                    className="px-3 py-1.5 bg-[#053D3A] hover:bg-[#074B47] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  >
                    <Sliders size={14} className="text-[#FFE2B8]" />
                    <span>Reset All to Default (M, AA & INDEPENDENT WORKSHOP)</span>
                  </button>

                  <button
                    onClick={handleAddRule}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Single Rule</span>
                  </button>

                  <button
                    onClick={() => {
                      setRules([]);
                      toast.success('Cleared all branch rules.');
                    }}
                    className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="text-xs font-bold text-slate-600">
                  Showing <strong>{rules.length}</strong> configured branch rules
                </div>
              </div>

              {/* Scrollable Modal Table */}
              <div className="overflow-y-auto p-4 flex-1">
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#053D3A] text-white uppercase text-[10px] tracking-wider select-none">
                      <tr>
                        <th className="px-3.5 py-2.5 border-r border-white/10 w-12">#</th>
                        <th className="px-3.5 py-2.5 border-r border-white/10 min-w-[140px]">Party Master Base Branch</th>
                        <th className="px-3.5 py-2.5 border-r border-white/10">Part Categories</th>
                        <th className="px-3.5 py-2.5 border-r border-white/10">Eligible Party Types</th>
                        <th className="px-3.5 py-2.5 text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {rules.map((rule, index) => (
                        <tr key={index} className="hover:bg-slate-50/80 transition">
                          <td className="px-3.5 py-2.5 font-bold font-mono text-slate-700">{index + 1}</td>
                          <td className="px-3.5 py-2.5">
                            <select
                              value={rule.branch}
                              onChange={(e) => handleRuleChange(index, 'branch', e.target.value)}
                              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                              disabled={isLocked}
                            >
                              {availableBranches.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {availableCategories.map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() =>
                                    handleRuleChange(index, 'categories', toggleArrayItem(rule.categories, cat))
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                    rule.categories.includes(cat)
                                      ? 'bg-[#053D3A] text-white border-[#053D3A]'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  disabled={isLocked}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {availablePartyTypes.map((pt) => (
                                <button
                                  key={pt}
                                  type="button"
                                  onClick={() =>
                                    handleRuleChange(index, 'partyTypes', toggleArrayItem(rule.partyTypes, pt))
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                    rule.partyTypes.includes(pt)
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  disabled={isLocked}
                                >
                                  {pt}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            {!isLocked && (
                              <button
                                onClick={() => handleRemoveRule(index)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Remove Rule"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-600 font-medium">
                  Configured <strong>{rules.length} Governor Branch Rules</strong>.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRulesModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowRulesModal(false);
                      toast.success(`Applied ${rules.length} Governor Branch Rules!`);
                    }}
                    className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    Save & Apply Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4. METHOD B: PRE-CALCULATED EXCEL UPLOAD ─── */}
        {processingMethod === 'PRE_CALCULATED' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#053D3A] flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#053D3A]" />
                  <span>Pre-Calculated Incentive Upload Workflow ({MONTH_NAMES_SHORT[selectedMonth - 1]} {selectedYear})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Upload custom pre-calculated Excel records for {MONTH_NAMES_SHORT[selectedMonth - 1]} {selectedYear} period locking.
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
              >
                <Download size={14} />
                <span>Download Excel Template</span>
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-[#053D3A] rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setPreCalcFile(f);
                    handlePreCalculatedFileProcess(f);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                disabled={isLocked || isUploadingPreCalc}
              />
              <Upload size={32} className="mx-auto text-[#053D3A] mb-2" />
              <p className="text-xs font-bold text-slate-800">
                {preCalcFile ? preCalcFile.name : `Click or Drag & Drop Pre-Calculated Excel File for ${MONTH_NAMES_SHORT[selectedMonth - 1]} ${selectedYear}`}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Supports .XLSX, .XLS, or .CSV formats</p>
              <button
                type="button"
                className="mt-4 px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer pointer-events-none"
              >
                {isUploadingPreCalc ? 'Uploading & Processing...' : 'Select File & Process Preview'}
              </button>
            </div>
          </div>
        )}

        {/* ─── 5. EXECUTIVE SUMMARY KPI CARDS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Transacting Parties</span>
            <p className="text-lg font-black text-[#053D3A] mt-1 font-mono">{filteredRecords.length.toLocaleString()}</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">out of {records.length.toLocaleString()} Master Parties</p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sales NRS</span>
            <p className="text-lg font-black text-slate-900 mt-1 font-mono">₹{Math.round(totalNrs).toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Discount</span>
            <p className="text-lg font-black text-slate-700 mt-1 font-mono">₹{Math.round(totalDiscount).toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Incentive</span>
            <p className="text-lg font-black text-blue-700 mt-1 font-mono">₹{Math.round(totalGrossIncentive).toLocaleString()}</p>
          </div>

          <div className="bg-[#FFF8EC] rounded-2xl p-3.5 border border-[#FFE2B8] shadow-2xs">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Final Payable</span>
            <p className="text-lg font-black text-[#053D3A] mt-1 font-mono">₹{Math.round(totalFinalIncentive).toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Validation Warnings</span>
            <p className="text-lg font-black text-amber-600 mt-1 font-mono">{totalWarnings}</p>
          </div>
        </div>

        {/* ─── 6. INCENTIVE PREVIEW DATAGRID MATRIX ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Datagrid Controls Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="relative w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name, branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                />
              </div>

              {/* Activity Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">View:</span>
                <select
                  value={filterActivity}
                  onChange={(e) => setFilterActivity(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="TRANSACTING">Active Transacting Parties ({transactingPartiesCount})</option>
                  <option value="ALL">All Master Parties ({records.length})</option>
                  <option value="ZERO_SALES">Zero-Sales Parties ({records.length - transactingPartiesCount})</option>
                </select>
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Branch:</span>
                <select
                  value={isBranchUser && userBranch ? userBranch : filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  disabled={Boolean(isBranchUser && userBranch)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer disabled:opacity-75"
                >
                  {isBranchUser && userBranch ? (
                    <option value={userBranch}>{userBranch}</option>
                  ) : (
                    <>
                      <option value="ALL">All Branches</option>
                      {availableBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Party Type Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Type:</span>
                <select
                  value={filterPartyType}
                  onChange={(e) => setFilterPartyType(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  {availablePartyTypes.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleExportToExcel}
                disabled={filteredRecords.length === 0}
                className="px-4.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 border border-emerald-600/40"
              >
                <Download size={16} className="text-white" />
                <span>Export Formatted Excel</span>
              </button>

              {isSuperAdmin && !isLocked && (
                <button
                  onClick={() => setShowCommitModal(true)}
                  disabled={filteredRecords.length === 0}
                  className="px-4.5 py-2.5 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 border border-teal-600/40"
                >
                  <CheckCircle2 size={16} className="text-white" />
                  <span>Commit & Lock Incentive Register</span>
                </button>
              )}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-20 table-header-navy select-none">
                <tr>
                  <th className="px-3 py-2.5 text-center border-r border-white/10 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedRecordIds.length > 0 &&
                        selectedRecordIds.length === filteredRecords.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecordIds(filteredRecords.map((r) => r.id || r.originalPartyCode));
                        } else {
                          setSelectedRecordIds([]);
                        }
                      }}
                      className="rounded accent-[#053D3A] cursor-pointer"
                    />
                  </th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10 whitespace-nowrap">Month / Year</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Original Code</th>
                  <th className="px-3.5 py-2.5 text-left align-middle border-r border-white/10 min-w-[200px]">Party Name</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Base Branch</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Party Type</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Sales NRS</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Total Discount</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Incentive Rule</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Final Incentive</th>
                  <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Validation</th>
                  <th className="px-3.5 py-2.5 text-center align-middle">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {paginatedRecords.map((rec) => {
                  const isChecked = selectedRecordIds.includes(rec.id || rec.originalPartyCode);
                  return (
                    <tr
                      key={rec.id || rec.originalPartyCode}
                      className={`hover:bg-slate-50 transition ${
                        rec.validationStatus === 'WARNING' ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const id = rec.id || rec.originalPartyCode;
                            setSelectedRecordIds((prev) =>
                              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                            );
                          }}
                          className="rounded accent-[#053D3A] cursor-pointer"
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-[#053D3A]">
                          {MONTH_NAMES_SHORT[selectedMonth - 1] || 'Jun'} {selectedYear}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-[#053D3A] border-r border-slate-200">
                        {rec.originalPartyCode}
                      </td>
                      <td className="px-3.5 py-2.5 text-left align-middle font-bold text-slate-900 border-r border-slate-200">
                        {rec.partyName}
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle font-bold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {rec.baseBranch}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle text-slate-700 border-r border-slate-200">
                        {rec.partyType}
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-slate-900 border-r border-slate-200">
                        ₹{Math.round(rec.nrs).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200">
                        ₹{Math.round(rec.totalDiscount).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                        <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {rec.applicableSlab}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center align-middle font-mono font-black text-[#053D3A] border-r border-slate-200">
                        ₹{Math.round(rec.finalIncentive).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                        {rec.validationStatus === 'VALID' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            VALID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            WARNING
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          onClick={() => setCalcModalRecord(rec)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-[#053D3A] hover:text-white text-slate-800 rounded-lg text-[11px] font-bold border border-slate-300 transition cursor-pointer"
                        >
                          View Calc
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      </div>
    )}

        {/* ─── TAB 2: COMMITTED INCENTIVE REGISTER VIEW ─── */}
        {activeTab === 'REGISTER' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Transacting Parties</span>
                <p className="text-lg font-black text-[#053D3A] mt-1 font-mono">{filteredRecords.length.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">out of {records.length.toLocaleString()} Master Parties</p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sales NRS</span>
                <p className="text-lg font-black text-slate-900 mt-1 font-mono">₹{Math.round(totalNrs).toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Discount</span>
                <p className="text-lg font-black text-slate-700 mt-1 font-mono">₹{Math.round(totalDiscount).toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Incentive</span>
                <p className="text-lg font-black text-blue-700 mt-1 font-mono">₹{Math.round(totalGrossIncentive).toLocaleString()}</p>
              </div>

              <div className="bg-[#FFF8EC] rounded-2xl p-3.5 border border-[#FFE2B8] shadow-2xs">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Final Net Payable</span>
                <p className="text-lg font-black text-[#053D3A] mt-1 font-mono">₹{Math.round(totalFinalIncentive).toLocaleString()}</p>
              </div>
            </div>

            {/* Datagrid Table */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Search Input */}
                  <div className="relative w-52">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search code, name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    />
                  </div>

                  {/* Multi-Select Periods Dropdown — Register shows only months WITH data */}
                  <PeriodMultiSelectDropdown
                    availablePeriods={availablePeriods}
                    selectedPeriodKeys={selectedPeriodKeys}
                    setSelectedPeriodKeys={setSelectedPeriodKeys}
                    onlyWithData={true}
                  />

                  {/* Branch Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Branch:</span>
                    <select
                      value={isBranchUser && userBranch ? userBranch : filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      disabled={Boolean(isBranchUser && userBranch)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer disabled:opacity-75"
                    >
                      {isBranchUser && userBranch ? (
                        <option value={userBranch}>{userBranch}</option>
                      ) : (
                        <>
                          <option value="ALL">All Branches</option>
                          {availableBranches.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  {/* Payout Status Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Payout Status:</span>
                    <select
                      value={filterPayoutStatus}
                      onChange={(e) => setFilterPayoutStatus(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Payout Status</option>
                      <option value="Success">Paid / Success</option>
                      <option value="Credit Party">Credit Party</option>
                      <option value="Reversed">Reversed / Failed</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setPayoutMonth(selectedMonth);
                        setPayoutYear(selectedYear);
                        setPayoutFile(null);
                        setPayoutResult(null);
                        setShowPayoutModal(true);
                      }}
                      className="px-4 py-2 bg-[#053D3A] hover:bg-[#074D49] text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer border border-[#053D3A]/40 shrink-0"
                    >
                      <Upload size={15} />
                      <span>Upload Bank Transfer Excel</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportToExcel}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer border border-emerald-600/40 shrink-0"
                  >
                    <Download size={15} />
                    <span>Download Register Excel</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-20 table-header-navy select-none">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10 w-12">#</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10 whitespace-nowrap">Month / Year</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Original Code</th>
                      <th className="px-3.5 py-2.5 text-left align-middle border-r border-white/10 min-w-[200px]">Party Name</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Base Branch</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Party Type</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Sales NRS</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Total Discount</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Incentive Rule</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Final Incentive</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Payout Status</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Transferred Amt</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Transfer Date</th>
                      <th className="px-3.5 py-2.5 text-center align-middle border-r border-white/10">Account & IFSC</th>
                      <th className="px-3.5 py-2.5 text-center align-middle">UTR NO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {paginatedRecords.map((rec, idx) => {
                      const rowNumber = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                      return (
                      <tr key={rec.id || idx} className="hover:bg-slate-50 transition">
                        <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-slate-600 border-r border-slate-200">{rowNumber}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-[#053D3A]">
                            {MONTH_NAMES_SHORT[(rec.month || selectedMonth) - 1] || 'Jun'} {rec.year || selectedYear}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-[#053D3A] border-r border-slate-200">{rec.originalPartyCode}</td>
                        <td className="px-3.5 py-2.5 text-left align-middle font-bold text-slate-900 border-r border-slate-200">{rec.partyName}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-bold text-slate-800 border-r border-slate-200">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">{rec.baseBranch}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle text-slate-700 border-r border-slate-200">{rec.partyType}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-slate-900 border-r border-slate-200">₹{Math.round(rec.nrs).toLocaleString()}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200">₹{Math.round(rec.totalDiscount).toLocaleString()}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{rec.applicableSlab}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono font-black text-[#053D3A] border-r border-slate-200">₹{Math.round(rec.finalIncentive).toLocaleString()}</td>
                        <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                          {rec.payoutStatus ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase border ${
                              ['Success', 'Paid'].includes(rec.payoutStatus)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : rec.payoutStatus === 'Credit Party'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-black'
                                : ['Reversed', 'Failed'].includes(rec.payoutStatus)
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}>
                              {rec.payoutStatus}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">Pending</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-emerald-800 border-r border-slate-200">
                          {rec.transferredAmount !== undefined && rec.transferredAmount !== null ? `₹${Math.round(rec.transferredAmount).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {rec.transferDate || '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle text-xs border-r border-slate-200 whitespace-nowrap">
                          {rec.accountNo || rec.accountHolder ? (
                            <div>
                              {rec.accountHolder && (
                                <div className="font-extrabold text-slate-900 text-[11px] mb-0.5">{rec.accountHolder}</div>
                              )}
                              <div className="font-mono font-bold text-slate-700">{rec.accountNo || '-'}</div>
                              <div className="font-mono text-[10px] text-slate-500 font-semibold">{rec.ifscCode || '-'}</div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-blue-900 whitespace-nowrap">
                          {rec.utrNo || '-'}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </div>
          </div>
        )}

        {/* ─── 7. TRANSPARENT CALCULATION BREAKDOWN MODAL ─── */}
        {calcModalRecord && (
          <div
            onClick={() => setCalcModalRecord(null)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#FFE2B8]" />
                  <h3 className="font-black text-sm text-white">Calculation Breakdown</h3>
                </div>
                <button
                  onClick={() => setCalcModalRecord(null)}
                  className="p-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <p className="font-black text-slate-900 text-sm">{calcModalRecord.partyName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Code: <strong>{calcModalRecord.originalPartyCode}</strong> • Base Branch: <strong>{calcModalRecord.baseBranch}</strong>
                  </p>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-white">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Aggregated Net Sales (NRS):</span>
                    <span className="font-mono font-bold text-slate-900">₹{Math.round(calcModalRecord.nrs).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Applicable Rule / Slab:</span>
                    <span className="font-bold text-blue-700">{calcModalRecord.applicableSlab}</span>
                  </div>
                  <div className="flex items-center justify-between text-blue-900 font-bold pt-2 border-t border-slate-100">
                    <span>Gross Incentive:</span>
                    <span className="font-mono text-sm">₹{Math.round(calcModalRecord.grossIncentive).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Less: Total Discount:</span>
                    <span className="font-mono text-rose-600">- ₹{Math.round(calcModalRecord.totalDiscount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#FFF8EC] border border-[#FFE2B8] rounded-2xl flex items-center justify-between text-[#053D3A]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-900">Final Payable Incentive</span>
                    <p className="text-xs text-slate-600 font-mono">Formula: MAX(Gross - Discount, 0)</p>
                  </div>
                  <span className="text-xl font-black font-mono">
                    ₹{Math.round(calcModalRecord.finalIncentive).toLocaleString()}
                  </span>
                </div>

                {calcModalRecord.validationErrors && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Validation Alert:</strong>
                      {calcModalRecord.validationErrors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── 8. PRE-COMMIT CONFIRMATION MODAL ─── */}
        {showCommitModal && (
          <div
            onClick={() => setShowCommitModal(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-[#FFE2B8]" />
                  <h3 className="font-black text-sm text-white">Confirm Period Lock & Commit</h3>
                </div>
                <button
                  onClick={() => setShowCommitModal(false)}
                  className="p-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium">
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
                  <strong className="font-extrabold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle size={16} />
                    <span>IMPORTANT PERIOD LOCK WARNING:</span>
                  </strong>
                  <p>
                    Once committed, August {selectedYear} will be locked for normal Dynamic Calculation and Pre-Calculated Upload. Reopening requires admin authorization.
                  </p>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <div className="flex justify-between">
                    <span>Selected Parties:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRecordIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Sales NRS:</span>
                    <span className="font-mono font-bold text-slate-900">₹{Math.round(totalNrs).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Discount:</span>
                    <span className="font-mono font-bold text-slate-700">₹{Math.round(totalDiscount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-blue-900 font-bold pt-2 border-t border-slate-200">
                    <span>Gross Incentive:</span>
                    <span className="font-mono">₹{Math.round(totalGrossIncentive).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#053D3A] font-black text-sm pt-2 border-t border-slate-200">
                    <span>Final Payable Incentive:</span>
                    <span className="font-mono">₹{Math.round(totalFinalIncentive).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCommitModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitPeriod}
                    disabled={committing}
                    className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-60"
                  >
                    {committing ? 'Locking Period...' : 'Confirm & Lock Period'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 9. PERIOD REOPEN MODAL ─── */}
        {showReopenModal && (
          <div
            onClick={() => setShowReopenModal(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div className="flex items-center gap-2">
                  <Unlock size={18} className="text-amber-400" />
                  <h3 className="font-black text-sm text-white">Reopen Incentive Period</h3>
                </div>
                <button
                  onClick={() => setShowReopenModal(false)}
                  className="p-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium">
                <p className="text-slate-600">
                  Reopening will unlock August {selectedYear} for recalculation. A mandatory audit log will be created.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Reopen Reason (Mandatory Audit Requirement)
                  </label>
                  <textarea
                    rows={3}
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Provide detailed business justification for unlocking this period..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowReopenModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReopenPeriod}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-sm cursor-pointer"
                  >
                    Reopen Period
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 10. BANK PAYOUT EXCEL UPLOAD MODAL ─── */}
        {showPayoutModal && (
          <div
            onClick={() => setShowPayoutModal(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-emerald-400" />
                  <h3 className="font-black text-sm text-white">Upload Bank Incentive Transfer Excel</h3>
                </div>
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="p-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium">
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 space-y-1">
                  <strong className="font-extrabold flex items-center gap-1.5 text-blue-800">
                    <Info size={16} />
                    <span>Bank Payout Reconciliation Module:</span>
                  </strong>
                  <p className="text-[11px] leading-relaxed">
                    Upload the Bank Incentive Transfer file fetched from bank portal (e.g. <code className="font-mono bg-blue-100 px-1 rounded">May'2026.xlsx</code>). The module matches Party Codes from <strong>Column I (Debit narration)</strong> and updates payout amounts, dates, account numbers, IFSC, UTR numbers, and status in the Committed Register.
                  </p>
                </div>

                {/* Period Selector (Month & Year) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Month</label>
                    <select
                      value={payoutMonth}
                      onChange={(e) => setPayoutMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    >
                      {MONTH_NAMES_SHORT.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {name} ({idx + 1})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Year</label>
                    <select
                      value={payoutYear}
                      onChange={(e) => setPayoutYear(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#053D3A]"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                    </select>
                  </div>
                </div>

                {/* File Dropzone */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Bank Payout Excel File</label>
                  <div className="border-2 border-dashed border-slate-300 hover:border-[#053D3A] rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setPayoutFile(e.target.files[0]);
                          setPayoutResult(null);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <FileSpreadsheet size={28} className="mx-auto text-[#053D3A] mb-1" />
                    {payoutFile ? (
                      <div>
                        <p className="font-bold text-slate-900">{payoutFile.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{(payoutFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-slate-700">Click or Drag & Drop Excel File</p>
                        <p className="text-[10px] text-slate-400">Supports .xlsx / .xls formats</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reconciliation Result Card */}
                {payoutResult && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-950">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                      <CheckCircle2 size={16} />
                      <span>Bank Reconciliation Complete!</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-1">
                      <div className="p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                        <span className="block text-[10px] text-slate-500 uppercase">File Rows</span>
                        <span className="font-mono text-slate-900 font-black">{payoutResult.totalRows}</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                        <span className="block text-[10px] text-emerald-600 uppercase">Matched</span>
                        <span className="font-mono text-emerald-700 font-black">{payoutResult.matchedCount}</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-blue-100 shadow-2xs">
                        <span className="block text-[10px] text-blue-600 uppercase">Auto-Created</span>
                        <span className="font-mono text-blue-700 font-black">{payoutResult.autoCreatedCount || 0}</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                        <span className="block text-[10px] text-indigo-600 uppercase">Credit Party</span>
                        <span className="font-mono text-indigo-700 font-black">{payoutResult.creditPartyCount || 0}</span>
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between text-xs font-bold px-3">
                      <span className="text-slate-600">Total Transferred Payout:</span>
                      <span className="font-mono text-emerald-700 font-black text-sm">₹{Math.round(payoutResult.totalTransferred).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setShowPayoutModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleUploadPayoutFile}
                    disabled={isUploadingPayout || !payoutFile}
                    className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  >
                    {isUploadingPayout ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Processing & Matching...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Upload & Reconcile</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function IncentiveGovernorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#053D3A] font-bold">Loading Incentive Governor...</div>}>
      <IncentiveGovernorContent />
    </Suspense>
  );
}
