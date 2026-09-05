'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, Zap, Upload, Wallet,
  GitBranch, BookOpen, UserCog, ChevronRight,
  Receipt, Target, ChevronLeft, ChevronsLeft, ChevronsRight,
  Menu, Sparkles, Shield, Layers, BarChart3, Sliders,
  Activity, Boxes, LifeBuoy, Lock, Radio, LineChart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const nav = [
  {
    label: 'OPERATIONS',
    items: [
      {
        href: '/dashboard',
        icon: LineChart,
        label: 'Dashboard',
        iconColor: 'text-blue-600',
      },
      {
        href: '/parties',
        icon: Building2,
        label: 'Party Master',
        iconColor: 'text-teal-600',
      },
      {
        href: '/incentive-schemes',
        icon: Zap,
        label: 'Incentive Schemes',
        iconColor: 'text-amber-500',
      },
      {
        href: '/incentive-governor',
        icon: Sliders,
        label: 'Incentive Governor',
        iconColor: 'text-indigo-600',
      },
      {
        href: '/incentive-governor?tab=register',
        icon: BookOpen,
        label: 'Incentive Register',
        iconColor: 'text-rose-500',
      },
      {
        href: '/sales-upload',
        icon: Upload,
        label: 'Sales Upload',
        iconColor: 'text-blue-600',
      },
      {
        href: '/cash-management',
        icon: Wallet,
        label: 'Cashbook',
        iconColor: 'text-orange-500',
      },
      {
        href: '/workflow',
        icon: GitBranch,
        label: 'Workflow Approvals',
        iconColor: 'text-purple-600',
      },
    ],
  },
  {
    label: 'FINANCIAL & LEDGER',
    items: [
      {
        href: '/target-vs-achievement',
        icon: Target,
        label: 'Party Wise Performance',
        iconColor: 'text-rose-500',
      },
      {
        href: '/outstanding',
        icon: Receipt,
        label: 'Party Wise Outstanding',
        iconColor: 'text-purple-600',
      },
      {
        href: '/ledger',
        icon: BookOpen,
        label: 'General Ledger',
        iconColor: 'text-teal-600',
      },
    ],
  },
  {
    label: 'MASTER & ADMIN',
    items: [
      {
        href: '/assets',
        icon: Boxes,
        label: 'Asset Manager',
        iconColor: 'text-blue-600',
      },
      {
        href: '/helpdesk',
        icon: LifeBuoy,
        label: 'IT & Support Helpdesk',
        iconColor: 'text-rose-500',
      },
      {
        href: '/branches',
        icon: Building2,
        label: 'Branch Master',
        iconColor: 'text-sky-600',
      },
      {
        href: '/users',
        icon: UserCog,
        label: 'User Master',
        iconColor: 'text-emerald-600',
      },
    ],
  },
];

export default function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessModule, isBranchUser, userBranch, user, isSuperAdmin, displayName } = useAuth();

  return (
    <>
      {/* ─── MOBILE BACKDROP OVERLAY ─── */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* ─── MAIN SIDEBAR / MOBILE DRAWER ─── */}
      <aside
        className={`h-screen fixed lg:sticky top-0 left-0 shrink-0 flex flex-col transition-all duration-300 ease-in-out select-none z-50 border-r border-slate-200/90 shadow-sm overflow-hidden bg-white text-slate-800 ${
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        {/* ─── 1. TOP LOGO CARD (MATCHED TO SCREENSHOT) ─── */}
        <div className="p-3 shrink-0">
          {collapsed ? (
            /* COLLAPSED LOGO CARD */
            <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center gap-2">
              <div className="relative p-1 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <img
                  src="/thessbuddy-logo.png"
                  alt="TheSSBuddy"
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo-icon-dark.png';
                  }}
                />
              </div>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Expand Sidebar"
                >
                  <ChevronsRight size={14} />
                </button>
              )}
            </div>
          ) : (
            /* EXPANDED LOGO CARD */
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <img
                  src="/thessbuddy-logo.png"
                  alt="ThessBuddy"
                  className="h-8 max-w-[140px] w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo-full-trans.png';
                  }}
                />
              </div>

              {/* Toggle << Button inside card */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {/* Mobile Close Button */}
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-600 transition cursor-pointer lg:hidden"
                  title="Close Menu"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Desktop Collapse Toggle */}
                {onToggle && (
                  <button
                    onClick={onToggle}
                    className="hidden lg:flex p-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    title="Collapse Sidebar"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── 2. NAVIGATION LINKS ─── */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-slate-200">
          {nav.map((section) => {
            const visibleItems = section.items.filter((item) => canAccessModule(item.href));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label}>
                {(!collapsed || mobileOpen) && (
                  <div className="px-2 mb-2">
                    <p className="text-[#5A6E85] text-[11px] font-bold uppercase tracking-wider">
                      {section.label}
                    </p>
                  </div>
                )}
                <ul className="space-y-1">
                  {visibleItems.map(
                    ({ href, icon: Icon, label, iconColor }) => {
                      const searchStr = typeof window !== 'undefined' ? window.location.search : '';
                      const active = href.includes('?')
                        ? pathname === href.split('?')[0] && searchStr.includes('tab=register')
                        : (pathname === href || pathname.startsWith(href + '/')) && !searchStr.includes('tab=register');

                      return (
                        <li key={href} className="relative">
                          <Link
                            href={href}
                            prefetch={true}
                            onClick={() => {
                              onCloseMobile?.();
                            }}
                            onMouseEnter={() => {
                              try { router.prefetch(href); } catch {}
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-150 relative overflow-hidden ${
                              active
                                ? 'bg-[#004A99] text-white font-bold shadow-md'
                                : 'text-slate-800 hover:bg-slate-100/90 hover:text-slate-900 font-semibold'
                            } ${collapsed && !mobileOpen ? 'justify-center px-2' : ''}`}
                          >
                            {/* Signature Red Left Accent Stripe for Active item */}
                            {active && (
                              <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ED1C24] rounded-l-xl" />
                            )}

                            <Icon
                              size={17}
                              className={`shrink-0 transition-transform group-hover:scale-110 ${
                                active ? 'text-white' : iconColor || 'text-slate-700'
                              }`}
                            />

                            {(!collapsed || mobileOpen) && (
                              <span className="truncate tracking-tight">
                                {label}
                              </span>
                            )}

                            {active && (!collapsed || mobileOpen) && (
                              <ChevronRight size={14} className="text-white/80 shrink-0 ml-auto" />
                            )}
                          </Link>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ─── 3. USER PROFILE & LIVE CLOUD STATUS FOOTER ─── */}
        <div className="p-3 border-t border-slate-200/90 bg-white shrink-0">
          {!collapsed && (
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#004A99] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {displayName.charAt(0) || 'S'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    {isSuperAdmin ? 'Super Admin' : (user?.branchName || userBranch || user?.role || 'Branch User')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-emerald-700 font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
