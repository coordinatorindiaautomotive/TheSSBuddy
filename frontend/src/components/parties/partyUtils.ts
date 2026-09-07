'use client';

export function formatShortPartyType(type: string): string {
  if (!type || type === '-') return '-';
  const u = type.toUpperCase().trim();
  if (u.includes('INDEPENDENT WORKSHOP') || u === 'IW' || u === 'MWS') return 'IW';
  if (u === 'MASS' || u === 'MSZ') return 'MASS';
  if (u.includes('TRADER') || u.includes('RETAILER')) return 'Trader';
  if (u.includes('WALK-IN') || u.includes('WALKIN') || u.includes('OTHERS')) return 'Walk-in';
  if (u === 'CO-DEALER' || u === 'CODEALER') return 'Co-Dealer';
  if (u === 'CO-DISTRIBUTOR' || u === 'CODISTRIBUTOR') return 'Co-Distributor';
  return type;
}

export function getTypeBadgeStyle(shortType: string): string {
  switch (shortType) {
    case 'IW':
      return 'bg-violet-50 text-violet-700 border-violet-200 font-bold';
    case 'MASS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
    case 'Co-Dealer':
      return 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
    case 'Co-Distributor':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 font-bold';
    case 'Trader':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'Walk-in':
      return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 font-bold';
  }
}
