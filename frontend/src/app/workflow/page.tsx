'use client';
import AppShell from '@/components/layout/AppShell';
import useSWR from 'swr';
import api from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, GitBranch, ChevronDown, MessageSquare } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(r => r.data);

function ActionModal({ instance, onClose, onSuccess }: { instance: any; onClose: () => void; onSuccess: () => void }) {
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/workflow/instances/${instance.id}/action`, { action, remarks });
      toast.success(`${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Action failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-slate-800 text-lg mb-4">Take Action</h2>
        <div className="p-3 bg-slate-50 rounded-xl mb-4">
          <p className="text-xs text-slate-500">Workflow Item</p>
          <p className="font-semibold text-slate-800 mt-0.5">{instance.entityType} — {instance.entityId?.slice?.(0, 12)}</p>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setAction('APPROVE')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${action === 'APPROVE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            ✓ Approve
          </button>
          <button onClick={() => setAction('REJECT')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${action === 'REJECT' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            ✕ Reject
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Remarks {action === 'REJECT' ? '(required)' : '(optional)'}</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Enter your remarks..." />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={loading || (action === 'REJECT' && !remarks.trim())} className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition disabled:opacity-60 ${action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowPage() {
  const [selected, setSelected] = useState<any>(null);
  const { data, mutate } = useSWR('/workflow/pending', fetcher);
  const rawItems = data?.instances ?? data?.data ?? data;
  const items: any[] = Array.isArray(rawItems) ? rawItems : [];

  const statusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'REJECTED') return <XCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-amber-500" />;
  };

  return (
    <AppShell title="Workflow Approvals">
      {selected && (
        <ActionModal instance={selected} onClose={() => setSelected(null)} onSuccess={() => mutate()} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending', count: items.filter((i: any) => i.status === 'PENDING').length, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'Approved', count: items.filter((i: any) => i.status === 'APPROVED').length, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'Rejected', count: items.filter((i: any) => i.status === 'REJECTED').length, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
        ].map(({ label, count, color, text }) => (
          <div key={label} className={`rounded-2xl border p-4 ${color}`}>
            <p className={`text-2xl font-bold ${text}`}>{count}</p>
            <p className={`text-sm font-medium ${text} opacity-70`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Items List */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <GitBranch size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-800">Pending Approvals</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 size={40} className="text-emerald-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">All caught up!</p>
              <p className="text-slate-400 text-sm mt-1">No pending approvals at this time</p>
            </div>
          ) : items.map((item: any) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <GitBranch size={16} className="text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{item.entityType || 'Unknown'}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">{item.definitionName || item.workflowType || '—'}</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      {statusIcon(item.status)}
                      <span>{item.status}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Entity: {item.entityId?.slice?.(0, 16) || '—'} · Submitted by: {item.submittedBy || '—'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              </div>
              {item.status === 'PENDING' && (
                <button onClick={() => setSelected(item)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium">
                  <MessageSquare size={12} /> Review
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
