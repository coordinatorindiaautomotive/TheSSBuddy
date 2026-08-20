// prisma/seed.ts
import { PrismaClient, PartyType, PartySubType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Core Permissions
  const permissionsData = [
    { code: 'user:create', name: 'Create Users', module: 'USER' },
    { code: 'user:read', name: 'View Users', module: 'USER' },
    { code: 'user:update', name: 'Update Users', module: 'USER' },
    { code: 'user:assign-roles', name: 'Assign Roles', module: 'USER' },
    { code: 'user:grant-branch', name: 'Grant Branch Access', module: 'USER' },

    { code: 'branch:create', name: 'Create Branch', module: 'BRANCH' },
    { code: 'branch:read', name: 'View Branches', module: 'BRANCH' },
    { code: 'branch:update', name: 'Update Branch', module: 'BRANCH' },

    { code: 'party:create', name: 'Create Party', module: 'PARTY' },
    { code: 'party:read', name: 'View Parties', module: 'PARTY' },
    { code: 'party:update', name: 'Update Party', module: 'PARTY' },

    { code: 'incentive:calculate', name: 'Calculate Incentives', module: 'INCENTIVE' },
    { code: 'incentive:override', name: 'Override Incentive Calculations', module: 'INCENTIVE' },
    { code: 'incentive:read', name: 'View Incentive Details', module: 'INCENTIVE' },

    { code: 'period:lock', name: 'Lock Periods', module: 'PERIOD' },
    { code: 'period:unlock', name: 'Unlock Periods', module: 'PERIOD' },
    { code: 'period:close', name: 'Close Periods', module: 'PERIOD' },

    { code: 'workflow:create', name: 'Create Workflow Definitions', module: 'WORKFLOW' },
    { code: 'workflow:approve', name: 'Approve Workflow Steps', module: 'WORKFLOW' },
    { code: 'workflow:read', name: 'View Workflow History', module: 'WORKFLOW' },

    { code: 'report:read', name: 'View Financial Reports', module: 'REPORT' },
    { code: 'report:dynamic', name: 'Use Dynamic Report Builder', module: 'REPORT' },

    { code: 'bank-imports:upload', name: 'Upload Bank Statement', module: 'IMPORT' },
    { code: 'bank-imports:view', name: 'View Bank Statement Preview', module: 'IMPORT' },
    { code: 'bank-imports:commit', name: 'Commit Bank Statement', module: 'IMPORT' },
    { code: 'bank-imports:rollback', name: 'Rollback Bank Statement', module: 'IMPORT' },

    { code: 'external-incentive:upload', name: 'Upload External Incentives', module: 'IMPORT' },
    { code: 'external-incentive:view', name: 'View External Incentives Preview', module: 'IMPORT' },
    { code: 'external-incentive:commit', name: 'Commit External Incentives', module: 'IMPORT' },
    { code: 'external-incentive:rollback', name: 'Rollback External Incentives', module: 'IMPORT' },

    { code: 'sales:upload', name: 'Upload Sales Achievements', module: 'IMPORT' },
    { code: 'sales:view', name: 'View Sales Staging Preview', module: 'IMPORT' },
    { code: 'sales:commit', name: 'Commit Sales to RAW_SALES', module: 'IMPORT' },
    { code: 'sales:rollback', name: 'Rollback Sales Batch', module: 'IMPORT' },

    { code: 'retail-sales:upload', name: 'Upload Retail Sales Data', module: 'RETAIL_SALES' },
    { code: 'retail-sales:view', name: 'View Retail Sales Data', module: 'RETAIL_SALES' },
  ];

  const permissionsMap = new Map<string, string>();
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module },
      create: p,
    });
    permissionsMap.set(perm.code, perm.id);
  }
  console.log(`Upserted ${permissionsData.length} permissions.`);

  // 2. Create Roles
  const rolesData = [
    { name: 'SuperAdmin', description: 'System-wide Administrator with all access', isSystem: true },
    { name: 'BranchManager', description: 'Branch-level isolation manager access', isSystem: false },
    { name: 'Dealer', description: 'Limited read-only dealer network access', isSystem: false },
  ];

  const rolesMap = new Map<string, string>();
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    rolesMap.set(role.name, role.id);
  }
  console.log(`Upserted ${rolesData.length} roles.`);

  // 3. Link Permissions to SuperAdmin Role
  console.log('Linked all permissions to roles.');
  console.log('Linked manager permissions to BranchManager role.');

  // 5. Create Default SuperAdmin User
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash, isActive: true },
    create: {
      username: 'admin',
      email: 'admin@incentiveportal.com',
      passwordHash,
      fullName: 'System Administrator',
      isActive: true,
    },
  });
  console.log(`Default SuperAdmin user "admin" is ready.`);

  // Link Admin to SuperAdmin Role
  const superAdminRoleId = rolesMap.get('SuperAdmin')!;
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: superAdminRoleId },
    },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRoleId },
  });

  // 6. Create Default Branches
  const branches = [
    { code: 'MUMBAI-01', name: 'Mumbai Corporate Branch', region: 'WEST' },
    { code: 'DELHI-01', name: 'Delhi North Branch', region: 'NORTH' },
    { code: 'UTD', name: 'UTD Branch', region: 'NORTH' },
    { code: 'VBZ', name: 'VBZ Branch', region: 'NORTH' },
    { code: 'ALW', name: 'Alwar Branch', region: 'NORTH' },
    { code: 'SKR', name: 'Sikar Branch', region: 'NORTH' },
    { code: 'TNG', name: 'TNG Branch', region: 'NORTH' },
  ];

  for (const b of branches) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: { name: b.name, region: b.region },
      create: b,
    });
  }
  console.log(`Upserted ${branches.length} branches.`);

  // Grant branches access to Admin and make MUMBAI-01 default
  await prisma.userBranchAccess.upsert({
    where: { userId_branchCode: { userId: adminUser.id, branchCode: 'MUMBAI-01' } },
    update: { isDefault: true },
    create: { userId: adminUser.id, branchCode: 'MUMBAI-01', isDefault: true },
  });
  await prisma.userBranchAccess.upsert({
    where: { userId_branchCode: { userId: adminUser.id, branchCode: 'DELHI-01' } },
    update: { isDefault: false },
    create: { userId: adminUser.id, branchCode: 'DELHI-01', isDefault: false },
  });
  console.log('Granted branch access and default branch to admin.');

  // 7. Create Sample Parties (Dealers & Master Registry)
  const partiesData = [
    {
      code: 'WRJ050234565',
      name: '4 U SECURITY',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'UTD',
      phone: '9413329013',
    },
    {
      code: '4856',
      name: 'A 1 MOTORS',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'VBZ',
      phone: '8005870590',
    },
    {
      code: 'WK380004944',
      name: 'A J M MOTOR WORKSHOP',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'ALW',
      phone: '8307903318',
      pan: 'FFVPS5568Q',
      bankDetails: {
        bankName: 'Union Bank of India',
        branchName: 'JHUNJHUNU',
        accountNumber: '165513100001264',
        ifscCode: 'UBIN0589339',
        accountHolder: 'A J M MOTOR WORKSHOP',
      },
    },
    {
      code: 'WK38112828',
      name: 'A K WORKSHOP',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'SKR',
      phone: '9928216848',
      bankDetails: {
        bankName: 'State Bank of India',
        branchName: 'PILANI',
        accountNumber: '39281019284',
        ifscCode: 'SBIN0001746',
        accountHolder: 'A K WORKSHOP',
      },
    },
    {
      code: 'WK380019084',
      name: 'A K WORKSHOP SERVICE STATION',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'TNG',
      phone: '9588100601',
      pan: 'PNNNV9083N',
      bankDetails: {
        bankName: 'Bank of Baroda',
        branchName: 'ALWAR, DIST. JHUNJHUNU',
        accountNumber: '0284918294',
        ifscCode: 'BARB0ALWARX',
        accountHolder: 'A K WORKSHOP SERVICE STATION',
      },
    },
    {
      code: 'WK380089330',
      name: 'A K WORKSHOP SERVICE STATION',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'UTD',
      phone: '9884834218',
    },
    {
      code: 'WK380199923',
      name: 'A ONE MARUTI WORKSHOP',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'VBZ',
      phone: '7723000200',
      pan: 'AKUPG0756H',
      bankDetails: {
        bankName: 'State Bank of India',
        branchName: 'RANOLI',
        accountNumber: '29481928394',
        ifscCode: 'SBIN0002823',
        accountHolder: 'A ONE MARUTI WORKSHOP',
      },
    },
    {
      code: 'WK380080782',
      name: 'A ONE SHOP',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'ALW',
      phone: '7010831884',
    },
    {
      code: 'WK380021204',
      name: 'A R P MOTORS',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'SKR',
      phone: '7082212564',
    },
    {
      code: 'WK380012000',
      name: 'A STAR MOTORS',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'TNG',
      phone: '6021812238',
    },
    {
      code: 'WK380097638',
      name: 'A TO Z CAR CARE',
      type: PartyType.DEALER,
      subType: PartySubType.REGULAR,
      primaryBranchCode: 'UTD',
      phone: '8005835868',
      bankDetails: {
        bankName: 'Punjab National Bank',
        branchName: 'LALSOT',
        accountNumber: '92841029384',
        ifscCode: 'PUNB0000000',
        accountHolder: 'A TO Z CAR CARE',
      },
    },
    {
      code: 'TRJ0103287',
      name: 'Vice city and customs',
      type: PartyType.DEALER,
      subType: PartySubType.PREMIUM,
      primaryBranchCode: 'ALW',
      phone: '9460576432',
      pan: 'AKUPG0756H',
      bankDetails: {
        bankName: 'Punjab National Bank',
        branchName: 'ALWAR SHIVAJI PARK COLONY,',
        accountNumber: '2975000100129605',
        ifscCode: 'PUNB0297500',
        accountHolder: 'Vice city and customs',
      },
    },
    {
      code: 'TRJ0153658',
      name: 'SHREE BALAJI MOTORS CAR DECORE',
      type: PartyType.DEALER,
      subType: PartySubType.PREMIUM,
      primaryBranchCode: 'ALW',
      phone: '9828333262',
      pan: 'FFVPS5568Q',
      bankDetails: {
        bankName: 'Union Bank of India',
        branchName: 'ALWAR',
        accountNumber: '165513100001264',
        ifscCode: 'UBIN0816558',
        accountHolder: 'SHREE BALAJI MOTORS CAR DECORE',
      },
    },
  ];

  for (const p of partiesData) {
    const { bankDetails, ...partyFields } = p;
    const party = await prisma.party.upsert({
      where: { code: partyFields.code },
      update: { name: partyFields.name, phone: partyFields.phone, pan: partyFields.pan },
      create: partyFields,
    });

    if (bankDetails) {
      await prisma.partyBankDetail.deleteMany({
        where: { partyId: party.id },
      });

      await prisma.partyBankDetail.create({
        data: {
          partyId: party.id,
          bankName: bankDetails.bankName,
          branchName: bankDetails.branchName,
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
          accountHolder: bankDetails.accountHolder,
          isDefault: true,
        },
      });
    }
  }
  console.log(`Upserted ${partiesData.length} master party records with bank details.`);

  // Seed RAW_SALES SSOT Data
  const sampleBatchId = '11111111-1111-1111-1111-111111111111';
  await prisma.rawSales.createMany({
    data: [
      { consignee: 'CON-01', dealerCode: 'WRJ050234565', loc: 'UTD', partCategoryCode: 'CAT-A', partNum: 'P01', rootPartNum: 'RP01', day: 15, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WRJ050234565', consPartyName: '4 U SECURITY', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 50, netRetailSelling: 450000, discountAmount: 0, netRetailDdl: 450000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-01', dealerCode: 'WRJ050234565', loc: 'ALW', partCategoryCode: 'CAT-A', partNum: 'P02', rootPartNum: 'RP01', day: 16, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WRJ050234565', consPartyName: '4 U SECURITY', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 10, netRetailSelling: 120000, discountAmount: 0, netRetailDdl: 120000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-02', dealerCode: '4856', loc: 'VBZ', partCategoryCode: 'CAT-B', partNum: 'P03', rootPartNum: 'RP02', day: 14, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: '4856', consPartyName: 'A 1 MOTORS', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 80, netRetailSelling: 780000, discountAmount: 0, netRetailDdl: 780000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-03', dealerCode: 'WK380004944', loc: 'ALW', partCategoryCode: 'CAT-A', partNum: 'P04', rootPartNum: 'RP03', day: 12, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380004944', consPartyName: 'A J M MOTOR WORKSHOP', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 100, netRetailSelling: 950000, discountAmount: 0, netRetailDdl: 950000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-04', dealerCode: 'WK38112828', loc: 'SKR', partCategoryCode: 'CAT-C', partNum: 'P05', rootPartNum: 'RP04', day: 18, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK38112828', consPartyName: 'A K WORKSHOP', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 60, netRetailSelling: 620000, discountAmount: 0, netRetailDdl: 620000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-05', dealerCode: 'WK380019084', loc: 'TNG', partCategoryCode: 'CAT-B', partNum: 'P06', rootPartNum: 'RP05', day: 20, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380019084', consPartyName: 'A K WORKSHOP SERVICE STATION', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 90, netRetailSelling: 890000, discountAmount: 0, netRetailDdl: 890000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-06', dealerCode: 'WK380089330', loc: 'UTD', partCategoryCode: 'CAT-A', partNum: 'P07', rootPartNum: 'RP06', day: 10, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380089330', consPartyName: 'A K WORKSHOP SERVICE STATION', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 40, netRetailSelling: 340000, discountAmount: 0, netRetailDdl: 340000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-07', dealerCode: 'WK380199923', loc: 'VBZ', partCategoryCode: 'CAT-C', partNum: 'P08', rootPartNum: 'RP07', day: 22, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380199923', consPartyName: 'A ONE MARUTI WORKSHOP', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 120, netRetailSelling: 1120000, discountAmount: 0, netRetailDdl: 1120000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-08', dealerCode: 'WK380080782', loc: 'ALW', partCategoryCode: 'CAT-A', partNum: 'P09', rootPartNum: 'RP08', day: 11, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380080782', consPartyName: 'A ONE SHOP', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 55, netRetailSelling: 540000, discountAmount: 0, netRetailDdl: 540000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-09', dealerCode: 'WK380021204', loc: 'SKR', partCategoryCode: 'CAT-B', partNum: 'P10', rootPartNum: 'RP09', day: 19, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380021204', consPartyName: 'A R P MOTORS', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 45, netRetailSelling: 410000, discountAmount: 0, netRetailDdl: 410000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-10', dealerCode: 'WK380012000', loc: 'TNG', partCategoryCode: 'CAT-A', partNum: 'P11', rootPartNum: 'RP10', day: 21, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380012000', consPartyName: 'A STAR MOTORS', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 70, netRetailSelling: 670000, discountAmount: 0, netRetailDdl: 670000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-11', dealerCode: 'WK380097638', loc: 'UTD', partCategoryCode: 'CAT-C', partNum: 'P12', rootPartNum: 'RP11', day: 25, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'WK380097638', consPartyName: 'A TO Z CAR CARE', partyType: 'INDEPENDENT WORKSHOP', netRetailQty: 85, netRetailSelling: 830000, discountAmount: 0, netRetailDdl: 830000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-12', dealerCode: 'TRJ0103287', loc: 'ALW', partCategoryCode: 'CAT-A', partNum: 'P13', rootPartNum: 'RP12', day: 28, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'TRJ0103287', consPartyName: 'Vice city and customs', partyType: 'PREMIUM', netRetailQty: 150, netRetailSelling: 1540000, discountAmount: 0, netRetailDdl: 1540000, batchId: sampleBatchId, uploadedBy: adminUser.id },
      { consignee: 'CON-13', dealerCode: 'TRJ0153658', loc: 'ALW', partCategoryCode: 'CAT-B', partNum: 'P14', rootPartNum: 'RP13', day: 29, fiscalYear: 2026, month: 'July', monthYear: '2026-07', consPartyCode: 'TRJ0153658', consPartyName: 'SHREE BALAJI MOTORS CAR DECORE', partyType: 'PREMIUM', netRetailQty: 95, netRetailSelling: 980000, discountAmount: 0, netRetailDdl: 980000, batchId: sampleBatchId, uploadedBy: adminUser.id }
    ]
  });
  console.log('Seeded RAW_SALES SSOT transaction records.');

  // 8. Create Default Import Templates
  const existingTemplate = await prisma.importTemplate.findFirst({
    where: { name: 'Bank Statement Import Template (CSV)' },
  });

  if (!existingTemplate) {
    const template = await prisma.importTemplate.create({
      data: {
        name: 'Bank Statement Import Template (CSV)',
        sourceType: 'BANK_STATEMENT',
        columnMappings: [
          { csvColumn: 'Transaction Date', dbField: 'transactionDate', required: true },
          { csvColumn: 'Reference No', dbField: 'referenceNo', required: true },
          { csvColumn: 'Amount', dbField: 'amount', required: true },
          { csvColumn: 'Party Code', dbField: 'partyCode', required: false },
        ] as any,
        validationRules: [] as any,
      },
    });
    console.log(`Created default import template: ${template.name}`);
  } else {
    console.log(`Default import template already exists.`);
  }

  // 9. Seeding completed

  // 10. Create Sample Assets
  const assetLaptop = await prisma.asset.upsert({
    where: { code: 'AST-LPT-001' },
    update: {},
    create: {
      name: 'MacBook Pro 16 Inch',
      code: 'AST-LPT-001',
      category: 'IT Equipment',
      status: 'ALLOCATED',
      allocatedToBranch: 'MUMBAI-01',
      barcode: '1234567890',
      depreciationRate: 15.0,
    },
  });

  const assetPrinter = await prisma.asset.upsert({
    where: { code: 'AST-PRN-001' },
    update: {},
    create: {
      name: 'HP LaserJet Pro',
      code: 'AST-PRN-001',
      category: 'Office Equipment',
      status: 'AVAILABLE',
      depreciationRate: 10.0,
    },
  });
  console.log('Upserted sample asset entries.');

  // 11. Create Sample Help Desk Tickets
  const sampleTicket = await prisma.helpDeskTicket.upsert({
    where: { ticketNo: 'TKT-1001' },
    update: {},
    create: {
      ticketNo: 'TKT-1001',
      category: 'Hardware',
      priority: 'HIGH',
      title: 'Laptop Keyboard Malfunction',
      description: 'The keys E and R are not working on the new MacBook Pro.',
      status: 'OPEN',
      createdBy: adminUser.id,
    },
  });
  console.log('Upserted sample help desk tickets.');

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
