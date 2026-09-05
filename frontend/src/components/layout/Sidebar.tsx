'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, Zap, Upload, Wallet,
  GitBranch, BookOpen, UserCog, ChevronRight,
  Receipt, Target, ChevronLeft, Menu, Sparkles, Shield,
  Layers, BarChart3, Sliders, Activity, Boxes, LifeBuoy,
  Lock, Radio
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
    label: 'MAIN NAVIGATION',
    accentColor: 'bg-blue-500',
    items: [
      {
        href: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        iconColor: 'text-cyan-400',
      },
      {
        href: '/parties',
        icon: Building2,
        label: 'Party Master',
        iconColor: 'text-sky-400',
      },
      {
        href: '/incentive-schemes',
        icon: Zap,
        label: 'Incentive Schemes',
        iconColor: 'text-amber-400',
      },
      {
        href: '/incentive-governor',
        icon: Sliders,
        label: 'Incentive Governor',
        iconColor: 'text-emerald-400',
      },
      {
        href: '/incentive-governor?tab=register',
        icon: BookOpen,
        label: 'Incentive Register',
        iconColor: 'text-amber-400',
      },
      {
        href: '/sales-upload',
        icon: Upload,
        label: 'Sales Upload',
        iconColor: 'text-indigo-400',
      },
      {
        href: '/cash-management',
        icon: Wallet,
        label: 'Cashbook',
        iconColor: 'text-orange-400',
      },
      {
        href: '/workflow',
        icon: GitBranch,
        label: 'Workflow Approvals',
        iconColor: 'text-pink-400',
      },
    ],
  },
  {
    label: 'FINANCIAL & LEDGER',
    accentColor: 'bg-cyan-500',
    items: [
      {
        href: '/target-vs-achievement',
        icon: Target,
        label: 'Party Wise Performance',
        iconColor: 'text-rose-400',
      },
      {
        href: '/outstanding',
        icon: Receipt,
        label: 'Party Wise Outstanding',
        iconColor: 'text-purple-400',
      },
      {
        href: '/ledger',
        icon: BookOpen,
        label: 'General Ledger',
        iconColor: 'text-teal-400',
      },
    ],
  },
  {
    label: 'ENTERPRISE ADMINISTRATION',
    accentColor: 'bg-indigo-500',
    items: [
      {
        href: '/assets',
        icon: Boxes,
        label: 'Asset Manager',
        iconColor: 'text-blue-400',
      },
      {
        href: '/helpdesk',
        icon: LifeBuoy,
        label: 'IT & Support Helpdesk',
        iconColor: 'text-rose-400',
      },
      {
        href: '/branches',
        icon: Building2,
        label: 'Branch Master',
        iconColor: 'text-sky-400',
      },
      {
        href: '/users',
        icon: UserCog,
        label: 'User Master',
        iconColor: 'text-lime-400',
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
        className={`h-screen fixed lg:sticky top-0 left-0 shrink-0 flex flex-col transition-all duration-300 ease-in-out select-none z-50 border-r border-[#003870] shadow-2xl overflow-hidden bg-[#001D3D] text-slate-100 ${
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#003366]/60 via-transparent to-transparent pointer-events-none" />

        {/* ─── 1. PREMIUM LOGO & BRANDING HEADER ─── */}
        <div className="h-16 flex items-center border-b-[3px] border-[#ED1C24] bg-[#003366] px-3.5 relative z-10 shrink-0 justify-between">
          {collapsed ? (
            /* COLLAPSED LOGO — GLOWING MONOGRAM (Desktop Only) */
            <div className="w-full flex items-center justify-center">
              <div className="relative p-1.5 rounded-xl bg-[#002B55] border border-[#0041A3] shadow-sm group">
                <img
                  src="/images/logo-icon-light.png"
                  alt="TheSSBuddy Monogram"
                  className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#003366]" />
              </div>
            </div>
          ) : (
            /* EXPANDED LOGO — PREMIUM ENTERPRISE BRANDING */
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative p-1.5 rounded-xl bg-[#002B55] border border-[#0041A3] shadow-xs shrink-0">
                  <img
                    src="/images/logo-icon-light.png"
                    alt="TheSSBuddy Logo Icon"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-sm tracking-tight leading-tight font-sans">
                      The<span className="text-cyan-400">SS</span>Buddy
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-[#ED1C24] text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                      PRO
                    </span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-medium tracking-normal leading-tight whitespace-nowrap mt-0.5">
                    Business Intelligence Portal
                  </p>
                </div>
              </div>

              {/* Close Button on Mobile, Collapse Toggle on Desktop */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {/* Mobile Close Button */}
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-[#002B55] hover:text-white border border-transparent transition cursor-pointer lg:hidden"
                  title="Close Menu"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Desktop Collapse Toggle */}
                {onToggle && (
                  <button
                    onClick={onToggle}
                    className="hidden lg:flex p-1.5 rounded-lg text-slate-300 hover:bg-[#002B55] hover:text-white border border-transparent transition cursor-pointer"
                    title="Collapse Sidebar"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── 2. NAVIGATION LINKS WITH ROLE ACCESS FILTERING ─── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-[#003870] relative z-10">
          {nav.map((section) => {
            const visibleItems = section.items.filter((item) => canAccessModule(item.href));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label}>
                {(!collapsed || mobileOpen) && (
                  <div className="flex items-center gap-2 px-2 mb-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] shadow-xs" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      {section.label}
                    </p>
                  </div>
                )}
                <ul className="space-y-1.5">
                  {visibleItems.map(
                    ({ href, icon: Icon, label, iconColor }) => {
                      const searchStr = typeof window !== 'undefined' ? window.location.search : '';
                      const active = href.includes('?')
                        ? pathname === href.split('?')[0] && searchStr.includes('tab=register')
                        : (pathname === href || pathname.startsWith(href + '/')) && !searchStr.includes('tab=register');

                      return (
                        <li key={href} className="relative group">
                          <Link
                            href={href}
                            prefetch={true}
                            onClick={() => {
                              onCloseMobile?.();
                            }}
                            onMouseEnter={() => {
                              try { router.prefetch(href); } catch {}
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-200 relative overflow-hidden ${
                              active
                                ? 'bg-[#0052CC] text-white font-extrabold shadow-md border border-[#0041A3]'
                                : 'text-slate-300 hover:bg-[#002B55] hover:text-white border border-transparent font-medium'
                            } ${collapsed && !mobileOpen ? 'justify-center px-2' : ''}`}
                          >
                            <Icon
                              size={17}
                              className={`shrink-0 transition-transform group-hover:scale-110 ${
                                active ? 'text-white' : iconColor || 'text-slate-300'
                              }`}
                            />

                            {(!collapsed || mobileOpen) && (
                              <span className="truncate font-semibold tracking-tight">
                                {label}
                              </span>
                            )}

                            {active && (!collapsed || mobileOpen) && (
                              <ChevronRight size={14} className="text-cyan-300 shrink-0 ml-auto font-extrabold" />
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
        <div className="p-3 border-t border-[#003870] bg-[#001D3D] relative z-10">
          {!collapsed && (
            <div className="mb-2.5 p-2 rounded-xl bg-[#002B55] border border-[#003870] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#0052CC] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-blue-400/30">
                  {displayName.charAt(0) || 'S'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium truncate">
                    {isSuperAdmin ? 'Super Admin' : (user?.branchName || userBranch || user?.role || 'Branch User')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>LIVE</span>
              </div>
            </div>
          )}

          <button
            onClick={onToggle}
            className="w-full py-2 px-3 rounded-xl bg-[#002B55] hover:bg-[#003870] border border-[#003870] text-slate-200 hover:text-white transition flex items-center justify-between text-xs font-bold cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ChevronLeft size={14} className={collapsed ? 'rotate-180 transition-transform' : ''} />
              {!collapsed && <span>Collapse Menu</span>}
            </span>
            {!collapsed && <span className="text-[10px] font-mono text-slate-400">«</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
