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
        activeGlow: 'shadow-[0_0_15px_rgba(34,211,238,0.35)]',
        iconBoxBg: 'from-cyan-500/25 to-blue-600/30 border-cyan-400/40',
      },
      {
        href: '/parties',
        icon: Building2,
        label: 'Party Master',
        iconColor: 'text-emerald-400',
        activeGlow: 'shadow-[0_0_15px_rgba(52,211,153,0.35)]',
        iconBoxBg: 'from-emerald-500/25 to-teal-600/30 border-emerald-400/40',
      },
      {
        href: '/incentive-schemes',
        icon: Zap,
        label: 'Incentive Schemes',
        iconColor: 'text-amber-400',
        activeGlow: 'shadow-[0_0_15px_rgba(251,191,36,0.35)]',
        iconBoxBg: 'from-amber-500/25 to-orange-600/30 border-amber-400/40',
      },
      {
        href: '/incentive-governor',
        icon: Sliders,
        label: 'Incentive Governor',
        iconColor: 'text-emerald-400',
        activeGlow: 'shadow-[0_0_15px_rgba(52,211,153,0.35)]',
        iconBoxBg: 'from-emerald-500/25 to-teal-600/30 border-emerald-400/40',
      },
      {
        href: '/incentive-governor?tab=register',
        icon: BookOpen,
        label: 'Incentive Register',
        iconColor: 'text-amber-400',
        activeGlow: 'shadow-[0_0_15px_rgba(251,191,36,0.35)]',
        iconBoxBg: 'from-amber-500/25 to-orange-600/30 border-amber-400/40',
      },
      {
        href: '/sales-upload',
        icon: Upload,
        label: 'Sales Upload',
        iconColor: 'text-indigo-400',
        activeGlow: 'shadow-[0_0_15px_rgba(129,140,248,0.35)]',
        iconBoxBg: 'from-indigo-500/25 to-purple-600/30 border-indigo-400/40',
      },
      {
        href: '/cash-management',
        icon: Wallet,
        label: 'Cashbook',
        iconColor: 'text-orange-400',
        activeGlow: 'shadow-[0_0_15px_rgba(251,146,60,0.35)]',
        iconBoxBg: 'from-orange-500/25 to-red-600/30 border-orange-400/40',
      },
      {
        href: '/workflow',
        icon: GitBranch,
        label: 'Workflow Approvals',
        iconColor: 'text-pink-400',
        activeGlow: 'shadow-[0_0_15px_rgba(244,114,182,0.35)]',
        iconBoxBg: 'from-pink-500/25 to-rose-600/30 border-pink-400/40',
      },
    ],
  },
  {
    label: 'FINANCIAL & LEDGER',
    accentColor: 'bg-emerald-500',
    items: [
      {
        href: '/target-vs-achievement',
        icon: Target,
        label: 'Party Wise Performance',
        iconColor: 'text-rose-400',
        activeGlow: 'shadow-[0_0_15px_rgba(251,113,133,0.35)]',
        iconBoxBg: 'from-rose-500/25 to-red-600/30 border-rose-400/40',
      },
      {
        href: '/outstanding',
        icon: Receipt,
        label: 'Party Wise Outstanding',
        iconColor: 'text-purple-400',
        activeGlow: 'shadow-[0_0_15px_rgba(192,132,252,0.35)]',
        iconBoxBg: 'from-purple-500/25 to-indigo-600/30 border-purple-400/40',
      },
      {
        href: '/ledger',
        icon: BookOpen,
        label: 'General Ledger',
        iconColor: 'text-teal-400',
        activeGlow: 'shadow-[0_0_15px_rgba(45,212,191,0.35)]',
        iconBoxBg: 'from-teal-500/25 to-emerald-600/30 border-teal-400/40',
      },
    ],
  },
  {
    label: 'ENTERPRISE ADMINISTRATION',
    accentColor: 'bg-purple-500',
    items: [
      {
        href: '/assets',
        icon: Boxes,
        label: 'Asset Manager',
        iconColor: 'text-blue-400',
        activeGlow: 'shadow-[0_0_15px_rgba(96,165,250,0.35)]',
        iconBoxBg: 'from-blue-500/25 to-indigo-600/30 border-blue-400/40',
      },
      {
        href: '/helpdesk',
        icon: LifeBuoy,
        label: 'IT & Support Helpdesk',
        iconColor: 'text-rose-400',
        activeGlow: 'shadow-[0_0_15px_rgba(251,113,133,0.35)]',
        iconBoxBg: 'from-rose-500/25 to-pink-600/30 border-rose-400/40',
      },
      {
        href: '/branches',
        icon: Building2,
        label: 'Branch Master',
        iconColor: 'text-sky-400',
        activeGlow: 'shadow-[0_0_15px_rgba(56,189,248,0.35)]',
        iconBoxBg: 'from-sky-500/25 to-blue-600/30 border-sky-400/40',
      },
      {
        href: '/users',
        icon: UserCog,
        label: 'User Master',
        iconColor: 'text-lime-400',
        activeGlow: 'shadow-[0_0_15px_rgba(163,230,53,0.35)]',
        iconBoxBg: 'from-lime-500/25 to-green-600/30 border-lime-400/40',
      },
    ],
  },
];

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessModule, isBranchUser, userBranch, user, isSuperAdmin, displayName } = useAuth();

  return (
    <aside
      className={`h-screen sticky top-0 shrink-0 flex flex-col transition-all duration-300 ease-in-out select-none relative z-40 border-r border-[#074B47] shadow-2xl overflow-hidden ${
        collapsed ? 'w-20' : 'w-64'
      } bg-[#032F2D] text-slate-100`}
    >
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#053D3A]/50 via-transparent to-transparent pointer-events-none" />

      {/* ─── 1. PREMIUM LOGO & BRANDING HEADER ─── */}
      <div className="h-16 flex items-center border-b border-[#074B47] bg-[#032F2D] px-3.5 relative z-10 shrink-0 justify-between">
        {collapsed ? (
          /* COLLAPSED LOGO — GLOWING MONOGRAM */
          <div className="w-full flex items-center justify-center">
            <div className="relative p-1.5 rounded-xl bg-[#053D3A] border border-[#074B47] shadow-sm group">
              <img
                src="/images/logo-icon-light.png"
                alt="TheSSBuddy Monogram"
                className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#032F2D]" />
            </div>
          </div>
        ) : (
          /* EXPANDED LOGO — PREMIUM ENTERPRISE BRANDING */
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative p-1.5 rounded-xl bg-[#053D3A] border border-[#074B47] shadow-xs shrink-0">
                <img
                  src="/images/logo-icon-light.png"
                  alt="TheSSBuddy Logo Icon"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm tracking-tight leading-tight font-sans">
                    The<span className="text-[#FFE2B8]">SS</span>Buddy
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#FFE2B8]/20 text-[#FFE2B8] border border-[#FFE2B8]/30 text-[9px] font-mono font-bold uppercase">
                    PRO
                  </span>
                </div>
                <p className="text-[#DCEDEA] text-[10px] font-medium tracking-normal leading-tight whitespace-nowrap mt-0.5">
                  Business Intelligence Portal
                </p>
              </div>
            </div>

            {/* Collapse Toggle Button */}
            {onToggle && (
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg text-[#DCEDEA] hover:bg-[#074B47] hover:text-white border border-transparent transition cursor-pointer shrink-0 ml-1"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── 2. NAVIGATION LINKS WITH ROLE ACCESS FILTERING ─── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-[#074B47] relative z-10">
        {nav.map((section) => {
          const visibleItems = section.items.filter((item) => canAccessModule(item.href));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFE2B8] shadow-xs" />
                  <p className="text-[#7B8985] text-[10px] font-bold uppercase tracking-wider">
                    {section.label}
                  </p>
                </div>
              )}
              <ul className="space-y-1.5">
                {visibleItems.map(
                  ({ href, icon: Icon, label }) => {
                    const searchStr = typeof window !== 'undefined' ? window.location.search : '';
                    const active = href.includes('?')
                      ? pathname === href.split('?')[0] && searchStr.includes('tab=register')
                      : (pathname === href || pathname.startsWith(href + '/')) && !searchStr.includes('tab=register');

                    return (
                      <li key={href} className="relative group">
                        <Link
                          href={href}
                          prefetch={true}
                          onMouseEnter={() => {
                            try { router.prefetch(href); } catch {}
                          }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all duration-200 relative overflow-hidden ${
                            active
                              ? 'bg-[#FFE2B8] text-[#053D3A] font-extrabold shadow-md border border-[#FFD49A]'
                              : 'text-[#DCEDEA] hover:bg-[#074B47] hover:text-white border border-transparent font-medium'
                          } ${collapsed ? 'justify-center px-2' : ''}`}
                        >
                          <Icon
                            size={17}
                            className={`shrink-0 transition-transform group-hover:scale-110 ${
                              active ? 'text-[#053D3A]' : 'text-[#DCEDEA]'
                            }`}
                          />

                          {!collapsed && (
                            <span className="truncate font-semibold tracking-tight">
                              {label}
                            </span>
                          )}

                          {active && !collapsed && (
                            <ChevronRight size={14} className="text-[#053D3A] shrink-0 ml-auto font-extrabold" />
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
      <div className="p-3 border-t border-[#074B47] bg-[#032F2D] relative z-10">
        {!collapsed && (
          <div className="mb-2.5 p-2 rounded-xl bg-[#053D3A] border border-[#074B47] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#FFE2B8] text-[#053D3A] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FFD49A]">
                {displayName.charAt(0) || 'S'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[#DCEDEA] font-medium truncate">
                  {isSuperAdmin ? 'Super Admin' : (user?.branchName || userBranch || user?.role || 'Branch User')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className="w-full py-2 px-3 rounded-xl bg-[#053D3A] hover:bg-[#074B47] border border-[#074B47] text-[#DCEDEA] hover:text-white transition flex items-center justify-between text-xs font-bold cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ChevronLeft size={14} className={collapsed ? 'rotate-180 transition-transform' : ''} />
            {!collapsed && <span>Collapse Menu</span>}
          </span>
          {!collapsed && <span className="text-[10px] font-mono text-[#7B8985]">«</span>}
        </button>
      </div>
    </aside>
  );
}
