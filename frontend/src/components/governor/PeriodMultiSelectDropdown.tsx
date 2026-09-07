'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { MONTH_NAMES_SHORT } from './types';

interface PeriodMultiSelectDropdownProps {
  availablePeriods: { m: number; y: number; label: string; hasData?: boolean }[];
  selectedPeriodKeys: string[];
  setSelectedPeriodKeys: (keys: string[]) => void;
  onlyWithData?: boolean;
}

export const PeriodMultiSelectDropdown: React.FC<PeriodMultiSelectDropdownProps> = ({
  availablePeriods,
  selectedPeriodKeys,
  setSelectedPeriodKeys,
  onlyWithData = false,
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

  const visiblePeriods = useMemo(() => {
    return (onlyWithData
      ? availablePeriods.filter((p) => p.hasData)
      : availablePeriods
    ).slice().sort((a, b) => (a.y !== b.y ? b.y - a.y : b.m - a.m));
  }, [availablePeriods, onlyWithData]);

  const distinctYears = useMemo(() => {
    const years = Array.from(new Set(visiblePeriods.map((p) => p.y)));
    return years.sort((a, b) => b - a);
  }, [visiblePeriods]);

  const [activeYear, setActiveYear] = useState<number>(() => {
    if (distinctYears.length > 0) return distinctYears[0];
    return new Date().getFullYear();
  });

  useEffect(() => {
    if (distinctYears.length > 0 && !distinctYears.includes(activeYear)) {
      setActiveYear(distinctYears[0]);
    }
  }, [distinctYears, activeYear]);

  const periodMap = useMemo(() => {
    const map = new Map<string, { m: number; y: number; label: string; hasData?: boolean }>();
    visiblePeriods.forEach((p) => {
      map.set(`${p.m}-${p.y}`, p);
    });
    return map;
  }, [visiblePeriods]);

  const allKeys = useMemo(() => visiblePeriods.map((p) => `${p.m}-${p.y}`), [visiblePeriods]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedPeriodKeys.includes(k));

  const displayText = useMemo(() => {
    if (selectedPeriodKeys.length === 0) return 'Select Periods';
    if (allSelected) return `All Periods (${allKeys.length})`;
    if (selectedPeriodKeys.length === 1) {
      const [m, y] = selectedPeriodKeys[0].split('-').map(Number);
      return `${MONTH_NAMES_SHORT[m - 1]} ${y}`;
    }

    const selectedYears = Array.from(new Set(selectedPeriodKeys.map((k) => k.split('-')[1])));
    if (selectedYears.length === 1) {
      return `${selectedYears[0]} (${selectedPeriodKeys.length} Mos)`;
    }

    return `${selectedPeriodKeys.length} Periods Selected`;
  }, [selectedPeriodKeys, allSelected, allKeys]);

  const handleSelectLatest = () => {
    const withData = visiblePeriods.filter((p) => p.hasData);
    if (withData.length > 0) {
      const latest = withData[0];
      setSelectedPeriodKeys([`${latest.m}-${latest.y}`]);
      setActiveYear(latest.y);
    }
  };

  const handleSelectCurrentFY = () => {
    const currentYear = new Date().getFullYear();
    const fyKeys = allKeys.filter((k) => {
      const [m, y] = k.split('-').map(Number);
      if (y === currentYear && m >= 4) return true;
      if (y === currentYear + 1 && m <= 3) return true;
      return false;
    });
    if (fyKeys.length > 0) {
      setSelectedPeriodKeys(fyKeys);
      setActiveYear(currentYear);
    } else {
      handleSelectLatest();
    }
  };

  const handleSelectLast6Months = () => {
    const withData = visiblePeriods.filter((p) => p.hasData);
    const top6 = withData.slice(0, 6).map((p) => `${p.m}-${p.y}`);
    if (top6.length > 0) {
      setSelectedPeriodKeys(top6);
      if (withData[0]) setActiveYear(withData[0].y);
    }
  };

  const handleToggleMonth = (m: number, y: number) => {
    const key = `${m}-${y}`;
    if (selectedPeriodKeys.includes(key)) {
      if (selectedPeriodKeys.length > 1) {
        setSelectedPeriodKeys(selectedPeriodKeys.filter((k) => k !== key));
      } else {
        toast('At least one period must remain selected.', { icon: 'ℹ️' });
      }
    } else {
      setSelectedPeriodKeys([...selectedPeriodKeys, key]);
    }
  };

  const handleToggleYear = (year: number, selectAll: boolean) => {
    const yearMonthKeys = Array.from({ length: 12 }, (_, idx) => `${idx + 1}-${year}`).filter((k) =>
      periodMap.has(k)
    );

    if (selectAll) {
      const newKeys = Array.from(new Set([...selectedPeriodKeys, ...yearMonthKeys]));
      setSelectedPeriodKeys(newKeys);
    } else {
      const remaining = selectedPeriodKeys.filter((k) => !yearMonthKeys.includes(k));
      if (remaining.length > 0) {
        setSelectedPeriodKeys(remaining);
      } else {
        if (yearMonthKeys[0]) setSelectedPeriodKeys([yearMonthKeys[0]]);
      }
    }
  };

  const getSelectedCountForYear = (year: number) => {
    return selectedPeriodKeys.filter((k) => k.endsWith(`-${year}`)).length;
  };

  const yearMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const activeYearSelectedCount = getSelectedCountForYear(activeYear);
  const activeYearAvailableMonths = yearMonths.filter((m) => periodMap.has(`${m}-${activeYear}`));
  const isAllActiveYearSelected =
    activeYearAvailableMonths.length > 0 &&
    activeYearAvailableMonths.every((m) => selectedPeriodKeys.includes(`${m}-${activeYear}`));

  return (
    <div className="relative inline-block text-left z-30" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-white border border-slate-300 hover:border-[#003366] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 shadow-2xs transition cursor-pointer w-full sm:w-auto"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-[#003366] shrink-0" />
          <span className="max-w-[140px] sm:max-w-[210px] truncate">{displayText}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-auto mt-2 w-[calc(100vw-32px)] sm:w-96 max-w-[380px] rounded-2xl bg-white border border-slate-200 shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={12} className="text-[#003366]" />
                Period Filter
              </span>
              <span className="text-xs font-bold text-slate-600 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {selectedPeriodKeys.length} Selected
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleSelectLatest}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition cursor-pointer"
              >
                Latest
              </button>
              <button
                type="button"
                onClick={handleSelectCurrentFY}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition cursor-pointer"
              >
                Current FY
              </button>
              <button
                type="button"
                onClick={handleSelectLast6Months}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition cursor-pointer"
              >
                Last 6 Mos
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriodKeys(allKeys)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition cursor-pointer ml-auto"
              >
                All ({allKeys.length})
              </button>
            </div>
          </div>

          <div className="px-3 pt-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {distinctYears.map((yr) => {
                const count = getSelectedCountForYear(yr);
                const isActive = yr === activeYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setActiveYear(yr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{yr}</span>
                    {count > 0 && (
                      <span
                        className={`text-xs font-mono px-1.5 py-0.2 rounded-full font-bold ${
                          isActive ? 'bg-[#0052CC] text-white' : 'bg-slate-300 text-slate-800'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span>FY / Year {activeYear}</span>
                <span className="text-xs font-medium text-slate-400">
                  ({activeYearSelectedCount} / {activeYearAvailableMonths.length} active)
                </span>
              </span>

              <button
                type="button"
                onClick={() => handleToggleYear(activeYear, !isAllActiveYearSelected)}
                className="text-xs font-bold text-[#003366] hover:underline cursor-pointer"
              >
                {isAllActiveYearSelected ? 'Clear Year' : `Select All ${activeYear}`}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {yearMonths.map((m) => {
                const key = `${m}-${activeYear}`;
                const period = periodMap.get(key);
                const isSelected = selectedPeriodKeys.includes(key);
                const hasData = period?.hasData;

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleToggleMonth(m, activeYear)}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center p-1 border transition-all cursor-pointer relative select-none ${
                      isSelected
                        ? 'bg-[#003366] text-white border-[#003366] shadow-xs scale-[1.02]'
                        : hasData
                        ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300'
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-400 border-slate-200/60'
                    }`}
                  >
                    <span className="text-xs font-bold tracking-tight">{MONTH_NAMES_SHORT[m - 1]}</span>
                    {hasData && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                          isSelected ? 'bg-emerald-400 ring-2 ring-[#003366]' : 'bg-emerald-500'
                        }`}
                        title="Register data available"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              <span className="font-mono text-slate-800">{selectedPeriodKeys.length}</span> mos selected
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 bg-[#003366] hover:bg-[#002B55] text-white font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
            >
              Done / Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
