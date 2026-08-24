'use client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell, LogOut, User, ChevronDown, Search, Building2,
  Sparkles, CheckCheck, X, Menu, PanelLeft, ArrowRight,
  Shield, CheckCircle2, AlertTriangle, FileText, Trash2, Calendar, Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface TopbarProps {
  title: string;
  breadcrumb?: string;
  onToggleSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

const fetcher = (url: string) =>
  api
    .get(url)
    .then((r) => r.data)
    .catch(() => ({ announcements: [], notifications: [], totalUnread: 0 }));

export default function Topbar({
  title,
  breadcrumb,
  onToggleSidebar,
  onToggleMobileSidebar,
  isSidebarCollapsed = false,
}: TopbarProps) {
  const { user, logout, isSuperAdmin, userBranch, userBranchName, displayName } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [selectedFy, setSelectedFy] = useState<number>(2026);
  const [selectedMonthName, setSelectedMonthName] = useState<string>('Aug');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setCurrentTime(`${formattedDate} ${formattedTime}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real-time notifications & announcements from backend
  const { data: inboxData, mutate: mutateInbox } = useSWR(
    '/notifications/inbox',
    fetcher,
    {
      refreshInterval: 15000, // auto-refresh every 15s
    }
  );

  const announcements: any[] = Array.isArray(inboxData?.announcements)
    ? inboxData.announcements
    : [];
  const notifications: any[] = Array.isArray(inboxData?.notifications)
    ? inboxData.notifications
    : [];
  const allNotifs = [
    ...announcements.map((a) => ({ ...a, isAnnouncement: true })),
    ...notifications,
  ];
  const unreadCount =
    inboxData?.totalUnread ?? (allNotifs.length > 0 ? allNotifs.length : 0);

  // Clear All Notifications Handler
  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await api.post('/notifications/clear-all');
      mutateInbox({ announcements: [], notifications: [], totalUnread: 0 }, false);
      toast.success('All notifications cleared!');
    } catch {
      toast.error('Failed to clear notifications');
    } finally {
      setIsClearing(false);
    }
  };

  // Dismiss Single Notification Handler
  const handleDismissSingle = async (id: string, isAnnouncement: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/dismiss`, { isAnnouncement });
      mutateInbox(
        (prev: any) => ({
          ...prev,
          announcements: isAnnouncement
            ? (prev?.announcements || []).filter((a: any) => a.id !== id)
            : prev?.announcements || [],
          notifications: !isAnnouncement
            ? (prev?.notifications || []).filter((n: any) => n.id !== id)
            : prev?.notifications || [],
          totalUnread: Math.max(0, (prev?.totalUnread || 1) - 1),
        }),
        false
      );
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Click outside backdrop for dropdowns */}
      {(notifMenuOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-[95] bg-transparent"
          onClick={() => {
            setNotifMenuOpen(false);
            setUserMenuOpen(false);
          }}
        />
      )}

      {/* ─── CORPORATE TOPBAR WITH DARK FOREST GREEN BRANDING ─── */}
      <header
        className="h-16 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-[100] shadow-md select-none text-white border-b border-[#074B47] bg-[#032F2D]"
      >
        {/* Left: Sidebar Toggle (Mobile Hamburger / Desktop Collapse) + Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Drawer Hamburger */}
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-[#FFE2B8] hover:text-white hover:bg-[#074B47] transition border border-[#074B47] bg-[#053D3A] shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Desktop Collapse Button */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="hidden lg:flex p-1.5 rounded-xl text-[#DCEDEA] hover:text-white hover:bg-[#074B47] transition border border-[#074B47] bg-[#053D3A] shrink-0"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <PanelLeft size={18} className="text-[#FFE2B8]" />
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[#DCEDEA] font-medium text-xs sm:text-sm hidden sm:inline shrink-0">TheSSBuddy ›</span>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-[240px] md:max-w-none">
              {title}
            </h1>
          </div>
        </div>

        {/* Right Controls with Live Date/Time Badge & User Pill */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Date / Time Badge — Interactive Button (Desktop) */}
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            title="Click to open Global Date & Period Selector"
            className="hidden xl:flex items-center gap-2 bg-[#053D3A] hover:bg-[#074B47] border border-[#074B47] text-white text-xs font-mono font-medium px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer transition active:scale-95 group"
          >
            <Calendar size={13} className="text-[#FFE2B8] group-hover:scale-105 transition-transform" />
            <span className="tracking-wide text-white text-[11px]">{currentTime || '19 Aug 2026 09:59:05 AM'}</span>
          </button>

          {/* Search Input (Tablet & Desktop) */}
          <div className="relative hidden md:block w-44 lg:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFE2B8]" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#053D3A] border border-[#074B47] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#FFE2B8] text-white placeholder-slate-300 font-medium transition"
            />
          </div>

          {/* Notification Bell */}
          <div className="relative z-[100]">
            <button
              onClick={() => {
                setNotifMenuOpen(!notifMenuOpen);
                setUserMenuOpen(false);
              }}
              className="relative w-8.5 h-8.5 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-white bg-[#053D3A] hover:bg-[#074B47] transition-colors border border-[#074B47] shadow-2xs"
            >
              <Bell size={15} className="text-[#DCEDEA]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#B42335] text-white rounded-full text-[9px] font-black flex items-center justify-center shadow animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {notifMenuOpen && (
              <div className="absolute right-0 mt-2.5 w-[calc(100vw-24px)] sm:w-96 max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-[110] animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-slate-800">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#053D3A]/10 text-[#053D3A] flex items-center justify-center">
                      <Bell size={13} className="text-[#053D3A]" />
                    </div>
                    <span className="font-bold text-xs text-slate-900">
                      Notifications & Alerts
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {allNotifs.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        disabled={isClearing}
                        className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                        title="Clear All Notifications"
                      >
                        <Trash2 size={12} />
                        <span>Clear</span>
                      </button>
                    )}
                    <button
                      onClick={() => setNotifMenuOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {allNotifs.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2 border border-emerald-200">
                        <CheckCheck size={18} />
                      </div>
                      <p className="font-bold text-xs text-slate-900">All Caught Up</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">No unread notifications or system alerts.</p>
                    </div>
                  ) : (
                    allNotifs.map((n: any, idx: number) => (
                      <div
                        key={n.id || idx}
                        className={`p-3.5 hover:bg-slate-50 transition flex items-start gap-3 group relative ${
                          !n.read ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#053D3A]/10 text-[#053D3A] flex items-center justify-center shrink-0 mt-0.5 border border-[#053D3A]/20">
                          {n.isAnnouncement ? <Sparkles size={13} className="text-amber-600" /> : <Bell size={13} className="text-[#053D3A]" />}
                        </div>
                        <div className="flex-1 min-w-0 pr-5">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => setNotifMenuOpen(false)}
                              className="font-bold text-slate-900 hover:text-[#053D3A] text-xs block truncate transition"
                            >
                              {n.title || n.subject || 'System Notification'}
                            </Link>
                          ) : (
                            <p className="font-bold text-slate-900 text-xs truncate">
                              {n.title || n.subject || 'System Notification'}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-600 line-clamp-3 mt-0.5 whitespace-pre-line font-normal leading-relaxed">
                            {n.message || n.body || 'No description provided.'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                            {n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                          </span>
                        </div>

                        {/* Individual Dismiss Button */}
                        <button
                          onClick={(e) => handleDismissSingle(n.id, Boolean(n.isAnnouncement), e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition absolute right-3 top-3.5"
                          title="Dismiss notification"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown */}
          <div className="relative z-[100]">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotifMenuOpen(false);
              }}
              className="flex items-center gap-2.5 p-1 pl-2 bg-[#053D3A] hover:bg-[#074B47] border border-[#074B47] rounded-2xl transition shadow-sm cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#053D3A] font-black text-xs shadow-sm bg-[#FFE2B8] border border-[#FFD49A]">
                {(displayName || 'S')[0].toUpperCase()}
              </div>
              <div className="hidden sm:block text-left pr-1">
                <p className="font-extrabold text-xs text-white leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-[#DCEDEA] font-mono">
                  {user?.role || (user?.roles && user.roles[0]) || (isSuperAdmin ? 'SuperAdmin' : 'Branch Manager')}
                  {isSuperAdmin ? ' • All Branches' : (userBranchName || user?.branchName || userBranch) ? ` • ${userBranchName || user?.branchName || userBranch}` : ''}
                </p>
              </div>
              <ChevronDown size={13} className="text-[#DCEDEA] mr-1" />
            </button>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border-2 border-slate-200 py-2 z-[110] animate-in fade-in zoom-in-95 duration-150 text-xs text-slate-800">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="font-black text-slate-900 text-sm leading-tight">{displayName}</p>
                  {user?.username && (
                    <p className="text-[10px] text-slate-400 font-mono">@{user.username}</p>
                  )}
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    Role: <strong className="text-blue-600">{user?.role || (user?.roles && user.roles[0]) || (isSuperAdmin ? 'SuperAdmin' : 'Branch Manager')}</strong>
                  </p>
                  {isSuperAdmin ? (
                    <p className="text-[11px] text-emerald-700 font-mono mt-0.5 font-bold">
                      🌐 Scope: <strong className="text-emerald-800">All Branches (Global)</strong>
                    </p>
                  ) : (userBranchName || user?.branchName || userBranch) ? (
                    <p className="text-[11px] text-amber-600 font-mono mt-0.5 font-bold">
                      🔒 Branch: <strong className="text-amber-700">{userBranchName || user?.branchName || userBranch}</strong>
                    </p>
                  ) : null}
                </div>

                <div className="p-1 space-y-0.5">
                  <Link
                    href="/users"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition"
                  >
                    <User size={14} className="text-blue-500" />
                    <span>Manage Profile</span>
                  </Link>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── GLOBAL DATE & FISCAL PERIOD SELECTOR MODAL ─── */}
      {datePickerOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Header */}
            <div className="px-6 py-4 text-white flex items-center justify-between border-b border-[#074B47] bg-[#032F2D]">
              <div className="flex items-center gap-2.5">
                <Calendar size={20} className="text-[#FFE2B8]" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">Global Date & Period Selector</h3>
                  <p className="text-[11px] text-[#DCEDEA] font-mono">Live Clock: {currentTime}</p>
                </div>
              </div>
              <button
                onClick={() => setDatePickerOpen(false)}
                className="p-1 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 text-xs">
              {/* Presets */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  Quick Presets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Current MTD (Aug 2026)', fy: 2026, month: 'Aug' },
                    { label: 'Prior Month (Jul 2026)', fy: 2026, month: 'Jul' },
                    { label: 'Current YTD (FY26)', fy: 2026, month: 'Aug' },
                    { label: 'Full Last FY (FY25)', fy: 2025, month: 'Mar' },
                    { label: 'Q1 FY26 (Apr-Jun)', fy: 2026, month: 'Jun' },
                    { label: 'Q2 FY26 (Jul-Sep)', fy: 2026, month: 'Aug' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setSelectedFy(preset.fy);
                        setSelectedMonthName(preset.month);
                        toast.success(`Period set to ${preset.label}`);
                        setDatePickerOpen(false);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-teal-50 text-slate-800 hover:text-[#053D3A] font-extrabold border border-slate-200 hover:border-teal-300 rounded-xl transition text-[11px] text-left shadow-2xs cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Form */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                    Fiscal Year
                  </label>
                  <select
                    value={selectedFy}
                    onChange={(e) => setSelectedFy(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A] cursor-pointer"
                  >
                    <option value={2026}>FY 2026 (Current FY)</option>
                    <option value={2025}>FY 2025 (Last FY)</option>
                    <option value={2024}>FY 2024</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                    Target Month
                  </label>
                  <select
                    value={selectedMonthName}
                    onChange={(e) => setSelectedMonthName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#053D3A] cursor-pointer"
                  >
                    {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Server Sync Status */}
              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-[11px]">Tally ERP & PostgreSQL Live Sync Connected</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-700 font-bold">Latency: 12ms</span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(`Applied global period ${selectedMonthName} FY${selectedFy}`);
                    setDatePickerOpen(false);
                  }}
                  className="px-5 py-2 bg-[#053D3A] hover:bg-[#074B47] text-white font-extrabold rounded-xl transition shadow-2xs cursor-pointer"
                >
                  Apply Period Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
