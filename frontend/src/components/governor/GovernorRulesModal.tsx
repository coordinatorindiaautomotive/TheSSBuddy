'use client';
import React from 'react';
import { Sliders, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui';
import { GovernorRule } from './types';

interface GovernorRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: GovernorRule[];
  setRules: React.Dispatch<React.SetStateAction<GovernorRule[]>>;
  availableBranches: string[];
  availableCategories: string[];
  availablePartyTypes: string[];
  isLocked: boolean;
}

export const GovernorRulesModal: React.FC<GovernorRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  setRules,
  availableBranches,
  availableCategories,
  availablePartyTypes,
  isLocked,
}) => {
  const handleAddRule = () => {
    const nextBranch = availableBranches.find((b) => !rules.some((r) => r.branch === b)) || availableBranches[0] || 'ALW';
    setRules([...rules, { branch: nextBranch, categories: [availableCategories[0] || 'M'], partyTypes: [availablePartyTypes[0] || 'INDEPENDENT WORKSHOP'] }]);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Governor Multi-Branch Rules (${rules.length} Branches)`}
      subtitle="Select Party Master Base Branch, Part Categories, and Eligible Customer Party Types"
      icon={<Sliders size={20} />}
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-600 font-medium">
            Configured <strong>{rules.length} Governor Branch Rules</strong>.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                toast.success(`Applied ${rules.length} Governor Branch Rules!`);
              }}
              className="px-5 py-2 bg-[#003366] hover:bg-[#002B55] text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              Save & Apply Rules
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
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
              className="px-3 py-1.5 bg-[#003366] hover:bg-[#002B55] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Sliders size={14} className="text-cyan-400" />
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

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[50vh] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#003366] text-white uppercase text-xs tracking-wider select-none">
              <tr>
                <th className="px-3.5 py-2.5 border-r border-white/10 w-12">#</th>
                <th className="px-3.5 py-2.5 border-r border-white/10 min-w-[140px]">Party Master Base Branch</th>
                <th className="px-3.5 py-2.5 border-r border-white/10">Part Categories</th>
                <th className="px-3.5 py-2.5 border-r border-white/10">Eligible Party Types</th>
                <th className="px-3.5 py-2.5 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-xs">
              {rules.map((rule, index) => (
                <tr key={index} className="hover:bg-slate-50/80 transition">
                  <td className="px-3.5 py-2.5 font-bold font-mono text-slate-700">{index + 1}</td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={rule.branch}
                      onChange={(e) => handleRuleChange(index, 'branch', e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
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
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition cursor-pointer ${
                            rule.categories.includes(cat)
                              ? 'bg-[#003366] text-white border-[#003366]'
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
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition cursor-pointer ${
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
    </Modal>
  );
};
