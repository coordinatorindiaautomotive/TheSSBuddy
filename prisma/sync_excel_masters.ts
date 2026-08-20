import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();

async function main() {
  const filepath = "C:\\Users\\coord\\Downloads\\1d13ee1d-ca76-49f7-a81b-0ae9703700b7.xlsx";
  console.log('Scanning unique branches and dealers from:', filepath);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filepath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Empty worksheet!");

  const locs = new Set<string>();
  const dealerCodes = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const loc = row.getCell(3).text?.trim(); // Loc column
    const dealerCode = row.getCell(2).text?.trim(); // Dealer Code column
    if (loc) locs.add(loc);
    if (dealerCode) dealerCodes.add(dealerCode);
  });

  const uniqueLocs = Array.from(locs).filter(Boolean);
  console.log('Found unique Locs:', uniqueLocs);
  console.log('Found unique Dealer Codes count:', dealerCodes.size);

  // 1. Upsert branches
  for (const loc of uniqueLocs) {
    await prisma.branch.upsert({
      where: { code: loc },
      update: { isActive: true },
      create: { code: loc, name: `${loc} Branch`, isActive: true },
    });
    console.log(`Upserted Branch: ${loc}`);
  }

  // 2. Upsert dealers
  let partyCount = 0;
  for (const code of Array.from(dealerCodes).filter(Boolean)) {
    await prisma.party.upsert({
      where: { code },
      update: { isActive: true },
      create: {
        code,
        name: `${code} Dealer`,
        type: 'DEALER',
        isActive: true,
      },
    });
    partyCount++;
  }
  console.log(`Upserted ${partyCount} Parties/Dealers`);

  // 3. Grant access to all branches to user "admin"
  const admin = await prisma.user.findFirst({
    where: { username: 'admin' },
  });

  if (admin) {
    for (const loc of uniqueLocs) {
      await prisma.userBranchAccess.upsert({
        where: {
          userId_branchCode: {
            userId: admin.id,
            branchCode: loc,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          branchCode: loc,
          isDefault: false,
        },
      });
      console.log(`Granted access to branch ${loc} to admin user.`);
    }
  }

  console.log('Synchronization complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
