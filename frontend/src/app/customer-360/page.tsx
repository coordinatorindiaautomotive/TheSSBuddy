'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { Customer360Cockpit } from '@/components/customer-360/Customer360Cockpit';
import { RefreshCw } from 'lucide-react';

function Customer360Content() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const partyCode = searchParams.get('partyCode') || '';
  const fiscalYear = Number(searchParams.get('fiscalYear')) || 2026;
  const month = searchParams.get('month') || 'Sep';

  const handlePartyChange = (newPartyCode: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('partyCode', newPartyCode);
    router.replace(`/customer-360?${params.toString()}`, { scroll: false });
  };

  return (
    <Customer360Cockpit
      initialPartyCode={partyCode}
      initialFiscalYear={fiscalYear}
      initialMonth={month}
      onPartyChange={handlePartyChange}
    />
  );
}

export default function Customer360Page() {
  return (
    <AppShell title="Customer 360" breadcrumb="Customer 360 One-Pager">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">Loading Customer 360...</div>
            </div>
          </div>
        }
      >
        <Customer360Content />
      </Suspense>
    </AppShell>
  );
}
