'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  breadcrumb?: string;
}

export default function AppShell({ children, title, breadcrumb }: AppShellProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleMobileSidebar = () => {
    setMobileOpen((prev) => !prev);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F3]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#053D3A] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-sm font-bold">Connecting to TheSSBuddy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
        <Topbar
          title={title}
          breadcrumb={breadcrumb}
          onToggleSidebar={toggleSidebar}
          onToggleMobileSidebar={toggleMobileSidebar}
          isSidebarCollapsed={collapsed}
        />
        <main className="flex-1 p-2 sm:p-4 lg:p-5 overflow-x-hidden overflow-y-auto scrollbar-thin">
          <div className="w-full space-y-4 sm:space-y-5 fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
