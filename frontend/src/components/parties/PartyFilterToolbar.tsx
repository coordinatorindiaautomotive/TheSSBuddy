'use client';
import React from 'react';
import { MapPin, Lock, UserCheck, Layers, Search, X, RotateCcw, RefreshCw, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui';

interface PartyFilterToolbarProps {
  locationFilter: string;
  setLocationFilter: (val: string) => void;
  executiveFilter: string;
  setExecutiveFilter: (val: string) => void;
  partyTypeFilter: string;
  setPartyTypeFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  pageSize: number;
  setPageSize: (val: number) => void;
  branchesList: string[];
  executivesList: string[];
  partyTypesList: string[];
  isBranchUser: boolean;
  userBranch: string | null;
  isSuperAdmin: boolean;
  isSyncing: boolean;
  isExporting: boolean;
  onResetFilters: () => void;
  onSync: () => void;
  onExport: () => void;
  onAddParty: () => void;
}

export const PartyFilterToolbar: React.FC<PartyFilterToolbarProps> = ({
  locationFilter,
  setLocationFilter,
  executiveFilter,
  setExecutiveFilter,
  partyTypeFilter,
  setPartyTypeFilter,
  searchQuery,
  setSearchQuery,
  pageSize,
  setPageSize,
  branchesList,
  executivesList,
  partyTypesList,
  isBranchUser,
  userBranch,
  isSuperAdmin,
  isSyncing,
  isExporting,
  onResetFilters,
  onSync,
  onExport,
  onAddParty,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-wrap items-center gap-3 text-slate-800">
      {/* Location Dropdown */}
      <div className="flex-1 min-w-[150px]">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          <MapPin size={13} className="text-[#0052CC]" /> LOCATION
        </label>
        {isBranchUser && userBranch ? (
          <div className="w-full px-3 py-2 bg-amber-400 text-slate-950 border border-amber-300 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-2xs">
            <Lock size={13} className="text-slate-950" />
            <span>Branch: {userBranch}</span>
          </div>
        ) : (
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="select-enterprise w-full text-xs"
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
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          <UserCheck size={13} className="text-[#0052CC]" /> EXECUTIVE
        </label>
        <select
          value={executiveFilter}
          onChange={(e) => setExecutiveFilter(e.target.value)}
          className="select-enterprise w-full text-xs"
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
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Layers size={13} className="text-[#0052CC]" /> PARTY TYPE
        </label>
        <select
          value={partyTypeFilter}
          onChange={(e) => setPartyTypeFilter(e.target.value)}
          className="select-enterprise w-full text-xs"
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
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Search size={13} className="text-[#0052CC]" /> SEARCH
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Code, Name, Mobile, GST..."
            className="input-enterprise w-full placeholder-slate-400 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Show count dropdown */}
      <div className="w-24">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SHOW</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="input-enterprise w-full cursor-pointer text-xs"
        >
          <option value={25} className="bg-white text-slate-900 font-bold">25</option>
          <option value={50} className="bg-white text-slate-900 font-bold">50</option>
          <option value={100} className="bg-white text-slate-900 font-bold">100</option>
          <option value={0} className="bg-white text-slate-900 font-bold">All</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-end gap-2 pt-4 sm:pt-0">
        <Button
          variant="secondary"
          size="md"
          onClick={onResetFilters}
          title="Reset Filters"
          icon={<RotateCcw size={14} className="text-slate-500" />}
        />

        {isSuperAdmin && (
          <Button
            variant="secondary"
            size="md"
            onClick={onSync}
            disabled={isSyncing}
            isLoading={isSyncing}
            title="Sync Party Master from Sales"
            icon={<RefreshCw size={14} className="text-emerald-600" />}
          />
        )}

        <Button
          variant="secondary"
          size="md"
          onClick={onExport}
          disabled={isExporting}
          isLoading={isExporting}
          title="Export filtered records with rich formatting to Excel"
          icon={<Download size={14} className="text-slate-600" />}
        >
          <span className="hidden sm:inline">Export</span>
        </Button>

        {isSuperAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={onAddParty}
            icon={<Plus size={14} />}
          >
            Party
          </Button>
        )}
      </div>
    </div>
  );
};
