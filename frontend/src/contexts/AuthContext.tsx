'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => api.get(url).then((r) => r.data).catch(() => null);

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role?: string;
  roles?: string[];
  branchCode?: string;
  branchName?: string;
  assignedBranches?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isBranchUser: boolean;
  userBranch: string | null;
  userBranchName: string | null;
  branchIncharge: string | null;
  displayName: string;
  hasRole: (...roles: string[]) => boolean;
  canAccessModule: (modulePath: string) => boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Role Access Matrix
const ROLE_MODULE_PERMISSIONS: Record<string, string[]> = {
  SuperAdmin: ['*'],
  Admin: ['*'],
  HO_Finance: ['/dashboard', '/parties', '/incentive-governor', '/incentive-schemes', '/sales-upload', '/cash-management', '/workflow', '/target-vs-achievement', '/outstanding', '/ledger', '/branches', '/assets', '/helpdesk'],
  BranchManager: ['/dashboard', '/parties', '/incentive-governor', '/target-vs-achievement', '/outstanding', '/cash-management', '/assets', '/helpdesk'],
  'Branch Manager': ['/dashboard', '/parties', '/incentive-governor', '/target-vs-achievement', '/outstanding', '/cash-management', '/assets', '/helpdesk'],
  BRANCH_MANAGER: ['/dashboard', '/parties', '/incentive-governor', '/target-vs-achievement', '/outstanding', '/cash-management', '/assets', '/helpdesk'],
  SalesExecutive: ['/dashboard', '/parties', '/target-vs-achievement', '/outstanding', '/helpdesk'],
  'Sales Executive': ['/dashboard', '/parties', '/target-vs-achievement', '/outstanding', '/helpdesk'],
  SALES_EXECUTIVE: ['/dashboard', '/parties', '/target-vs-achievement', '/outstanding', '/helpdesk'],
  Dealer: ['/dashboard', '/target-vs-achievement', '/outstanding', '/helpdesk'],
  DEALER: ['/dashboard', '/target-vs-achievement', '/outstanding', '/helpdesk'],
  Auditor: ['/dashboard', '/parties', '/incentive-governor', '/target-vs-achievement', '/outstanding', '/ledger'],
  AUDITOR: ['/dashboard', '/parties', '/incentive-governor', '/target-vs-achievement', '/outstanding', '/ledger'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchMasterDetails, setBranchMasterDetails] = useState<{ name?: string; incharge?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {}
    }

    // Refresh profile in background to get latest fullName and assigned details
    if (token) {
      api.get('/profile').then((res) => {
        if (res.data) {
          const profile = res.data;
          const roleNames: string[] = profile.roles ? profile.roles.map((r: any) => r.role?.name || r.name) : [profile.role || ''];
          const isSuper = roleNames.some((r: string) => (r || '').toUpperCase().includes('SUPER') || (r || '').toUpperCase().includes('ADMIN')) || profile.username?.toLowerCase() === 'admin';

          if (isSuper) {
            // SuperAdmin: Global scope across all branches, clean identity
            const updated: User = {
              id: profile.id,
              username: profile.username,
              fullName: profile.fullName || 'Administrator',
              email: profile.email,
              role: 'SuperAdmin',
              roles: roleNames,
              branchCode: undefined,
              branchName: undefined,
              assignedBranches: undefined,
            };
            localStorage.setItem('user', JSON.stringify(updated));
            setUser(updated);
            setBranchMasterDetails(null);
          } else {
            // Branch User: Locked to their specific assigned branch
            const assignedCode = profile.branchCode || profile.defaultBranch || (profile.branchAccesses && profile.branchAccesses[0]?.branchCode);
            const roleName = roleNames[0] || 'Branch Manager';
            const updated: User = {
              id: profile.id,
              username: profile.username,
              fullName: profile.fullName || profile.username,
              email: profile.email,
              role: roleName,
              roles: roleNames,
              branchCode: assignedCode,
              assignedBranches: profile.branchAccesses ? profile.branchAccesses.map((b: any) => b.branchCode) : (assignedCode ? [assignedCode] : []),
            };

            if (assignedCode) {
              api.get(`/branches/${assignedCode}`).then((bRes) => {
                if (bRes.data) {
                  const branchIncharge = bRes.data.incharge || bRes.data.managerName || profile.fullName;
                  const bName = bRes.data.name || bRes.data.branchName || assignedCode;
                  setBranchMasterDetails({
                    name: bName,
                    incharge: branchIncharge,
                  });
                  updated.fullName = branchIncharge;
                  updated.branchName = bName;
                  localStorage.setItem('user', JSON.stringify(updated));
                  setUser(updated);
                }
              }).catch(() => {
                localStorage.setItem('user', JSON.stringify(updated));
                setUser(updated);
              });
            } else {
              localStorage.setItem('user', JSON.stringify(updated));
              setUser(updated);
            }
          }
        }
      }).catch(() => {});
    }

    setLoading(false);
  }, []);

  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    const roles = (user.roles || []).map((r) => r.toUpperCase());
    return (
      role === 'SUPERADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'ADMIN' ||
      roles.includes('SUPERADMIN') ||
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      user.username?.toLowerCase() === 'admin'
    );
  }, [user]);

  const userBranch = useMemo(() => {
    if (!user || isSuperAdmin) return null;
    return user.branchCode || (user.assignedBranches && user.assignedBranches[0]) || null;
  }, [user, isSuperAdmin]);

  // Live Branch Master Query (Only for branch users)
  const { data: currentBranchData } = useSWR(
    !isSuperAdmin && userBranch ? `/branches/${userBranch}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const branchIncharge = useMemo(() => {
    if (isSuperAdmin) return null;
    return currentBranchData?.incharge || currentBranchData?.managerName || branchMasterDetails?.incharge || null;
  }, [currentBranchData, branchMasterDetails, isSuperAdmin]);

  const userBranchName = useMemo(() => {
    if (!userBranch || isSuperAdmin) return null;
    return currentBranchData?.name || currentBranchData?.branchName || branchMasterDetails?.name || userBranch;
  }, [userBranch, currentBranchData, branchMasterDetails, isSuperAdmin]);

  const displayName = useMemo(() => {
    if (!user) return 'Administrator';
    if (isSuperAdmin) {
      return user.fullName || user.username || 'Administrator';
    }
    if (branchIncharge) return branchIncharge;
    return user.fullName || user.username || 'Branch Manager';
  }, [user, isSuperAdmin, branchIncharge]);

  const isBranchUser = useMemo(() => {
    return !isSuperAdmin && Boolean(userBranch);
  }, [isSuperAdmin, userBranch]);

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const userRoles = [user.role, ...(user.roles || [])].filter(Boolean).map((r) => r!.toUpperCase());
    return roles.some((r) => userRoles.includes(r.toUpperCase()));
  };

  const canAccessModule = (modulePath: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;

    const userRoles = [user.role, ...(user.roles || [])].filter(Boolean) as string[];
    if (userRoles.length === 0) userRoles.push('Dealer');

    for (const rawRole of userRoles) {
      const normalized = rawRole.replace(/\s+/g, '');
      const allowed = ROLE_MODULE_PERMISSIONS[rawRole] || ROLE_MODULE_PERMISSIONS[normalized] || [];
      if (allowed.includes('*')) return true;
      const cleanPath = modulePath.split('?')[0];
      if (allowed.some((p) => cleanPath === p || cleanPath.startsWith(p + '/'))) return true;
    }

    const defaultAllowed = ROLE_MODULE_PERMISSIONS['Dealer'] || [];
    const cleanPath = modulePath.split('?')[0];
    return defaultAllowed.some((p) => cleanPath === p || cleanPath.startsWith(p + '/'));
  };

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const { accessToken, refreshToken, user: userData } = res.data;
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);

    const roleList: string[] = userData.roles || (userData.role ? [userData.role] : []);
    const isSuper = roleList.some((r: string) => r.toUpperCase().includes('SUPER') || r.toUpperCase().includes('ADMIN')) || username.toLowerCase() === 'admin';
    const assignedCode = userData.branchCode || (userData.assignedBranches && userData.assignedBranches[0]);
    
    if (isSuper) {
      userData.branchCode = undefined;
      userData.branchName = undefined;
      userData.assignedBranches = undefined;
      setBranchMasterDetails(null);
    } else if (assignedCode) {
      try {
        const bRes = await api.get(`/branches/${assignedCode}`);
        if (bRes.data) {
          const bIncharge = bRes.data.incharge || bRes.data.managerName;
          const bName = bRes.data.name || bRes.data.branchName;
          if (bIncharge) userData.fullName = bIncharge;
          if (bName) userData.branchName = bName;
          setBranchMasterDetails({
            name: bName,
            incharge: bIncharge,
          });
        }
      } catch {}
    }

    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    router.push('/dashboard');
    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSuperAdmin,
        isBranchUser,
        userBranch,
        userBranchName,
        branchIncharge,
        displayName,
        hasRole,
        canAccessModule,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
