import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. In RetailSalesRecord
  const retailParties = await prisma.retailSalesRecord.groupBy({
    by: ['consPartyCode', 'consPartyName', 'partyType'],
    where: {
      AND: [
        { consPartyCode: { not: '' } },
        { consPartyCode: { not: '-' } },
        { consPartyCode: { not: 'N/A' } },
        { consPartyCode: { not: 'NA' } },
        { consPartyCode: { not: null } },
      ],
    },
    _count: { id: true },
  });

  console.log('Unique non-hyphen party combinations in RetailSalesRecord:', retailParties.length);
  
  // Breakdown by partyType in RetailSalesRecord
  const typeCounts: Record<string, number> = {};
  for (const p of retailParties) {
    const t = p.partyType || 'UNKNOWN';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  console.log('RetailSalesRecord unique parties by partyType:', typeCounts);

  // 2. In RawSales (if populated)
  const rawSalesCount = await prisma.rawSales.count();
  console.log('RawSales total rows count:', rawSalesCount);
  if (rawSalesCount > 0) {
    const rawParties = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(DISTINCT cons_party_code) as count
      FROM raw_sales
      WHERE TRIM(cons_party_code) <> '' AND TRIM(cons_party_code) <> '-' AND cons_party_code IS NOT NULL
    `);
    console.log('RawSales unique non-hyphen cons_party_code count:', rawParties[0]?.count);

    const rawPartiesWithTypes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT party_type, COUNT(DISTINCT cons_party_code) as count
      FROM raw_sales
      WHERE TRIM(cons_party_code) <> '' AND TRIM(cons_party_code) <> '-' AND cons_party_code IS NOT NULL
      GROUP BY party_type
    `);
    console.log('RawSales unique parties by party_type:', rawPartiesWithTypes);
  }

  // 3. Current in PartyMaster
  const pmCount = await prisma.partyMaster.count();
  console.log('PartyMaster current count:', pmCount);
  const pmTypes = await prisma.partyMaster.groupBy({
    by: ['partyType'],
    _count: { id: true },
  });
  console.log('PartyMaster current breakdown:', pmTypes);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
