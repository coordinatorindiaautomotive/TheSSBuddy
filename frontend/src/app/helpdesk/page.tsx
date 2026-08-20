'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  LifeBuoy, Plus, Search, Filter, Settings, Trash2, Edit3,
  CheckCircle2, AlertTriangle, Clock, MessageSquare, Send,
  UserCheck, Shield, ChevronRight, RefreshCw, X, Tag,
  FileText, ArrowRight, User, AlertCircle
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function HelpdeskPage() {
  const { isSuperAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modals & Drawer State
  const [categoryModal, setCategoryModal] = useState<boolean>(false);
  const [ticketModal, setTicketModal] = useState<boolean>(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);

  // Keyboard shortcut (Escape to close modals/drawers)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTicket(null);
        setTicketModal(false);
        setCategoryModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Category Form State
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPriority, setCatPriority] = useState('MEDIUM');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Ticket Form State
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment Form State
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  const queryParams = new URLSearchParams({
    category: selectedCategory,
    priority: selectedPriority,
    status: selectedStatus,
    search,
  }).toString();

  const { data, mutate, isLoading } = useSWR(`/helpdesk?${queryParams}`, fetcher);

  const tickets: any[] = data?.tickets || [];
  const categories: any[] = data?.categories || [];
  const metrics = data?.metrics || {
    totalCount: 0,
    openCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    urgentCount: 0,
  };

  // Category CRUD
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode || !catName) {
      toast.error('Category Code and Name are required');
      return;
    }

    try {
      await api.post('/helpdesk/categories', {
        id: editingCatId || undefined,
        code: catCode,
        name: catName,
        description: catDesc,
        priority: catPriority,
      });

      toast.success(editingCatId ? 'Category updated!' : 'Category created!');
      setEditingCatId(null);
      setCatCode('');
      setCatName('');
      setCatDesc('');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;

    try {
      await api.delete(`/helpdesk/categories/${id}`);
      toast.success(`Category "${name}" deleted`);
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete category');
    }
  };

  // Ticket Creation
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle || !ticketCategory) {
      toast.error('Please provide a title and category');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/helpdesk', {
        title: ticketTitle,
        category: ticketCategory,
        priority: ticketPriority,
        description: ticketDesc,
      });

      toast.success('Support ticket submitted successfully!');
      setTicketModal(false);
      setTicketTitle('');
      setTicketDesc('');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Update
  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      await api.post(`/helpdesk/${ticketId}/status`, { status });
      toast.success(`Ticket status updated to ${status}`);
      if (activeTicket && activeTicket.id === ticketId) {
        setActiveTicket({ ...activeTicket, status });
      }
      mutate();
    } catch (err: any) {
      toast.error('Failed to update ticket status');
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeTicket) return;

    setIsAddingComment(true);
    try {
      const res = await api.post(`/helpdesk/${activeTicket.id}/comments`, {
        comment: newComment.trim(),
      });

      const updatedComments = [...(activeTicket.comments || []), res.data];
      setActiveTicket({ ...activeTicket, comments: updatedComments });
      setNewComment('');
      toast.success('Reply posted');
      mutate();
    } catch (err: any) {
      toast.error('Failed to post reply');
    } finally {
      setIsAddingComment(false);
    }
  };

  // Delete Ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await api.delete(`/helpdesk/${ticketId}`);
      toast.success('Ticket deleted');
      if (activeTicket?.id === ticketId) setActiveTicket(null);
      mutate();
    } catch (err: any) {
      toast.error('Failed to delete ticket');
    }
  };

  return (
    <AppShell title="Enterprise Helpdesk & Support" breadcrumb="Operations & Services">
      <div className="space-y-6 max-w-full">
        {/* ─── 1. TOP CONTROL TOOLBAR ─── */}
        <div
          className="bg-white text-slate-800 rounded-2xl p-4 shadow-sm relative z-30 border border-slate-200/90"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            {/* Left: Filters & Search */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Dynamic Category Selector */}
              <div className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-md">
                <Tag size={15} className="text-blue-600 shrink-0" />
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Categories ({categories.length})</option>
                  {categories.map((c: any) => (
                    <option key={c.id || c.code} value={c.code} className="text-slate-900 bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-md">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Priority:</span>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Priorities</option>
                  <option value="LOW" className="text-slate-900 bg-white">Low</option>
                  <option value="MEDIUM" className="text-slate-900 bg-white">Medium</option>
                  <option value="HIGH" className="text-slate-900 bg-white">High</option>
                  <option value="URGENT" className="text-slate-900 bg-white">Urgent</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white text-slate-900 border border-slate-200 rounded-2xl px-3.5 py-2 shadow-md">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900 bg-white">All Statuses</option>
                  <option value="OPEN" className="text-slate-900 bg-white">Open</option>
                  <option value="IN_PROGRESS" className="text-slate-900 bg-white">In Progress</option>
                  <option value="RESOLVED" className="text-slate-900 bg-white">Resolved</option>
                  <option value="CLOSED" className="text-slate-900 bg-white">Closed</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative w-60">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tickets, issues..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 font-extrabold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md"
                />
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Category Studio Button — SuperAdmin Only */}
              {isSuperAdmin && (
                <button
                  onClick={() => setCategoryModal(true)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-blue-700 font-extrabold rounded-2xl text-xs flex items-center gap-2 transition border border-slate-200 shadow-md cursor-pointer"
                >
                  <Settings size={14} className="text-blue-600" />
                  <span>Manage Categories ({categories.length})</span>
                </button>
              )}

              {/* Create Ticket Button */}
              <button
                onClick={() => {
                  setTicketCategory(categories[0]?.code || 'INCENTIVE_QUERY');
                  setTicketModal(true);
                }}
                className="px-4 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
              >
                <Plus size={15} />
                <span>Create Support Ticket</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── 2. BENTO METRICS CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-blue-700 tracking-wider">Total Tickets</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <LifeBuoy size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
              {metrics.totalCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">All logged corporate and branch inquiries</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-amber-700 tracking-wider">Open Tickets</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-amber-600 tracking-tight tabular-nums">
              {metrics.openCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Awaiting IT/Operations initial review</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-cyan-700 tracking-wider">In Progress</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <RefreshCw size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-cyan-600 tracking-tight tabular-nums">
              {metrics.inProgressCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Under active investigation & resolution</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-emerald-700 tracking-wider">Resolved Issues</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={17} />
              </div>
            </div>
            <p className="text-3xl font-black font-mono text-emerald-600 tracking-tight tabular-nums">
              {metrics.resolvedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Successfully solved and verified</p>
          </div>
        </div>

        {/* ─── 3. TICKETS TABLE VIEW ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <LifeBuoy size={16} className="text-blue-600" />
              <h2 className="font-extrabold text-sm text-slate-800">
                Helpdesk Tickets Registry ({tickets.length})
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Click ticket row to open conversation & timeline drawer
            </span>
          </div>

          <div className="overflow-x-auto max-h-[65vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead
                className="sticky top-0 z-20 text-white uppercase text-[10px] tracking-wider select-none shadow-md border-b-[3px] border-[#ed1c24]"
                style={{ backgroundColor: '#003366' }}
              >
                <tr>
                  <th className="px-4 py-3 border-r border-white/10">Ticket #</th>
                  <th className="px-4 py-3 border-r border-white/10 min-w-[220px]">Subject / Title</th>
                  <th className="px-4 py-3 border-r border-white/10">Category</th>
                  <th className="px-4 py-3 border-r border-white/10">Priority</th>
                  <th className="px-4 py-3 border-r border-white/10">Status</th>
                  <th className="px-4 py-3 border-r border-white/10">Reported By</th>
                  <th className="px-4 py-3 border-r border-white/10">Created At</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <RefreshCw size={26} className="animate-spin text-blue-600 mx-auto mb-2" />
                      <span className="font-bold">Loading support tickets...</span>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <LifeBuoy size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">No support tickets found</p>
                      <p className="text-xs text-slate-400 mt-1">Create a support ticket to start tracking issues</p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((t: any, idx: number) => {
                    const priorityColor =
                      t.priority === 'URGENT'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : t.priority === 'HIGH'
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : t.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300';

                    const statusBg =
                      t.status === 'RESOLVED' || t.status === 'CLOSED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300';

                    const catObj = categories.find((c: any) => c.code === t.category);

                    return (
                      <tr
                        key={t.id || idx}
                        onClick={() => setActiveTicket(t)}
                        className="even:bg-slate-50/60 hover:bg-blue-50/80 transition cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-black text-[11px] border border-slate-200">
                            {t.ticketNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-900 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="group-hover:text-blue-600 transition">{t.title}</span>
                            {t.comments?.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[9.5px] font-mono font-bold flex items-center gap-0.5">
                                <MessageSquare size={9} />
                                {t.comments.length}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10.5px] border border-blue-200">
                            {catObj?.name || t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColor}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusBg}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {t.createdByName || 'User'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setActiveTicket(t)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                              title="View Discussion"
                            >
                              <MessageSquare size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(t.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              title="Delete Ticket"
                            >
                              <Trash2 size={13} />
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
        </div>

        {/* ─── 4. DYNAMIC HELPDESK CATEGORY STUDIO MODAL ─── */}
        {categoryModal && (
          <div
            onClick={() => setCategoryModal(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b-[3px] border-[#ed1c24]" style={{ backgroundColor: '#003366' }}>
                <div className="flex items-center gap-2.5">
                  <Settings size={20} className="text-cyan-400" />
                  <h3 className="font-extrabold text-sm text-white">Dynamic Helpdesk Category Studio</h3>
                </div>
                <button onClick={() => setCategoryModal(false)} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <form onSubmit={handleSaveCategory} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                  <p className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    {editingCatId ? 'Edit Category' : 'Create New Support Category'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Code (Key)</label>
                      <input
                        type="text"
                        value={catCode}
                        onChange={(e) => setCatCode(e.target.value)}
                        placeholder="e.g. INCENTIVE_PAYOUT"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Category Title</label>
                      <input
                        type="text"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="e.g. Dealer Incentive Discrepancy"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={catDesc}
                        onChange={(e) => setCatDesc(e.target.value)}
                        placeholder="Brief summary of support scope"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Default Priority</label>
                      <select
                        value={catPriority}
                        onChange={(e) => setCatPriority(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    {editingCatId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(null);
                          setCatCode('');
                          setCatName('');
                          setCatDesc('');
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl font-bold"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#0052cc] hover:bg-[#0041a3] text-white font-bold text-xs rounded-xl shadow-sm"
                    >
                      {editingCatId ? 'Save Changes' : 'Add Category'}
                    </button>
                  </div>
                </form>

                {/* Categories List */}
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800 mb-3 uppercase tracking-wider">
                    Active Helpdesk Categories ({categories.length})
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {categories.map((c: any) => (
                      <div key={c.id || c.code} className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs text-slate-900">{c.name}</p>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                              {c.priority}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{c.description || 'No description provided.'}</p>
                          <span className="text-[10px] text-blue-600 font-mono font-bold">Code: {c.code}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                          <button
                            onClick={() => {
                              setEditingCatId(c.id);
                              setCatCode(c.code);
                              setCatName(c.name);
                              setCatDesc(c.description || '');
                              setCatPriority(c.priority || 'MEDIUM');
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. CREATE TICKET MODAL ─── */}
        {ticketModal && (
          <div
            onClick={() => setTicketModal(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
                <h3 className="font-extrabold text-sm text-white">Create New Support Ticket</h3>
                <button onClick={() => setTicketModal(false)} className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Title / Subject</label>
                  <input
                    type="text"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder="e.g. Q1 Slab Incentive Missing for Party WRJ060425"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                      required
                    >
                      {categories.map((c: any) => (
                        <option key={c.id || c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent (Immediate)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description & Reproduction Details</label>
                  <textarea
                    value={ticketDesc}
                    onChange={(e) => setTicketDesc(e.target.value)}
                    rows={4}
                    placeholder="Provide relevant transaction references, party codes, dates, or error details"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTicketModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-bold rounded-xl shadow-2xs disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── 6. TICKET DETAIL & CONVERSATION DRAWER (ELEVATED Z-[200]) ─── */}
        {activeTicket && (
          <div
            onClick={() => setActiveTicket(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-[200] animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
            >
              <div>
                {/* Header with Dark Forest Green Styling */}
                <div className="p-6 text-white flex items-start justify-between border-b border-[#074B47] bg-[#032F2D] relative z-20 shadow-md">
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-white/10 text-[#FFE2B8] font-mono font-bold text-[10px] uppercase border border-white/20">
                        {activeTicket.ticketNo}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#DCEDEA]">
                        {activeTicket.priority} Priority
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1.5 leading-snug">
                      {activeTicket.title}
                    </h3>
                    <p className="text-xs text-[#DCEDEA] font-mono mt-1">
                      Reported by <strong>{activeTicket.createdByName || 'Staff'}</strong> • {new Date(activeTicket.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTicket(null)}
                    className="p-2 bg-white/10 hover:bg-white/25 text-white rounded-2xl transition border border-white/20 shadow-md shrink-0 active:scale-95 cursor-pointer"
                    title="Close Screen (Esc)"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Status Stepper Toolbar */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Change Status:</span>
                  <div className="flex items-center gap-1.5">
                    {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(activeTicket.id, st)}
                        className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition cursor-pointer ${
                          activeTicket.status === st
                            ? 'bg-[#053D3A] text-white shadow-2xs border border-[#074B47]'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ticket Description */}
                <div className="p-6 border-b border-slate-100">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider mb-2">
                    Issue Description
                  </h4>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                    {activeTicket.description || 'No detailed description was attached.'}
                  </div>
                </div>

                {/* Threaded Comments / Conversation */}
                <div className="p-6 space-y-4">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-blue-600" />
                    Conversation & Resolution Audit ({activeTicket.comments?.length || 0})
                  </h4>

                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {(!activeTicket.comments || activeTicket.comments.length === 0) ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs">No replies or resolution notes yet.</p>
                      </div>
                    ) : (
                      activeTicket.comments.map((cm: any, idx: number) => (
                        <div key={cm.id || idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-bold text-slate-800">Support Representative / User</span>
                            <span className="text-slate-400 font-mono">
                              {cm.createdAt ? new Date(cm.createdAt).toLocaleTimeString() : 'Just now'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">{cm.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Reply Form */}
              <div className="p-4 border-t border-slate-200 bg-white sticky bottom-0">
                <form onSubmit={handleAddComment} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type an update or resolution comment..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isAddingComment || !newComment.trim()}
                    className="p-2.5 bg-[#0052cc] hover:bg-[#0041a3] text-white rounded-2xl shadow-md disabled:opacity-50 transition"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
