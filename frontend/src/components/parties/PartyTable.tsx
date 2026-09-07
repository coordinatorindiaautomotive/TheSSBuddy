'use client';
import React, { memo } from 'react';
import { ArrowUpDown, RefreshCw, Building2, Percent, Sliders, AlertTriangle, Edit, Eye, MoreVertical } from 'lucide-react';
import { Badge, Pagination } from '@/components/ui';
import { formatShortPartyType, getTypeBadgeStyle } from './partyUtils';

interface PartyTableProps {
  displayedList: any[];
  filteredCount: number;
  isLoading: boolean;
  selectedRows: Set<string>;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
  isSuperAdmin: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleRowSelect: (id: string) => void;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
  onEditParty: (party: any) => void;
  onPreviewParty: (party: any) => void;
  onOpenActionMenu: (e: React.MouseEvent<HTMLButtonElement>, party: any) => void;
}

export const PartyTable: React.FC<PartyTableProps> = memo(({
  displayedList,
  filteredCount,
  isLoading,
  selectedRows,
  sortField,
  sortOrder,
  currentPage,
  pageSize,
  isSuperAdmin,
  onSelectAll,
  onToggleRowSelect,
  onSort,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  onEditParty,
  onPreviewParty,
  onOpenActionMenu,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 relative overflow-hidden">
      <div className="w-full max-h-[72vh] overflow-y-auto pb-20">
        <table className="w-full text-xs text-center align-middle border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-20 bg-[#003366] text-white select-none shadow-sm border-b-[2.5px] border-[#ED1C24]">
            <tr className="border-b border-slate-800">
              <th className="px-2 py-3 text-center align-middle border-r border-slate-700/60 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={displayedList.length > 0 && selectedRows.size === displayedList.length}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-slate-600 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </th>
              <th className="px-1.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold text-slate-300 uppercase whitespace-nowrap">#</th>

              <th onClick={() => onSort('location')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'location' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>LOC</span>
                  <ArrowUpDown size={11} className={sortField === 'location' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('code')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'code' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>CODE</span>
                  <ArrowUpDown size={11} className={sortField === 'code' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('originalCode')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'originalCode' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>ORIG CODE</span>
                  <ArrowUpDown size={11} className={sortField === 'originalCode' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('name')} className={`px-3 py-3 text-left align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'name' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center gap-1">
                  <span>PARTY NAME</span>
                  <ArrowUpDown size={11} className={sortField === 'name' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('type')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'type' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>TYPE</span>
                  <ArrowUpDown size={11} className={sortField === 'type' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('executive')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'executive' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>EXEC</span>
                  <ArrowUpDown size={11} className={sortField === 'executive' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('rule')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'rule' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>RULE</span>
                  <ArrowUpDown size={11} className={sortField === 'rule' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('phone')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'phone' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>MOBILE</span>
                  <ArrowUpDown size={11} className={sortField === 'phone' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('accHolder')} className={`px-3 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'accHolder' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>ACC HOLDER</span>
                  <ArrowUpDown size={11} className={sortField === 'accHolder' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('bankAcc')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'bankAcc' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>ACC NO</span>
                  <ArrowUpDown size={11} className={sortField === 'bankAcc' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('ifsc')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'ifsc' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>IFSC</span>
                  <ArrowUpDown size={11} className={sortField === 'ifsc' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('bankBranch')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'bankBranch' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>BRANCH</span>
                  <ArrowUpDown size={11} className={sortField === 'bankBranch' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('pan')} className={`px-2.5 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap ${sortField === 'pan' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>PAN</span>
                  <ArrowUpDown size={11} className={sortField === 'pan' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th onClick={() => onSort('status')} className={`px-3 py-3 text-center align-middle border-r border-slate-700/60 text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition whitespace-nowrap min-w-[80px] ${sortField === 'status' ? 'text-amber-300' : 'text-slate-200'}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>STATUS</span>
                  <ArrowUpDown size={11} className={sortField === 'status' ? 'text-amber-400 font-bold' : 'opacity-50 shrink-0'} />
                </div>
              </th>

              <th className="px-3 py-3 text-center align-middle text-xs font-bold text-slate-300 uppercase whitespace-nowrap min-w-[90px]">ACT</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white font-medium text-slate-800 align-middle text-xs">
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
                      onClick={onResetFilters}
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
                const bankName = p.bankName && p.bankName !== '-' ? p.bankName : '';
                const branchName = (p.branchName && p.branchName !== '-') ? p.branchName : (p.bankBranch && p.bankBranch !== '-') ? p.bankBranch : '';
                const bankBranch = bankName && branchName ? `${bankName} (${branchName})` : bankName || branchName || '-';
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
                    <td className="px-2 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleRowSelect(rowId)}
                        className="rounded text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>

                    {/* Index */}
                    <td className="px-1.5 py-2.5 text-center align-middle border-r border-slate-200/80 font-medium text-slate-500 text-xs whitespace-nowrap">
                      {index + 1}
                    </td>

                    {/* Location */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 text-xs whitespace-nowrap">
                      <span className="inline-flex items-center justify-center font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-xs shadow-2xs" title={location}>
                        {location}
                      </span>
                    </td>

                    {/* Party Code badge */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50/90 border border-blue-200/90 text-blue-700 font-mono text-xs font-bold shadow-2xs" title={code}>
                        {code}
                      </span>
                    </td>
                    
                    {/* Original Code badge */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50/90 border border-amber-200/90 text-amber-900 font-mono text-xs font-extrabold shadow-2xs" title={`Original Code: ${origCode}`}>
                        {origCode}
                      </span>
                    </td>

                    {/* Party Name */}
                    <td className="px-3 py-2.5 text-left align-middle border-r border-slate-200/80 font-semibold text-slate-900 text-xs uppercase tracking-tight whitespace-nowrap hover:text-blue-600 transition-colors" title={name}>
                      {name}
                    </td>

                    {/* Type badge */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border shadow-2xs ${getTypeBadgeStyle(category)}`} title={`Party Type: ${rawCategory}`}>
                        {category}
                      </span>
                    </td>

                    {/* Executive */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-xs whitespace-nowrap" title={executive}>
                      {executive}
                    </td>

                    {/* Incentive Type pill */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      {isFixed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 shadow-2xs">
                          <Percent size={10} />
                          {rule}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs">
                          <Sliders size={10} />
                          Slab
                        </span>
                      )}
                    </td>

                    {/* Mobile */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-slate-700 text-xs whitespace-nowrap" title={phone}>
                      {phone}
                    </td>

                    {/* Account Holder */}
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-xs whitespace-nowrap" title={accHolder}>
                      {accHolder}
                    </td>

                    {/* Bank Account */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap">
                      {bankAcc === 'Pending Setup' ? (
                        <button
                          type="button"
                          onClick={() => onEditParty(p)}
                          title="Click to Add Bank Details"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 transition cursor-pointer shadow-2xs"
                        >
                          <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                          <span>Pending</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditParty(p)}
                          title="Click to Edit Bank Details"
                          className="font-mono text-slate-800 hover:text-blue-600 font-semibold text-xs hover:underline"
                        >
                          <span>{bankAcc}</span>
                        </button>
                      )}
                    </td>

                    {/* IFSC Code */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-xs text-slate-700 whitespace-nowrap" title={ifsc}>
                      {ifsc}
                    </td>

                    {/* Bank Branch */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 text-slate-700 font-medium text-xs whitespace-nowrap" title={bankBranch}>
                      {bankBranch}
                    </td>

                    {/* PAN NO */}
                    <td className="px-2.5 py-2.5 text-center align-middle border-r border-slate-200/80 font-mono font-medium text-xs whitespace-nowrap">
                      {pan !== '-' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 font-mono text-xs font-bold shadow-2xs" title={pan}>
                          {pan}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center align-middle border-r border-slate-200/80 whitespace-nowrap min-w-[80px]">
                      <Badge variant={p.isActive !== false ? 'success' : 'danger'} dot size="sm">
                        {p.isActive !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>

                    {/* Actions Menu */}
                    <td className="px-3 py-2.5 text-center align-middle whitespace-nowrap min-w-[90px]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditParty(p)}
                          title={isSuperAdmin ? "Edit Party Master" : "Set Bank & KYC Details"}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition font-bold cursor-pointer"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPreviewParty(p)}
                          title="Quick Preview"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onOpenActionMenu(e, p)}
                          title="Party Action Menu"
                          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 transition cursor-pointer"
                        >
                          <MoreVertical size={15} />
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

      <Pagination
        currentPage={currentPage}
        totalItems={filteredCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[25, 50, 100, 200]}
        itemName="parties"
      />
    </div>
  );
});

PartyTable.displayName = 'PartyTable';
