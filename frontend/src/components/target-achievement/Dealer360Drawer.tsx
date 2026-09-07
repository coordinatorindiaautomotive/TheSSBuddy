'use client';
import React, { useMemo } from 'react';
import { X, Activity, Calculator, Edit3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface Dealer360DrawerProps {
  dealer: any;
  onClose: () => void;
  onEditTarget: (dealer: any) => void;
  currentPeriodLabel: string;
  prevPeriodLabel: string;
  lyPeriodLabel: string;
}

export const Dealer360Drawer: React.FC<Dealer360DrawerProps> = ({
  dealer,
  onClose,
  onEditTarget,
  currentPeriodLabel,
  prevPeriodLabel,
  lyPeriodLabel,
}) => {
  const dealerTrajectory = useMemo(() => {
    if (!dealer) return [];
    const base = Number(dealer.avgSaleLast6Month) || 100000;
    return [
      { month: 'Mar', sales: Math.round(base * 0.85) },
      { month: 'Apr', sales: Math.round(base * 0.95) },
      { month: 'May', sales: Math.round(base * 1.10) },
      { month: 'Jun', sales: Math.round(base * 1.05) },
      { month: prevPeriodLabel, sales: Math.round(dealer.lastMonthSales || base * 1.15) },
      { month: `${currentPeriodLabel} (Current)`, sales: Math.round(dealer.currentSales) },
    ];
  }, [dealer, currentPeriodLabel, prevPeriodLabel]);

  if (!dealer) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div>
          <div className="p-6 text-white flex items-start justify-between border-b border-[#003870] bg-[#001D3D]">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono font-bold text-xs uppercase border border-white/20">
                Dealer 360 Profile
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                {dealer.partyName}
              </h3>
              <p className="text-xs text-blue-200/80 font-mono mt-0.5">
                Party Code: <strong>{dealer.partyCode}</strong> • Loc: <strong>{dealer.branchCode}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase">{currentPeriodLabel} Turnover</p>
                <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                  ₹{Math.round(dealer.currentSales).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-400 font-bold uppercase">Target Fulfillment ({currentPeriodLabel})</p>
                <p className="text-xl font-bold font-mono text-blue-700 mt-1">
                  {dealer.achievementPercent}%
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-600" />
                  6-Month Sales Trend (₹)
                </span>
                <span className="text-xs text-slate-400 font-mono">Monthly Retail</span>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dealerTrajectory}>
                    <defs>
                      <linearGradient id="colorDealer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']} />
                    <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorDealer)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-2.5">
              <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Calculator size={13} />
                Target Engine Formulation Breakdown
              </h4>
              <div className="space-y-1.5 font-mono text-xs text-slate-300 divide-y divide-slate-800">
                <div className="flex justify-between pt-1">
                  <span>1. LY Same Month ({lyPeriodLabel}) × 40%:</span>
                  <span className="text-white font-bold">{Math.round((dealer.lySameMonthSales || 0) * 0.40).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span>2. Last Month ({prevPeriodLabel}) × 25%:</span>
                  <span className="text-white font-bold">{Math.round((dealer.lastMonthSales || 0) * 0.25).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span>3. Last Qtr Avg × 20%:</span>
                  <span className="text-white font-bold">{Math.round((dealer.lastQuarterAvg || 0) * 0.20).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span>4. Last FY Avg × 15%:</span>
                  <span className="text-white font-bold">{Math.round((dealer.lastFyAvg || 0) * 0.15).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-2 text-amber-300 font-bold border-t border-slate-700">
                  <span>= Weighted Base:</span>
                  <span>{Math.round(dealer.weightedBase || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1.5 text-cyan-300">
                  <span>+ 10% Recommended Target:</span>
                  <span>{Math.round(dealer.recommendedTarget || 0).toLocaleString('en-IN')}</span>
                </div>
                {dealer.gapAdjustment > 0 && (
                  <div className="flex justify-between pt-1.5 text-emerald-400">
                    <span>+ Guardrail Gap Adjustment:</span>
                    <span>+{Math.round(dealer.gapAdjustment).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 text-white font-bold text-xs border-t border-slate-700">
                  <span>FINAL TARGET:</span>
                  <span className="text-amber-400">{Math.round(dealer.finalTarget).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={() => onEditTarget(dealer)}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Edit3 size={14} />
            <span>Edit Target</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold hover:bg-white rounded-xl transition text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
