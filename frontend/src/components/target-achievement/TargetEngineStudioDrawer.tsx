'use client';
import React from 'react';
import { X, Calculator, SlidersHorizontal, Scale } from 'lucide-react';

interface TargetEngineStudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lyWeight: number;
  setLyWeight: (w: number) => void;
  lmWeight: number;
  setLmWeight: (w: number) => void;
  lqWeight: number;
  setLqWeight: (w: number) => void;
  lfyWeight: number;
  setLfyWeight: (w: number) => void;
  growthPercent: number;
  setGrowthPercent: (g: number) => void;
  floorMultiplier: number;
  setFloorMultiplier: (f: number) => void;
  guardrail: any;
  isRecalculating: boolean;
  onRunEngine: () => void;
  currentPeriodLabel: string;
  prevPeriodLabel: string;
  lyPeriodLabel: string;
  formatLakhs: (val: number | null | undefined) => string;
}

export const TargetEngineStudioDrawer: React.FC<TargetEngineStudioDrawerProps> = ({
  isOpen,
  onClose,
  lyWeight,
  setLyWeight,
  lmWeight,
  setLmWeight,
  lqWeight,
  setLqWeight,
  lfyWeight,
  setLfyWeight,
  growthPercent,
  setGrowthPercent,
  floorMultiplier,
  setFloorMultiplier,
  guardrail,
  isRecalculating,
  onRunEngine,
  currentPeriodLabel,
  prevPeriodLabel,
  lyPeriodLabel,
  formatLakhs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex justify-end z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
        <div>
          <div className="p-6 text-white flex items-start justify-between border-b border-[#003870] bg-[#001D3D]">
            <div>
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-amber-400" />
                <h3 className="text-lg font-bold text-white">Party Target Engine Studio</h3>
              </div>
              <p className="text-xs text-blue-200/80 font-mono mt-1">
                Period: <strong>{currentPeriodLabel} Target Formulation & Guardrails</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6 text-xs">
            <div className="bg-slate-900 text-white rounded-2xl p-4 border border-blue-900 shadow-md font-mono">
              <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                Weighted Base Formula
              </p>
              <p className="text-xs text-slate-200 leading-relaxed">
                Weighted Base = ({lyPeriodLabel} × {lyWeight}%) + ({prevPeriodLabel} × {lmWeight}%) + (Last Qtr Avg × {lqWeight}%) + (Last FY Avg × {lfyWeight}%)
              </p>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Recommended Target = Weighted Base × (1 + {growthPercent}%)</span>
                <span className={`font-bold px-2 py-0.5 rounded ${lyWeight + lmWeight + lqWeight + lfyWeight === 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  Sum: {lyWeight + lmWeight + lqWeight + lfyWeight}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal size={14} className="text-blue-600" />
                Historical Component Weight Allocation
              </h4>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>LY Same Month ({lyPeriodLabel})</span>
                  <span className="font-mono text-blue-600">{lyWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lyWeight}
                  onChange={(e) => setLyWeight(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Last Month ({prevPeriodLabel})</span>
                  <span className="font-mono text-blue-600">{lmWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lmWeight}
                  onChange={(e) => setLmWeight(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Last Quarter Monthly Average</span>
                  <span className="font-mono text-blue-600">{lqWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lqWeight}
                  onChange={(e) => setLqWeight(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Last Financial Year Monthly Average</span>
                  <span className="font-mono text-blue-600">{lfyWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lfyWeight}
                  onChange={(e) => setLfyWeight(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                  Expected Growth %
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={growthPercent}
                    onChange={(e) => setGrowthPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-bold text-slate-500">%</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block font-bold text-slate-700 uppercase mb-1 text-xs">
                  Guardrail Floor Multiplier
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={0.05}
                    value={floorMultiplier}
                    onChange={(e) => setFloorMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-bold text-slate-500">x</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 text-blue-950 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1.5 text-blue-900">
                  <Scale size={14} className="text-blue-700" />
                  Overall Target Guardrail Floor Audit
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${guardrail?.isFloorPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {guardrail?.isFloorPassed ? 'Floor Passed (ACCEPT)' : 'Gap Distributed'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div>
                  <p className="text-blue-600/80 text-xs">LY Same Month</p>
                  <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.totalLySameMonth)}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 text-xs">Guardrail Floor ({floorMultiplier}x)</p>
                  <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.overallFloor)}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 text-xs">Recommended Total</p>
                  <p className="font-bold font-mono text-slate-900">{formatLakhs(guardrail?.totalRecommendedTarget)}</p>
                </div>
              </div>

              {!guardrail?.isFloorPassed && guardrail?.totalGapAdjustment > 0 && (
                <p className="text-xs text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2">
                  ⚠️ Shortfall of <strong>₹{(guardrail.totalGapAdjustment / 100000).toFixed(2)} Lakhs</strong> automatically distributed proportionally across all active parties.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRunEngine}
            disabled={isRecalculating}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
          >
            <Calculator size={14} />
            <span>{isRecalculating ? 'Executing Engine...' : 'Run Target Engine & Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
