'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  Building2, CheckCircle2, Percent, Sliders, Filter, CreditCard, Shield, X
} from 'lucide-react';
import api from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatShortPartyType,
  QuickPreviewModal,
  EditPartyModal,
  AssignExecutiveModal,
  AnchoredActionDropdownMenu,
  PartyFilterToolbar,
  PartyTable,
} from '@/components/parties';

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function PartyMasterRegistryPage() {
  const { isBranchUser, userBranch, isSuperAdmin } = useAuth();

  // Filters state
  const [locationFilter, setLocationFilter] = useState('All Branches');
  const [executiveFilter, setExecutiveFilter] = useState('All Executives');
  const [partyTypeFilter, setPartyTypeFilter] = useState('All Types');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Anchored Dropdown Menu state
  const [anchoredMenu, setAnchoredMenu] = useState<{
    party: any;
    anchor: { top: number; left: number };
  } | null>(null);

  // Modals state
  const [previewParty, setPreviewParty] = useState<any>(null);
  const [editParty, setEditParty] = useState<any>(null);
  const [assignExecParty, setAssignExecParty] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());

  const effectiveLocation = isBranchUser && userBranch ? userBranch : locationFilter;

  // Data fetching: SSOT Registry from backend & live announcements
  const ssotUrl = isBranchUser && userBranch
    ? `/parties/ssot-registry?branchCode=${encodeURIComponent(userBranch)}`
    : '/parties/ssot-registry';

  const { data: ssotData, mutate: mutateSsot, isLoading } = useSWR(ssotUrl, fetcher);
  const { data: branchesData } = useSWR('/branches', fetcher);
  const { data: announcementsData } = useSWR('/notifications/announcements', fetcher, { revalidateOnFocus: true });

  const activeAnnouncement = useMemo(() => {
    if (!Array.isArray(announcementsData) || announcementsData.length === 0) return null;
    const filtered = announcementsData.filter((a: any) => a.isActive && !dismissedAnnouncementIds.has(a.id));
    return filtered.length > 0 ? filtered[0] : null;
  }, [announcementsData, dismissedAnnouncementIds]);

  const rawList: any[] = useMemo(() => {
    const list = Array.isArray(ssotData) ? ssotData : Array.isArray(ssotData?.data) ? ssotData.data : [];
    return list.filter((p: any) => {
      const code = String(p.code || p.consPartyCode || '').trim();
      const name = String(p.name || p.consPartyName || '').trim();
      if (!code || code === '-' || code === 'N/A' || code === 'NA' || code.startsWith('-')) return false;
      if (code.toUpperCase().startsWith('CONSPARTY-') || code.startsWith('raw-party-') || name.toUpperCase().startsWith('CONSPARTY-')) return false;
      return true;
    });
  }, [ssotData]);

  // Extract distinct dropdown values dynamically
  const branchesList = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(branchesData)) {
      branchesData.forEach((b: any) => {
        if (b.code) set.add(b.code);
      });
    }
    rawList.forEach((p: any) => {
      const loc = p.baseLoc || p.primaryBranchCode;
      if (loc && loc !== '-') set.add(loc);
    });
    return ['All Branches', ...Array.from(set).sort()];
  }, [branchesData, rawList]);

  const executivesList = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach(p => {
      if (p.salesExecutive && p.salesExecutive !== '-') set.add(p.salesExecutive);
    });
    return ['All Executives', ...Array.from(set).sort()];
  }, [rawList]);

  const partyTypesList = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach(p => {
      const type = String(p.type || p.partyType || '').trim();
      const shortType = formatShortPartyType(type);
      if (shortType && shortType !== '-') {
        set.add(shortType);
      }
    });
    return ['All Types', ...Array.from(set).sort()];
  }, [rawList]);

  // Filtered list
  const filteredList = useMemo(() => {
    return rawList.filter(p => {
      const pLoc = p.baseLoc || p.primaryBranchCode || '';
      const pExec = p.salesExecutive || '';
      const pType = p.type || p.partyType || '';
      const pCode = (p.code || p.consPartyCode || '').toLowerCase();
      const pName = (p.name || p.consPartyName || '').toLowerCase();
      const pPhone = (p.phone || '').toLowerCase();
      const pGst = (p.gstIn || p.gstin || '').toLowerCase();

      if (effectiveLocation !== 'All Branches' && pLoc.toUpperCase() !== effectiveLocation.toUpperCase()) return false;
      if (executiveFilter !== 'All Executives' && pExec !== executiveFilter) return false;
      if (partyTypeFilter !== 'All Types' && formatShortPartyType(pType) !== partyTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = pCode.includes(q) || pName.includes(q) || pPhone.includes(q) || pGst.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rawList, effectiveLocation, executiveFilter, partyTypeFilter, searchQuery]);

  // Sorting
  const [sortField, setSortField] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'location':
          valA = (a.baseLoc || a.primaryBranchCode || '').toLowerCase();
          valB = (b.baseLoc || b.primaryBranchCode || '').toLowerCase();
          break;
        case 'code':
          valA = (a.code || a.consPartyCode || '').toLowerCase();
          valB = (b.code || b.consPartyCode || '').toLowerCase();
          break;
        case 'originalCode':
          valA = (a.originalCode || a.code || a.consPartyCode || '').toLowerCase();
          valB = (b.originalCode || b.code || b.consPartyCode || '').toLowerCase();
          break;
        case 'name':
          valA = (a.name || a.consPartyName || '').toLowerCase();
          valB = (b.name || b.consPartyName || '').toLowerCase();
          break;
        case 'type':
          valA = (a.type || a.partyType || '').toLowerCase();
          valB = (b.type || b.partyType || '').toLowerCase();
          break;
        case 'executive':
          valA = (a.salesExecutive || '').toLowerCase();
          valB = (b.salesExecutive || '').toLowerCase();
          break;
        case 'rule':
          valA = (a.incentiveRule || a.incentiveType || '').toLowerCase();
          valB = (b.incentiveRule || b.incentiveType || '').toLowerCase();
          break;
        case 'phone':
          valA = (a.phone || '').toLowerCase();
          valB = (b.phone || '').toLowerCase();
          break;
        case 'accHolder':
          valA = (a.accountHolder || '').toLowerCase();
          valB = (b.accountHolder || '').toLowerCase();
          break;
        case 'bankAcc':
          valA = (a.accountNumber || '').toLowerCase();
          valB = (b.accountNumber || '').toLowerCase();
          break;
        case 'ifsc':
          valA = (a.ifscCode || '').toLowerCase();
          valB = (b.ifscCode || '').toLowerCase();
          break;
        case 'bankBranch':
          valA = (a.bankBranch || '').toLowerCase();
          valB = (b.bankBranch || '').toLowerCase();
          break;
        case 'bankName':
          valA = (a.bankName || '').toLowerCase();
          valB = (b.bankName || '').toLowerCase();
          break;
        case 'pan':
          valA = (a.pan || '').toLowerCase();
          valB = (b.pan || '').toLowerCase();
          break;
        case 'status':
          valA = a.isActive !== false ? 'active' : 'disabled';
          valB = b.isActive !== false ? 'active' : 'disabled';
          break;
        default:
          valA = (a.code || '').toLowerCase();
          valB = (b.code || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredList, sortField, sortOrder]);

  const displayedList = useMemo(() => {
    if (pageSize === 0) return sortedList;
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  // Metrics computation for Stat Cards
  const stats = useMemo(() => {
    const listToCount = effectiveLocation !== 'All Branches' ? filteredList : rawList;
    const total = listToCount.length;
    const active = listToCount.filter(p => p.status === 'Active' || p.isActive !== false).length;
    const fixedRate = listToCount.filter(p => (p.incentiveRule || p.incentiveType || '').toLowerCase().includes('fixed')).length;
    const slabBased = listToCount.filter(p => (p.incentiveRule || p.incentiveType || '').toLowerCase().includes('slab')).length;
    const hasBank = listToCount.filter(p => p.accountNumber && p.accountNumber !== '-' && p.accountNumber !== 'Pending Setup').length;
    const pendingBank = total - hasBank;

    return { total, active, fixedRate, slabBased, hasBank, pendingBank, reviewQueue: 0 };
  }, [rawList, filteredList, effectiveLocation]);

  // Actions
  const handleOpenActionMenu = (e: React.MouseEvent<HTMLButtonElement>, party: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const leftPos = Math.max(16, rect.right - menuWidth);
    const menuHeight = 210;
    const spaceBelow = window.innerHeight - rect.bottom;
    const topPos = spaceBelow < menuHeight + 20
      ? Math.max(16, rect.top - menuHeight - 4)
      : rect.bottom + 4;

    setAnchoredMenu({
      party,
      anchor: { top: topPos, left: leftPos },
    });
  };

  const handleTogglePartyStatus = async (party: any) => {
    const code = party.code || party.consPartyCode;
    const newStatus = party.isActive === false;
    try {
      await api.patch(`/parties/party-master/${encodeURIComponent(code)}`, {
        isActive: newStatus,
      });
      toast.success(
        newStatus
          ? `Party ${code} Enabled & Visible to Branches!`
          : `Party ${code} Disabled & Hidden from Branches!`,
      );
      mutateSsot();
      setAnchoredMenu(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update party status');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/parties/party-master/sync');
      toast.success(`Sync complete: ${res.data?.added || 0} added, ${res.data?.updated || 0} updated!`);
      mutateSsot();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Generating rich formatted Excel export...');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TheSSBuddy Portal';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Party Master Registry', {
        views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
      });

      // 1. TITLE BANNER (Row 1)
      worksheet.mergeCells('A1:R1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'THE SS BUDDY — MARUTI SUZUKI DEALER & PARTY MASTER REGISTRY';
      titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // 2. METADATA STRIP (Row 2)
      worksheet.mergeCells('A2:R2');
      const metaCell = worksheet.getCell('A2');
      const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      metaCell.value = `Export As-Of: ${nowStr}  |  Total Parties: ${filteredList.length.toLocaleString('en-IN')}  |  Location: ${locationFilter}  |  Party Type: ${partyTypeFilter}  |  Executive: ${executiveFilter}`;
      metaCell.font = { name: 'Segoe UI', size: 9.5, italic: true, bold: true, color: { argb: 'FF003366' } };
      metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF2FA' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 22;

      // 3. EMPTY SEPARATOR (Row 3)
      worksheet.getRow(3).height = 6;

      // 4. TABLE HEADERS (Row 4)
      const headers = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Original / Parent Code', key: 'originalCode', width: 22 },
        { header: 'Party Code', key: 'code', width: 18 },
        { header: 'Party Name', key: 'name', width: 34 },
        { header: 'Party Type', key: 'partyType', width: 22 },
        { header: 'Assigned Branch', key: 'branch', width: 16 },
        { header: 'Sales Executive', key: 'salesExecutive', width: 22 },
        { header: 'Mobile Number', key: 'phone', width: 16 },
        { header: 'PAN Number', key: 'pan', width: 16 },
        { header: 'GSTIN', key: 'gstIn', width: 18 },
        { header: 'Incentive Scheme Rule', key: 'incentiveRule', width: 20 },
        { header: 'Bank Name', key: 'bankName', width: 24 },
        { header: 'Bank Branch', key: 'branchName', width: 20 },
        { header: 'Account Number', key: 'accountNumber', width: 20 },
        { header: 'IFSC Code', key: 'ifscCode', width: 15 },
        { header: 'Account Holder', key: 'accountHolder', width: 26 },
        { header: 'Total Sales Turnover (₹)', key: 'totalSales', width: 24 },
        { header: 'Account Status', key: 'status', width: 15 },
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.values = headers.map(h => h.header);
      headerRow.height = 28;
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      const thinBorder: any = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      headerRow.eachCell((cell) => {
        cell.border = thinBorder;
      });

      // 5. DATA ROWS
      filteredList.forEach((p, idx) => {
        const code = p.code || p.consPartyCode || '-';
        const origCode = p.originalCode && p.originalCode !== '-' ? p.originalCode : code;
        const totalSalesNum = typeof p.totalSales === 'number' ? p.totalSales : parseFloat(p.totalSales || '0') || 0;
        const status = p.status || (p.isActive ? 'Active' : 'Disabled');

        const row = worksheet.addRow([
          idx + 1,
          origCode,
          code,
          p.name || p.consPartyName || '-',
          p.type || p.partyType || '-',
          p.baseLoc || p.primaryBranchCode || '-',
          p.salesExecutive || '-',
          p.phone || '-',
          p.pan || '-',
          p.gstIn || p.gstin || '-',
          p.incentiveRule || p.incentiveType || 'Slab-Based',
          p.bankName || '-',
          p.branchName || p.bankBranch || '-',
          p.accountNumber || 'Pending Setup',
          p.ifscCode || '-',
          p.accountHolder || (p.bankName ? (p.name || p.consPartyName) : 'Pending Setup'),
          totalSalesNum,
          status,
        ]);

        const isEven = idx % 2 === 0;
        row.height = 21;
        row.font = { name: 'Segoe UI', size: 9.5 };

        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
          };

          if ([1, 2, 3, 6, 8, 9, 10, 11, 14, 15, 18].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 17) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '₹#,##,##0.00';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          if (colNumber === 2 && origCode !== code && origCode !== '-') {
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }

          if (colNumber === 18) {
            const isActive = String(status).toLowerCase() === 'active';
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isActive ? 'FF166534' : 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isActive ? 'FFDCFCE7' : 'FFFEE2E2' } };
          }
        });
      });

      // 6. TOTALS ROW
      const lastRowNum = 4 + filteredList.length;
      const totalRow = worksheet.addRow([
        'TOTALS',
        `${filteredList.length} Parties`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        { formula: `SUM(Q5:Q${lastRowNum})` },
        '',
      ]);

      totalRow.height = 25;
      totalRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF003366' } };
      totalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF003366' } },
          bottom: { style: 'double', color: { argb: 'FF003366' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 17) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##,##0.00';
        } else if (colNumber === 1 || colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });

      headers.forEach((h, idx) => {
        worksheet.getColumn(idx + 1).width = h.width;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TheSSBuddy_Party_Master_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Rich Excel Export generated for ${filteredList.length.toLocaleString('en-IN')} parties!`, { id: toastId, icon: '📊' });
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error('Export failed: ' + (err?.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setLocationFilter('All Branches');
    setExecutiveFilter('All Executives');
    setPartyTypeFilter('All Types');
    setSearchQuery('');
    setPageSize(50);
    toast.success('Filters reset');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(displayedList.map((p, idx) => String(p.id || p.code || idx)));
      setSelectedRows(allIds);
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleRowSelect = (id: string) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  return (
    <AppShell title="Party Master" breadcrumb="Dealer Incentive Management">
      {/* Modals */}
      {previewParty && <QuickPreviewModal party={previewParty} onClose={() => setPreviewParty(null)} />}
      {editParty && (
        <EditPartyModal
          party={editParty}
          onClose={() => setEditParty(null)}
          onSuccess={() => mutateSsot()}
          isSuperAdmin={isSuperAdmin}
          branchesList={branchesList.filter(b => b !== 'All Branches')}
        />
      )}
      {assignExecParty && <AssignExecutiveModal party={assignExecParty} onClose={() => setAssignExecParty(null)} onSuccess={() => mutateSsot()} />}

      <div className="space-y-4 max-w-full">
        {/* 1. TOP ANNOUNCEMENT BANNER */}
        {activeAnnouncement && (
          <div className="bg-[#121f3d] text-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-blue-900/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/90 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                <Shield size={13} className="text-indigo-200" />
                {activeAnnouncement.type || 'ANNOUNCEMENT'}
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeAnnouncement.title}</span>
              </div>
              {activeAnnouncement.message && (
                <span className="text-xs text-blue-100 font-normal hidden md:inline">
                  — {activeAnnouncement.message}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeAnnouncement.link && (
                <a
                  href={activeAnnouncement.link}
                  className="text-xs text-blue-300 hover:text-white underline font-medium"
                >
                  View Details
                </a>
              )}
              <button
                onClick={() => setDismissedAnnouncementIds(prev => new Set(prev).add(activeAnnouncement.id))}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 2. SUB-STATUS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-1 text-slate-600">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">⏱ Last Sync:</span>
              <span className="font-semibold text-slate-800">Just now</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">🏢 Active Records:</span>
              <span className="font-bold text-slate-900">{stats.active.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">📋 Review Queue:</span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-xs">
                {stats.reviewQueue} Pending
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              System Live
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs">
              <Shield size={12} className="text-slate-500" />
              Master Admin
            </span>
          </div>
        </div>

        {/* 3. STANDARDIZED METRIC STAT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <StatCard
            title="Total Parties"
            value={isLoading ? '...' : stats.total.toLocaleString()}
            subtitle="Registered master"
            icon={<Building2 size={16} />}
          />
          <StatCard
            title="Active Parties"
            value={isLoading ? '...' : stats.active.toLocaleString()}
            subtitle="Operational & invoiced"
            icon={<CheckCircle2 size={16} />}
            trend={{ value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100}% Active`, isPositive: true }}
          />
          <StatCard
            title="Fixed Rate"
            value={isLoading ? '...' : stats.fixedRate.toLocaleString()}
            subtitle="Fixed commission %"
            icon={<Percent size={16} />}
          />
          <StatCard
            title="Slab Based"
            value={isLoading ? '...' : stats.slabBased.toLocaleString()}
            subtitle="Tiered incentive model"
            icon={<Sliders size={16} />}
          />
          <StatCard
            title="Bank Setup"
            value={`${stats.hasBank} / ${stats.total.toLocaleString()}`}
            subtitle={`${stats.pendingBank.toLocaleString()} pending`}
            icon={<CreditCard size={16} />}
          />
          <StatCard
            title="Review Queue"
            value={stats.reviewQueue}
            subtitle="Location mismatch"
            icon={<Filter size={16} />}
          />
        </div>

        {/* 4. FILTER TOOLBAR */}
        <PartyFilterToolbar
          locationFilter={locationFilter}
          setLocationFilter={setLocationFilter}
          executiveFilter={executiveFilter}
          setExecutiveFilter={setExecutiveFilter}
          partyTypeFilter={partyTypeFilter}
          setPartyTypeFilter={setPartyTypeFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          pageSize={pageSize}
          setPageSize={setPageSize}
          branchesList={branchesList}
          executivesList={executivesList}
          partyTypesList={partyTypesList}
          isBranchUser={isBranchUser}
          userBranch={userBranch}
          isSuperAdmin={isSuperAdmin}
          isSyncing={isSyncing}
          isExporting={isExporting}
          onResetFilters={handleResetFilters}
          onSync={handleSync}
          onExport={handleExport}
          onAddParty={() => setEditParty({ code: '', name: '', type: 'INDEPENDENT WORKSHOP', incentiveRule: 'Slab-Based' })}
        />

        {/* 5. DATA TABLE WITH HIGH VISIBILITY ENTERPRISE GRID */}
        <PartyTable
          displayedList={displayedList}
          filteredCount={filteredList.length}
          isLoading={isLoading}
          selectedRows={selectedRows}
          sortField={sortField}
          sortOrder={sortOrder}
          currentPage={currentPage}
          pageSize={pageSize}
          isSuperAdmin={isSuperAdmin}
          onSelectAll={handleSelectAll}
          onToggleRowSelect={toggleRowSelect}
          onSort={handleSort}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onResetFilters={handleResetFilters}
          onEditParty={setEditParty}
          onPreviewParty={setPreviewParty}
          onOpenActionMenu={handleOpenActionMenu}
        />
      </div>

      {/* Anchored Action Dropdown */}
      {anchoredMenu && (
        <AnchoredActionDropdownMenu
          party={anchoredMenu.party}
          anchor={anchoredMenu.anchor}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setAnchoredMenu(null)}
          onEditBank={() => {
            setEditParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onEditMaster={() => {
            setEditParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onPreview={() => {
            setPreviewParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onAssignExec={() => {
            setAssignExecParty(anchoredMenu.party);
            setAnchoredMenu(null);
          }}
          onToggleStatus={() => handleTogglePartyStatus(anchoredMenu.party)}
        />
      )}
    </AppShell>
  );
}
