'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import {
  Sliders, SlidersHorizontal, Zap, Lock, Unlock, CheckCircle2,
  AlertTriangle, RefreshCw, Download, Upload,
  Building2, Tag, Calculator, History, UserCheck, BookOpen, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { StatCard } from '@/components/ui';
import {
  GovernorRule,
  IncentiveRecord,
  MONTH_NAMES_SHORT,
  PeriodMultiSelectDropdown,
  GovernorRulesModal,
  CalculationBreakdownModal,
  CommitPeriodModal,
  ReopenPeriodModal,
  BankPayoutUploadModal,
  GovernorTable,
  GovernorRegisterView,
} from '@/components/governor';

function IncentiveGovernorContent() {
  const { isSuperAdmin, isBranchUser, userBranch } = useAuth();
  const searchParams = useSearchParams();

  // Dynamic Masters State
  const [availableBranches, setAvailableBranches] = useState<string[]>([
    'ALW', 'BER', 'BGI', 'BSE', 'BWI', 'CR9', 'DUS', 'F33', 'GRL', 'HDN',
    'HMR', 'HUH', 'ISN', 'JGT', 'JNU', 'JPD', 'JSK', 'KNO', 'LQU', 'NBT',
    'OR7', 'PKT', 'PPH', 'PSS', 'RQL', 'SDH', 'SGH', 'SGN', 'SJG', 'SKF',
    'SKR', 'STO', 'TNG', 'UTD', 'VBZ'
  ]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['AA', 'AG', 'M', 'T']);
  const [availablePartyTypes, setAvailablePartyTypes] = useState<string[]>([
    'CO-DEALER', 'CO-DISTRIBUTOR', 'INDEPENDENT WORKSHOP', 'MASS', 'TRADER/RETAILER', 'WALK-IN CUSTOMER'
  ]);
  const [availablePeriods, setAvailablePeriods] = useState<{ m: number; y: number; label: string; hasData?: boolean }[]>([
    { m: 6, y: 2026, label: 'Jun 2026', hasData: true },
    { m: 5, y: 2026, label: 'May 2026', hasData: true },
  ]);

  const [selectedPeriodKeys, setSelectedPeriodKeys] = useState<string[]>([`${new Date().getMonth() + 1}-${new Date().getFullYear()}`]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [processingMethod, setProcessingMethod] = useState<'DYNAMIC' | 'PRE_CALCULATED'>('DYNAMIC');

  // Governor rules state
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

  const [periodStatus, setPeriodStatus] = useState<any>({
    status: 'NOT_PROCESSED',
    processingMethod: 'DYNAMIC',
  });
  const [records, setRecords] = useState<IncentiveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'GOVERNOR' | 'REGISTER'>(isSuperAdmin ? 'GOVERNOR' : 'REGISTER');

  useEffect(() => {
    if (!isSuperAdmin) {
      setActiveTab('REGISTER');
    }
  }, [isSuperAdmin]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterPartyType, setFilterPartyType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayoutStatus, setFilterPayoutStatus] = useState('ALL');
  const [filterActivity, setFilterActivity] = useState<'TRANSACTING' | 'ALL' | 'ZERO_SALES'>('TRANSACTING');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [calcModalRecord, setCalcModalRecord] = useState<IncentiveRecord | null>(null);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [preCalcFile, setPreCalcFile] = useState<File | null>(null);
  const [isUploadingPreCalc, setIsUploadingPreCalc] = useState(false);

  // Fetch Available Periods & Masters on Mount
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [resMasters, resPeriods] = await Promise.all([
          api.get('/incentive-governor/masters'),
          api.get('/incentive-governor/available-periods'),
        ]);

        if (resMasters.data) {
          const branchesList = resMasters.data.branches?.length ? resMasters.data.branches : availableBranches;
          const catsList = resMasters.data.categories?.length ? resMasters.data.categories : ['AA', 'AG', 'M', 'T'];
          const typesList = resMasters.data.partyTypes?.length ? resMasters.data.partyTypes : [
            'CO-DEALER', 'CO-DISTRIBUTOR', 'INDEPENDENT WORKSHOP', 'MASS', 'TRADER/RETAILER', 'WALK-IN CUSTOMER'
          ];
          setAvailableBranches(branchesList);
          setAvailableCategories(catsList);
          setAvailablePartyTypes(typesList);
          setRules(
            branchesList.map((b: string) => ({
              branch: b,
              categories: ['M', 'AA'],
              partyTypes: ['INDEPENDENT WORKSHOP'],
            }))
          );
        }

        if (resPeriods.data && resPeriods.data.length > 0) {
          setAvailablePeriods(resPeriods.data);
          const withData = resPeriods.data.filter((p: any) => p.hasData);
          if (withData.length > 0) {
            const sorted = [...withData].sort((a, b) => b.y !== a.y ? b.y - a.y : b.m - a.m);
            setSelectedPeriodKeys([`${sorted[0].m}-${sorted[0].y}`]);
            setSelectedMonth(sorted[0].m);
            setSelectedYear(sorted[0].y);
          }
        }
      } catch (err) {
        console.error('Error fetching governor masters/periods:', err);
      }
    };
    fetchMasters();
  }, []);

  // Sync tab from URL search parameters
  useEffect(() => {
    if (searchParams && searchParams.get('tab') === 'register') {
      setActiveTab('REGISTER');
    }
  }, [searchParams]);

  // Set default branch for branch users
  useEffect(() => {
    if (isBranchUser && userBranch && userBranch !== 'ALL') {
      setFilterBranch(userBranch);
    }
  }, [isBranchUser, userBranch]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterBranch, filterPartyType, filterStatus, filterPayoutStatus, filterActivity, selectedPeriodKeys, activeTab]);

  // Fetch Period Preview Data
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPeriodData(selectedPeriodKeys);
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedPeriodKeys, fetchPeriodData]);

  // Filtered Records & Statistics
  const filteredRecords = useMemo(() => records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      r.originalPartyCode.toLowerCase().includes(q) ||
      r.partyName.toLowerCase().includes(q) ||
      r.baseBranch.toLowerCase().includes(q);

    const effectiveBranch = (isBranchUser && userBranch) ? userBranch : filterBranch;
    const matchesBranch = effectiveBranch === 'ALL' || r.baseBranch === effectiveBranch;
    const matchesPartyType = filterPartyType === 'ALL' || r.partyType === filterPartyType;
    const matchesStatus = filterStatus === 'ALL' || r.validationStatus === filterStatus;
    const matchesActivity =
      filterActivity === 'ALL' ? true
      : filterActivity === 'TRANSACTING' ? r.nrs > 0
      : r.nrs === 0;
    const matchesPayoutStatus =
      filterPayoutStatus === 'ALL' ? true
      : filterPayoutStatus === 'Pending' ? (!r.payoutStatus || r.payoutStatus === 'Pending')
      : filterPayoutStatus === 'Success' ? ['Success', 'Paid'].includes(r.payoutStatus || '')
      : r.payoutStatus === filterPayoutStatus;

    return matchesSearch && matchesBranch && matchesPartyType && matchesStatus && matchesActivity && matchesPayoutStatus;
  }), [records, searchQuery, filterBranch, filterPartyType, filterStatus, filterActivity, filterPayoutStatus, isBranchUser, userBranch]);

  const transactingPartiesCount = useMemo(() => records.filter((r) => r.nrs > 0).length, [records]);
  const totalNrs = useMemo(() => filteredRecords.reduce((a, r) => a + r.nrs, 0), [filteredRecords]);
  const totalDiscount = useMemo(() => filteredRecords.reduce((a, r) => a + r.totalDiscount, 0), [filteredRecords]);
  const totalGrossIncentive = useMemo(() => filteredRecords.reduce((a, r) => a + r.grossIncentive, 0), [filteredRecords]);
  const totalFinalIncentive = useMemo(() => filteredRecords.reduce((a, r) => a + r.finalIncentive, 0), [filteredRecords]);
  const totalWarnings = useMemo(() => filteredRecords.filter((r) => r.validationStatus === 'WARNING').length, [filteredRecords]);

  // Payout Breakdown Summaries
  const payoutPaidSummary = useMemo(() => {
    const list = filteredRecords.filter((r) => ['Success', 'Paid', 'Credit Party'].includes(r.payoutStatus || ''));
    const amount = list.reduce((sum, r) => sum + (Number(r.transferredAmount) || Number(r.finalIncentive) || 0), 0);
    return { count: list.length, amount };
  }, [filteredRecords]);

  const payoutPendingSummary = useMemo(() => {
    const list = filteredRecords.filter((r) => !r.payoutStatus || r.payoutStatus === 'Pending' || r.payoutStatus === 'DRAFT');
    const amount = list.reduce((sum, r) => sum + (Number(r.finalIncentive) || 0), 0);
    return { count: list.length, amount };
  }, [filteredRecords]);

  const payoutFailedSummary = useMemo(() => {
    const list = filteredRecords.filter((r) => ['Failed', 'Reversed'].includes(r.payoutStatus || ''));
    const amount = list.reduce((sum, r) => sum + (Number(r.finalIncentive) || 0), 0);
    return { count: list.length, amount };
  }, [filteredRecords]);

  const paginatedRecords = useMemo(() => {
    if (pageSize === 0) return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Actions
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
      toast.error(err.response?.data?.message || 'Error executing DB calculation.');
    } finally {
      setCalculating(false);
    }
  };

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
        toast.success('Incentive Register COMMITTED & MONTH LOCKED successfully!', { icon: '🔒' });
        if (res.data.periodControl) setPeriodStatus(res.data.periodControl);
        setActiveTab('REGISTER');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error committing period.');
    } finally {
      setCommitting(false);
      setShowCommitModal(false);
    }
  };

  const handleReopenPeriod = async (reason: string) => {
    if (!reason || reason.trim().length < 5) {
      toast.error('Please enter a valid reason (min 5 characters) to reopen period.');
      return;
    }
    try {
      const res = await api.post('/incentive-governor/reopen', {
        year: selectedYear,
        month: selectedMonth,
        reopenedBy: 'SuperAdmin',
        reason: reason.trim(),
      });
      if (res.data) {
        toast.success('Incentive Period REOPENED for editing.', { icon: '🔓' });
        if (res.data.periodControl) setPeriodStatus(res.data.periodControl);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error reopening period.');
    } finally {
      setShowReopenModal(false);
    }
  };

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
      toast.error(err.response?.data?.message || 'Error processing pre-calculated file.', { id: 'precalc' });
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

  const handleExportToExcel = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      toast.error('No records available to export.');
      return;
    }
    try {
      const monthLabel = MONTH_NAMES_SHORT[selectedMonth - 1] || `Month-${selectedMonth}`;
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

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = [
        { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 35 }, { wch: 24 },
        { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 16 },
        { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 40 }
      ];

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

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Incentive Register');
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Period Audit Summary');

      const fileName = `Incentive_Governor_Register_${monthLabel}_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Successfully exported formatted Excel file: ${fileName}`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      toast.error('Failed to export Excel file.');
    }
  };

  const isLocked = periodStatus.status === 'COMMITTED' || periodStatus.status === 'LOCKED';

  return (
    <AppShell
      title={activeTab === 'REGISTER' ? "Committed Incentive Register" : "Incentive Governor & Processing Engine"}
      breadcrumb={activeTab === 'REGISTER' ? "Financial Register" : "Enterprise Operations"}
    >
      {/* Modals */}
      {showRulesModal && (
        <GovernorRulesModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          rules={rules}
          setRules={setRules}
          availableBranches={availableBranches}
          availableCategories={availableCategories}
          availablePartyTypes={availablePartyTypes}
          isLocked={isLocked}
        />
      )}

      {calcModalRecord && (
        <CalculationBreakdownModal
          record={calcModalRecord}
          onClose={() => setCalcModalRecord(null)}
        />
      )}

      {showCommitModal && (
        <CommitPeriodModal
          isOpen={showCommitModal}
          onClose={() => setShowCommitModal(false)}
          onCommit={handleCommitPeriod}
          committing={committing}
          selectedYear={selectedYear}
          selectedCount={selectedRecordIds.length}
          totalNrs={totalNrs}
          totalDiscount={totalDiscount}
          totalGrossIncentive={totalGrossIncentive}
          totalFinalIncentive={totalFinalIncentive}
        />
      )}

      {showReopenModal && (
        <ReopenPeriodModal
          isOpen={showReopenModal}
          onClose={() => setShowReopenModal(false)}
          onReopen={handleReopenPeriod}
          selectedYear={selectedYear}
        />
      )}

      {showPayoutModal && (
        <BankPayoutUploadModal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onSuccess={() => fetchPeriodData(selectedPeriodKeys)}
        />
      )}

      <div className="space-y-6 max-w-full">
        {/* 1. TOP HEADER STEPPER BAR (Governor Tab Only) */}
        {activeTab === 'GOVERNOR' && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-[#003366] text-cyan-400 shadow-2xs">
                    <Sliders size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-[#003366] tracking-tight">
                      Incentive Governor Control Center
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Multi-Branch Party Master Eligibility • DB-Level Aggregation • Month Lock Engine
                    </p>
                  </div>
                </div>
              </div>

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
                      ? 'bg-[#003366]/5 border-[#003366]/30 text-[#003366]'
                      : st.active
                      ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-bold font-mono opacity-80">{st.step}</span>
                  <span className="text-xs font-bold">{st.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1.5 NAVIGATION TAB BAR (Governor Tab Only) */}
        {activeTab === 'GOVERNOR' && (
          <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('GOVERNOR')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'GOVERNOR'
                    ? 'bg-[#003366] text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <SlidersHorizontal size={15} />
                <span>Incentive Governor & Calculation Engine</span>
              </button>

              <button
                onClick={() => setActiveTab('REGISTER')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer relative bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
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

            <div className="text-xs font-bold text-[#003366] px-3.5 py-1.5 bg-[#003366]/5 rounded-xl border border-[#003366]/10 hidden md:block">
              Governor Rules & Live Preview Engine
            </div>
          </div>
        )}

        {/* TAB 1: GOVERNOR VIEW */}
        {activeTab === 'GOVERNOR' && (
          <div className="space-y-6">
            {/* Period & Method Toolbar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <PeriodMultiSelectDropdown
                  availablePeriods={availablePeriods}
                  selectedPeriodKeys={selectedPeriodKeys}
                  setSelectedPeriodKeys={setSelectedPeriodKeys}
                />

                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setProcessingMethod('DYNAMIC')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      processingMethod === 'DYNAMIC'
                        ? 'bg-[#003366] text-white shadow-2xs'
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
                        ? 'bg-[#003366] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Method B: Pre-Calculated Upload
                  </button>
                </div>
              </div>
            </div>

            {/* Method A: Dynamic Rules Panel */}
            {processingMethod === 'DYNAMIC' && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#003366]/10 text-[#003366] font-bold">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                        <span>Governor Multi-Branch Configuration Rules</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
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
                        className="px-4.5 py-2.5 bg-[#003366] hover:bg-[#002B55] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm hover:shadow-md cursor-pointer border border-[#003366]/40"
                      >
                        <SlidersHorizontal size={15} className="text-cyan-400" />
                        <span>Configure Branch Rules ({rules.length} Branches)</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase mr-1">Active Branches:</span>
                    {rules.slice(0, 10).map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs font-bold text-[#003366]">
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
                      className="px-5 py-2.5 bg-gradient-to-r from-[#003366] to-[#085C57] hover:from-[#002B55] hover:to-[#0A6E68] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 shrink-0 border border-emerald-600/30"
                    >
                      {calculating ? (
                        <>
                          <RefreshCw size={16} className="animate-spin text-amber-300" />
                          <span>Aggregating DB Data...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={15} className="text-amber-300 fill-amber-300" />
                          <span>Run Governor Calculation</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Method B: Pre-Calculated Upload */}
            {processingMethod === 'PRE_CALCULATED' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-[#003366]" />
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

                <div className="border-2 border-dashed border-slate-300 hover:border-[#003366] rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer relative">
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
                  <Upload size={32} className="mx-auto text-[#003366] mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {preCalcFile ? preCalcFile.name : `Click or Drag & Drop Pre-Calculated Excel File for ${MONTH_NAMES_SHORT[selectedMonth - 1]} ${selectedYear}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Supports .XLSX, .XLS, or .CSV formats</p>
                  <button
                    type="button"
                    className="mt-4 px-5 py-2 bg-[#003366] hover:bg-[#002B55] text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer pointer-events-none"
                  >
                    {isUploadingPreCalc ? 'Uploading & Processing...' : 'Select File & Process Preview'}
                  </button>
                </div>
              </div>
            )}

            {/* Standardized Executive Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <StatCard
                title="Active Parties"
                value={filteredRecords.length.toLocaleString()}
                subtitle={`out of ${records.length.toLocaleString()} master`}
                icon={<UserCheck size={16} />}
              />
              <StatCard
                title="Total Sales NRS"
                value={`₹${Math.round(totalNrs).toLocaleString()}`}
                subtitle="Net real sales"
                icon={<Calculator size={16} />}
              />
              <StatCard
                title="Total Discount"
                value={`₹${Math.round(totalDiscount).toLocaleString()}`}
                subtitle="Reductions applied"
                icon={<Tag size={16} />}
              />
              <StatCard
                title="Gross Incentive"
                value={`₹${Math.round(totalGrossIncentive).toLocaleString()}`}
                subtitle="Calculated amount"
                icon={<Sliders size={16} />}
              />
              <StatCard
                title="Final Payable"
                value={`₹${Math.round(totalFinalIncentive).toLocaleString()}`}
                subtitle="Committed payable"
                icon={<CheckCircle2 size={16} />}
                trend={{ value: 'Payable', isPositive: true }}
              />
              <StatCard
                title="Validation Warnings"
                value={totalWarnings}
                subtitle={totalWarnings === 0 ? 'No issues flagged' : 'Pending resolution'}
                icon={<AlertTriangle size={16} />}
                trend={{ value: `${totalWarnings} Warnings`, isPositive: totalWarnings === 0 }}
              />
            </div>

            {/* Governor Datagrid Matrix */}
            <GovernorTable
              records={records}
              paginatedRecords={paginatedRecords}
              filteredCount={filteredRecords.length}
              totalMasterCount={records.length}
              transactingPartiesCount={transactingPartiesCount}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterActivity={filterActivity}
              setFilterActivity={setFilterActivity}
              filterBranch={filterBranch}
              setFilterBranch={setFilterBranch}
              filterPartyType={filterPartyType}
              setFilterPartyType={setFilterPartyType}
              availableBranches={availableBranches}
              availablePartyTypes={availablePartyTypes}
              isBranchUser={isBranchUser}
              userBranch={userBranch}
              isSuperAdmin={isSuperAdmin}
              isLocked={isLocked}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              selectedRecordIds={selectedRecordIds}
              setSelectedRecordIds={setSelectedRecordIds}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              onExportExcel={handleExportToExcel}
              onOpenCommitModal={() => setShowCommitModal(true)}
              onViewCalc={setCalcModalRecord}
            />
          </div>
        )}

        {/* TAB 2: COMMITTED REGISTER VIEW */}
        {activeTab === 'REGISTER' && (
          <div className="space-y-6">
            {/* 2-Tier Executive Summary KPI Cards */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Transacting Parties</span>
                  <p className="text-lg font-bold text-[#003366] mt-1 font-mono">{filteredRecords.length.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">out of {records.length.toLocaleString()} Master Parties</p>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales NRS</span>
                  <p className="text-lg font-bold text-slate-900 mt-1 font-mono">₹{Math.round(totalNrs).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">Selected turnover</p>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Discount</span>
                  <p className="text-lg font-bold text-slate-700 mt-1 font-mono">₹{Math.round(totalDiscount).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">On-bill discounts</p>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Incentive</span>
                  <p className="text-lg font-bold text-blue-700 mt-1 font-mono">₹{Math.round(totalGrossIncentive).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">Pre-discount slab</p>
                </div>

                <div className="bg-[#FFF8EC] rounded-2xl p-3.5 border border-[#0052CC] shadow-2xs">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Final Net Payable</span>
                  <p className="text-lg font-bold text-[#003366] mt-1 font-mono">₹{Math.round(totalFinalIncentive).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-amber-700 mt-0.5">Net payable incentive</p>
                </div>
              </div>

              {/* Settlement Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Transferred & Settled
                    </span>
                    <p className="text-lg font-bold text-emerald-900 mt-1 font-mono">
                      ₹{Math.round(payoutPaidSummary.amount).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">
                      {payoutPaidSummary.count.toLocaleString()} Parties Paid / Credited
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300 shrink-0 font-bold">
                    ✓
                  </div>
                </div>

                <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      Pending Payout
                    </span>
                    <p className="text-lg font-bold text-amber-900 mt-1 font-mono">
                      ₹{Math.round(payoutPendingSummary.amount).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-amber-700 mt-0.5">
                      {payoutPendingSummary.count.toLocaleString()} Parties Pending Settlement
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300 shrink-0 font-bold">
                    ⏳
                  </div>
                </div>

                <div className="bg-rose-50/70 rounded-2xl p-3.5 border border-rose-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      Failed / Reversed
                    </span>
                    <p className="text-lg font-bold text-rose-900 mt-1 font-mono">
                      ₹{Math.round(payoutFailedSummary.amount).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-rose-700 mt-0.5">
                      {payoutFailedSummary.count.toLocaleString()} Parties Failed / Rejected
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-300 shrink-0 font-bold">
                    ✕
                  </div>
                </div>
              </div>
            </div>

            {/* Governor Register Datagrid */}
            <GovernorRegisterView
              paginatedRecords={paginatedRecords}
              filteredCount={filteredRecords.length}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              availablePeriods={availablePeriods}
              selectedPeriodKeys={selectedPeriodKeys}
              setSelectedPeriodKeys={setSelectedPeriodKeys}
              filterBranch={filterBranch}
              setFilterBranch={setFilterBranch}
              filterPayoutStatus={filterPayoutStatus}
              setFilterPayoutStatus={setFilterPayoutStatus}
              availableBranches={availableBranches}
              isBranchUser={isBranchUser}
              userBranch={userBranch}
              isSuperAdmin={isSuperAdmin}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              onOpenPayoutModal={() => setShowPayoutModal(true)}
              onExportExcel={handleExportToExcel}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function IncentiveGovernorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#003366] font-bold">Loading Incentive Governor...</div>}>
      <IncentiveGovernorContent />
    </Suspense>
  );
}
