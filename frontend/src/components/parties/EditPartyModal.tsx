'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Edit, CreditCard, Building2, Link2, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Modal } from '@/components/ui';

interface EditPartyModalProps {
  party: any;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin?: boolean;
  branchesList?: string[];
}

export const EditPartyModal: React.FC<EditPartyModalProps> = ({
  party,
  onClose,
  onSuccess,
  isSuperAdmin = true,
  branchesList = [],
}) => {
  const currentCode = party?.code || party?.consPartyCode || '';
  const currentName = party?.name || party?.consPartyName || '';
  const currentType = party?.type || party?.partyType || 'INDEPENDENT WORKSHOP';
  const initialRule = party?.incentiveRule || party?.incentiveType || 'Slab-Based';
  const isFixedInitial = initialRule.toLowerCase().includes('fixed');
  const extractedFixedVal = isFixedInitial ? (initialRule.match(/\d+(\.\d+)?/)?.[0] || '8.0') : '8.0';

  const [ruleType, setRuleType] = useState<string>(isFixedInitial ? 'Fixed' : initialRule.includes('Custom') ? 'Custom Formula' : 'Slab-Based');
  const [fixedRate, setFixedRate] = useState<string>(extractedFixedVal);
  const [isLookingUpIfsc, setIsLookingUpIfsc] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      name: currentName,
      code: currentCode,
      originalCode: party?.originalCode || currentCode,
      partyType: currentType,
      salesExecutive: party?.salesExecutive && party?.salesExecutive !== '-' ? party.salesExecutive : '',
      phone: party?.phone && party?.phone !== '-' ? party.phone : '',
      baseLoc: party?.baseLoc || party?.primaryBranchCode || 'BSE',
      bankName: party?.bankName && party?.bankName !== '-' ? party.bankName : '',
      bankBranch: party?.branchName || party?.bankBranch || '',
      accountNumber: party?.accountNumber && party?.accountNumber !== '-' ? party.accountNumber : '',
      ifscCode: party?.ifscCode && party?.ifscCode !== '-' ? party.ifscCode : '',
      accountHolder: party?.accountHolder && party?.accountHolder !== 'Pending Setup' ? party.accountHolder : '',
      pan: party?.pan && party?.pan !== '-' ? party.pan : '',
      gstIn: party?.gstIn || party?.gstin || '',
    }
  });

  const handleIfscInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.trim().toUpperCase();
    setValue('ifscCode', rawVal);

    if (rawVal.length === 11) {
      setIsLookingUpIfsc(true);
      try {
        const res = await api.get(`/parties/ifsc/${rawVal}`);
        if (res.data && res.data.ok) {
          if (res.data.bankName) setValue('bankName', res.data.bankName);
          if (res.data.branchName) setValue('bankBranch', res.data.branchName);
          toast.success(`🏦 Detected: ${res.data.bankName} - ${res.data.branchName}`);
        } else {
          toast.error(res.data?.message || 'IFSC details not found');
        }
      } catch {
        toast.error('IFSC lookup failed. Please enter Bank Name manually.');
      } finally {
        setIsLookingUpIfsc(false);
      }
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const code = party?.code || party?.consPartyCode;
      if (code && code !== '-') {
        const computedIncentiveRule = ruleType === 'Fixed' ? `Fixed (${fixedRate || '8.0'}%)` : ruleType;

        const payload: any = {
          salesExecutive: data.salesExecutive,
          phone: data.phone,
          pan: data.pan,
          gstIn: data.gstIn,
          bankName: data.bankName,
          bankBranch: data.bankBranch,
          accountNumber: data.accountNumber,
          ifscCode: data.ifscCode,
          accountHolder: data.accountHolder,
        };

        if (isSuperAdmin) {
          payload.originalCode = data.originalCode?.trim() || code;
          if (data.baseLoc) payload.baseLoc = data.baseLoc;
          payload.incentiveRule = computedIncentiveRule;
          payload.incentiveType = computedIncentiveRule;
        }

        await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, payload);
      }
      toast.success(isSuperAdmin ? 'Party updated successfully!' : 'Bank & KYC details saved successfully!');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update party details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={!!party}
      onClose={onClose}
      title={isSuperAdmin ? `Edit Party — ${currentCode}` : `Bank & KYC Setup — ${currentName || currentCode}`}
      subtitle={!isSuperAdmin ? 'Branch Manager Mode: Bank Detail & KYC Setup' : undefined}
      icon={isSuperAdmin ? <Edit size={20} /> : <CreditCard size={20} />}
      size="2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Top Identity Row */}
          {isSuperAdmin ? (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Building2 size={13} className="text-blue-600" /> Party Code
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentCode}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-700 select-all cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Party Name <span className="text-rose-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="Enter Party Name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 text-xs font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-900 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Link2 size={13} className="text-blue-600" /> Original Code
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-bold">Master</span>
                </label>
                <input
                  {...register('originalCode')}
                  placeholder={`e.g. ${currentCode} (Master Code)`}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-slate-800 bg-white font-mono text-xs font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="col-span-1 md:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Party Code</p>
                <p className="font-mono font-bold text-blue-700 mt-0.5">{currentCode}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Party Name</p>
                <p className="font-bold text-slate-800 truncate mt-0.5">{currentName}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Party Type</p>
                <p className="font-semibold text-slate-700 truncate mt-0.5">{currentType}</p>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Party Type</label>
                <select {...register('partyType')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-800">
                  <option value="INDEPENDENT WORKSHOP">INDEPENDENT WORKSHOP</option>
                  <option value="CO-DEALER">CO-DEALER</option>
                  <option value="CO-DISTRIBUTOR">CO-DISTRIBUTOR</option>
                  <option value="MASS">MASS</option>
                  <option value="TRADER/RETAILER">TRADER/RETAILER</option>
                  <option value="WALK-IN CUSTOMER">WALK-IN CUSTOMER</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-blue-900 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-blue-600" /> Branch / Location
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">Admin Only</span>
                </label>
                <select
                  {...register('baseLoc')}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-bold font-mono text-slate-800 text-xs cursor-pointer"
                >
                  {branchesList.map((b: string) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Incentive Structure</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                >
                  <option value="Slab-Based">Slab-Based (Tiered)</option>
                  <option value="Fixed">Fixed Rate (%)</option>
                  <option value="Custom Formula">Custom Formula</option>
                </select>
              </div>

              {ruleType === 'Fixed' && (
                <div className="col-span-1 md:col-span-2 p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600" /> Enter Custom Fixed Commission Percentage (%)
                    </label>
                    <span className="text-[11px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                      Dynamic %
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={fixedRate}
                      onChange={(e) => setFixedRate(e.target.value)}
                      placeholder="e.g. 7.5 or 8.0 or 10.0"
                      className="w-full pl-3 pr-8 py-2 border border-purple-300 bg-white rounded-lg focus:ring-1 focus:ring-purple-500 font-bold text-purple-900 text-xs font-mono"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-700 font-black text-xs">%</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sales Executive</label>
            <input {...register('salesExecutive')} placeholder="e.g. Rajesh Sharma" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mobile Phone</label>
            <input {...register('phone')} placeholder="e.g. 9876543210" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-xs" />
          </div>

          <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <CreditCard size={15} className="text-emerald-600" /> Bank Master & Settlement Details
              </h3>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                ⚡ Auto-fills on IFSC entry
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>IFSC Code <span className="text-rose-500">*</span></span>
              {isLookingUpIfsc && (
                <span className="text-[11px] text-blue-600 flex items-center gap-1 font-normal">
                  <Loader2 size={11} className="animate-spin" /> Looking up...
                </span>
              )}
            </label>
            <input
              {...register('ifscCode')}
              onChange={handleIfscInput}
              placeholder="e.g. SBIN0001746"
              maxLength={11}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
            <input
              {...register('bankName')}
              placeholder="Auto-filled from IFSC"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-slate-800 font-medium text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
            <input
              {...register('bankBranch')}
              placeholder="Auto-filled from IFSC"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-slate-800 font-medium text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Account Number <span className="text-rose-500">*</span></label>
            <input {...register('accountNumber')} placeholder="Bank account number" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono text-xs font-bold" />
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
            <input {...register('accountHolder')} placeholder="Account holder name (as per passbook)" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">PAN Number</label>
            <input {...register('pan')} placeholder="e.g. ABCDE1234F" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
            <input {...register('gstIn')} placeholder="GST identification number" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 uppercase font-mono text-xs" />
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-60">
            {loading ? 'Saving...' : isSuperAdmin ? 'Save Changes' : 'Save Bank & KYC Details'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
