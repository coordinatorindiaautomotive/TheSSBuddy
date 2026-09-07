export interface GovernorRule {
  branch: string;
  categories: string[];
  partyTypes: string[];
}

export interface IncentiveRecord {
  id?: string;
  year?: number;
  month?: number;
  originalPartyCode: string;
  partyName: string;
  baseBranch: string;
  partyType: string;
  nrs: number;
  totalDiscount: number;
  incentiveType: string;
  applicableRate: number;
  applicableSlab: string;
  grossIncentive: number;
  finalIncentive: number;
  processingMethod: string;
  validationStatus: string;
  validationErrors?: string[];
  payoutStatus?: string;
  transferredAmount?: number;
  transferDate?: string;
  accountHolder?: string;
  accountNo?: string;
  ifscCode?: string;
  utrNo?: string;
  payoutBatchId?: string;
  status: string;
}

export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
