// src/ai-query/ai-query.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsService } from '../reports/reports.service';
import { ControlTowerService } from '../control-tower/control-tower.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiQueryService {
  private readonly logger = new Logger(AiQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    private readonly reportsService: ReportsService,
    private readonly controlTowerService: ControlTowerService,
  ) {}

  async processNaturalLanguageQuery(queryText: string, userId: string) {
    const text = queryText.toLowerCase();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Detect branch code matching
    const branches = await this.prisma.branch.findMany({ select: { code: true } });
    const matchedBranch = branches.find((b) => text.includes(b.code.toLowerCase()))?.code;

    // Detect query intent
    let intent = 'SUMMARY';
    if (text.includes('incentive') || text.includes('scheme') || text.includes('slab')) {
      intent = 'INCENTIVE_REGISTER';
    } else if (text.includes('outstanding') || text.includes('due') || text.includes('aging')) {
      intent = 'OUTSTANDING';
    } else if (text.includes('sales') || text.includes('performance') || text.includes('top')) {
      intent = 'PERFORMANCE';
    } else if (text.includes('control tower') || text.includes('operational')) {
      intent = 'CONTROL_TOWER';
    }

    let resultData: any = null;

    switch (intent) {
      case 'INCENTIVE_REGISTER':
        resultData = await this.reportsService.getIncentiveRegister({
          year: currentYear,
          month: currentMonth,
          branchCode: matchedBranch,
          pageSize: 20,
        });
        break;
      case 'OUTSTANDING':
        resultData = await this.reportsService.getOutstandingMaster({
          year: currentYear,
          month: currentMonth,
          branchCode: matchedBranch,
          pageSize: 20,
        });
        break;
      case 'PERFORMANCE':
        resultData = await this.reportsService.getPerformanceReport({
          year: currentYear,
          month: currentMonth,
          branchCode: matchedBranch,
          pageSize: 20,
        });
        break;
      case 'CONTROL_TOWER':
        resultData = await this.controlTowerService.getOperationalControlTower(currentYear, currentMonth);
        break;
      default:
        resultData = await this.dashboardService.getSummaryKPIs(currentYear, currentMonth, matchedBranch);
    }

    return {
      queryText,
      queryInterpretation: {
        intent,
        detectedBranchCode: matchedBranch || 'ALL',
        year: currentYear,
        month: currentMonth,
      },
      data: resultData,
    };
  }
}
