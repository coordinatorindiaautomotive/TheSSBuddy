'use client';
import React, { memo } from 'react';
import { Search, Upload, Download } from 'lucide-react';
import { Pagination } from '@/components/ui';
import { PeriodMultiSelectDropdown } from './PeriodMultiSelectDropdown';
import { IncentiveRecord, MONTH_NAMES_SHORT } from './types';

interface GovernorRegisterViewProps {
  paginatedRecords: IncentiveRecord[];
  filteredCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  availablePeriods: { m: number; y: number; label: string; hasData?: boolean }[];
  selectedPeriodKeys: string[];
  setSelectedPeriodKeys: (keys: string[]) => void;
  filterBranch: string;
  setFilterBranch: (b: string) => void;
  filterPayoutStatus: string;
  setFilterPayoutStatus: (s: string) => void;
  availableBranches: string[];
  isBranchUser: boolean;
  userBranch: string | null;
  isSuperAdmin: boolean;
  selectedMonth: number;
  selectedYear: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onOpenPayoutModal: () => void;
  onExportExcel: () => void;
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

export const GovernorRegisterView: React.FC<GovernorRegisterViewProps> = memo(({
  paginatedRecords,
  filteredCount,
  searchQuery,
  setSearchQuery,
  availablePeriods,
  selectedPeriodKeys,
  setSelectedPeriodKeys,
  filterBranch,
  setFilterBranch,
  filterPayoutStatus,
  setFilterPayoutStatus,
  availableBranches,
  isBranchUser,
  userBranch,
  isSuperAdmin,
  selectedMonth,
  selectedYear,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenPayoutModal,
  onExportExcel,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
      <div className="p-4 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
            />
          </div>

          <PeriodMultiSelectDropdown
            availablePeriods={availablePeriods}
            selectedPeriodKeys={selectedPeriodKeys}
            setSelectedPeriodKeys={setSelectedPeriodKeys}
            onlyWithData={true}
          />

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
                    <option key={b} value={b}>{b}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">Payout Status:</span>
            <select
              value={filterPayoutStatus}
              onChange={(e) => setFilterPayoutStatus(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
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
              onClick={onOpenPayoutModal}
              className="px-4 py-2 bg-[#003366] hover:bg-[#074D49] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer border border-[#003366]/40 shrink-0"
            >
              <Upload size={15} />
              <span>Upload Bank Transfer Excel</span>
            </button>
          )}

          <button
            onClick={onExportExcel}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer border border-emerald-600/40 shrink-0"
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
          <tbody className="divide-y divide-slate-200 font-medium text-xs">
            {paginatedRecords.map((rec, idx) => {
              const rowNumber = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr key={rec.id || idx} className="hover:bg-slate-50 transition">
                  <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-slate-600 border-r border-slate-200">{rowNumber}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-[#003366]">
                      {MONTH_NAMES_SHORT[(rec.month || selectedMonth) - 1] || 'Jun'} {rec.year || selectedYear}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-bold font-mono text-[#003366] border-r border-slate-200">{rec.originalPartyCode}</td>
                  <td className="px-3.5 py-2.5 text-left align-middle font-bold text-slate-900 border-r border-slate-200">{rec.partyName}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-bold text-slate-800 border-r border-slate-200">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">{rec.baseBranch}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle text-slate-700 border-r border-slate-200">{rec.partyType}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-slate-900 border-r border-slate-200">₹{Math.round(rec.nrs).toLocaleString()}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-mono text-slate-600 border-r border-slate-200">₹{Math.round(rec.totalDiscount).toLocaleString()}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                    {renderIncentiveRuleBadge(rec)}
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-mono font-black text-[#003366] border-r border-slate-200">₹{Math.round(rec.finalIncentive).toLocaleString()}</td>
                  <td className="px-3.5 py-2.5 text-center align-middle border-r border-slate-200">
                    {rec.payoutStatus ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                        ['Success', 'Paid'].includes(rec.payoutStatus)
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : rec.payoutStatus === 'Credit Party'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
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
                          <div className="font-bold text-slate-900 text-xs mb-0.5">{rec.accountHolder}</div>
                        )}
                        <div className="font-mono font-bold text-slate-700">{rec.accountNo || '-'}</div>
                        <div className="font-mono text-xs text-slate-500 font-semibold">{rec.ifscCode || '-'}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-3.5 py-2.5 text-center align-middle font-mono font-bold text-blue-900 whitespace-nowrap">
                    {rec.utrNo || '-'}
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

GovernorRegisterView.displayName = 'GovernorRegisterView';
