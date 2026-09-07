'use client';
import React, { memo } from 'react';
import { Search, Download, CheckCircle2 } from 'lucide-react';
import { Badge, Pagination } from '@/components/ui';
import { IncentiveRecord, MONTH_NAMES_SHORT } from './types';

interface GovernorTableProps {
  records: IncentiveRecord[];
  paginatedRecords: IncentiveRecord[];
  filteredCount: number;
  totalMasterCount: number;
  transactingPartiesCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterActivity: 'TRANSACTING' | 'ALL' | 'ZERO_SALES';
  setFilterActivity: (val: 'TRANSACTING' | 'ALL' | 'ZERO_SALES') => void;
  filterBranch: string;
  setFilterBranch: (b: string) => void;
  filterPartyType: string;
  setFilterPartyType: (t: string) => void;
  availableBranches: string[];
  availablePartyTypes: string[];
  isBranchUser: boolean;
  userBranch: string | null;
  isSuperAdmin: boolean;
  isLocked: boolean;
  selectedMonth: number;
  selectedYear: number;
  selectedRecordIds: string[];
  setSelectedRecordIds: React.Dispatch<React.SetStateAction<string[]>>;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onExportExcel: () => void;
  onOpenCommitModal: () => void;
  onViewCalc: (rec: IncentiveRecord) => void;
}

const renderIncentiveRuleBadge = (rec: IncentiveRecord) => {
  const slab = (rec.applicableSlab || '').trim();
  const rate = rec.applicableRate;

  let label = '0.0%';
  if (slab && slab !== '' && slab !== 'N/A' && slab !== 'null' && slab !== 'undefined') {
    label = slab;
  } else if (rate !== undefined && rate !== null && rate > 0) {
    label = `${Number(rate).toFixed(1)}%`;
  } else if (rec.incentiveType && rec.incentiveType.includes('%')) {
    label = rec.incentiveType;
  }

  const isZero = label === '0%' || label === '0.0%' || label === '0.00%' || label === '0';

  if (isZero) {
    return (
      <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded select-none">
        0.0%
      </span>
    );
  }

  return (
    <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs select-none">
      {label}
    </span>
  );
};

export const GovernorTable: React.FC<GovernorTableProps> = memo(({
  records,
  paginatedRecords,
  filteredCount,
  totalMasterCount,
  transactingPartiesCount,
  searchQuery,
  setSearchQuery,
  filterActivity,
  setFilterActivity,
  filterBranch,
  setFilterBranch,
  filterPartyType,
  setFilterPartyType,
  availableBranches,
  availablePartyTypes,
  isBranchUser,
  userBranch,
  isSuperAdmin,
  isLocked,
  selectedMonth,
  selectedYear,
  selectedRecordIds,
  setSelectedRecordIds,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onExportExcel,
  onOpenCommitModal,
  onViewCalc,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
      <div className="p-4 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, name, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">View:</span>
            <select
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value as any)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
            >
              <option value="TRANSACTING">Active Transacting Parties ({transactingPartiesCount})</option>
              <option value="ALL">All Master Parties ({totalMasterCount})</option>
              <option value="ZERO_SALES">Zero-Sales Parties ({totalMasterCount - transactingPartiesCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">Branch:</span>
            <select
              value={isBranchUser && userBranch ? userBranch : filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              disabled={Boolean(isBranchUser && userBranch)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer disabled:opacity-75 text-xs"
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

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">Type:</span>
            <select
              value={filterPartyType}
              onChange={(e) => setFilterPartyType(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
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

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onExportExcel}
            disabled={filteredCount === 0}
            className="px-4.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 border border-emerald-600/40"
          >
            <Download size={16} className="text-white" />
            <span>Export Formatted Excel</span>
          </button>

          {isSuperAdmin && !isLocked && (
            <button
              onClick={onOpenCommitModal}
              disabled={filteredCount === 0}
              className="px-4.5 py-2.5 bg-[#003366] hover:bg-[#002B55] text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60 border border-teal-600/40"
            >
              <CheckCircle2 size={16} className="text-white" />
              <span>Commit & Lock Incentive Register</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[60vh]">
        <table className="table-enterprise text-left">
          <thead className="sticky top-0 z-20 select-none">
            <tr>
              <th className="px-3 py-2.5 text-center border-r border-white/10 w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedRecordIds.length > 0 &&
                    selectedRecordIds.length === filteredCount
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRecordIds(records.map((r) => r.id || r.originalPartyCode));
                    } else {
                      setSelectedRecordIds([]);
                    }
                  }}
                  className="rounded accent-[#003366] cursor-pointer"
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
          <tbody className="divide-y divide-slate-200 font-medium text-xs">
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
                      className="rounded accent-[#003366] cursor-pointer"
                    />
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-[#003366]">
                      {MONTH_NAMES_SHORT[selectedMonth - 1] || 'Jun'} {selectedYear}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-[#003366] border-r border-slate-200">
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
                    {renderIncentiveRuleBadge(rec)}
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-mono font-black text-[#003366] border-r border-slate-200">
                    ₹{Math.round(rec.finalIncentive).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-center border-r border-slate-200">
                    <Badge
                      variant={rec.validationStatus === 'VALID' ? 'success' : 'warning'}
                      dot
                      size="sm"
                    >
                      {rec.validationStatus === 'VALID' ? 'Valid' : 'Warning'}
                    </Badge>
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <button
                      onClick={() => onViewCalc(rec)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-[#002B55] hover:text-white text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition cursor-pointer"
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

      <Pagination
        currentPage={currentPage}
        totalItems={filteredCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[50, 100, 250, 500]}
        itemName="records"
      />
    </div>
  );
});

GovernorTable.displayName = 'GovernorTable';
