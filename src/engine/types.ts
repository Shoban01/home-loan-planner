/**
 * All money values are integer paise (1 rupee = 100 paise) to avoid float drift.
 * All rates are annual percentages (8.5 means 8.5% p.a.).
 * Months are 1-indexed (month 1 = first EMI).
 */

export interface LoanParams {
  /** Amount borrowed, in paise. */
  principal: number;
  /** Annual interest rate, e.g. 8.5 */
  annualRatePct: number;
  /** Total tenure in months. */
  tenureMonths: number;
}

/** How a prepayment or rate change is absorbed by the loan. */
export type AdjustmentMode = 'reduce_tenure' | 'reduce_emi';

export interface RateChange {
  /** Month (1-indexed) from which the new rate applies. */
  fromMonth: number;
  annualRatePct: number;
}

export interface PrepaymentPlan {
  /** Fixed extra amount paid with every EMI, in paise. */
  extraMonthly?: number;
  /** Lump sum paid once every 12 months, in paise. */
  annualLumpsum?: number;
  /** Month of the year the lumpsum lands (1-12). Default 12. */
  lumpsumMonthOfYear?: number;
  /**
   * reduce_tenure: EMI stays constant, loan ends earlier (recommended, default).
   * reduce_emi: EMI is recomputed over the remaining original tenure after
   * every prepayment (what banks silently default to).
   */
  mode?: AdjustmentMode;
}

export interface ScheduleOptions {
  prepayment?: PrepaymentPlan;
  rateChanges?: RateChange[];
  /**
   * When a rate rises: keep EMI and stretch tenure (bank default) or
   * recompute EMI over the remaining tenure.
   */
  rateChangeMode?: AdjustmentMode;
}

export interface ScheduleRow {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principalComponent: number;
  prepayment: number;
  closingBalance: number;
  annualRatePct: number;
}

export interface YearSummary {
  year: number;
  interestPaid: number;
  principalPaid: number;
  totalPaid: number;
  closingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  cumulativePaid: number;
}

export interface Schedule {
  params: LoanParams;
  options: ScheduleOptions;
  rows: ScheduleRow[];
  years: YearSummary[];
  months: number;
  emiAtStart: number;
  totalInterest: number;
  totalPrincipal: number;
  totalPaid: number;
  /**
   * True if at any point the EMI could not cover interest (rate shock with
   * keep-EMI). The schedule is capped at MAX_MONTHS and must be shown with
   * a warning, never as a normal result.
   */
  negativeAmortization: boolean;
}

export interface AffordabilityInput {
  /** Monthly take-home income, paise. */
  netMonthlyIncome: number;
  /** Sum of existing EMIs, paise. */
  existingEmis: number;
  /** Regular monthly expenses excluding EMIs, paise. */
  monthlyExpenses: number;
  /** Liquid savings left AFTER paying the down payment, paise. */
  emergencySavings: number;
  /** EMI of the loan being considered, paise. */
  proposedEmi: number;
}

export type AffordabilityBand = 'comfortable' | 'stretch' | 'danger';

export interface AffordabilityResult {
  /** Fixed obligations to income ratio including the proposed EMI, percent. */
  foirPct: number;
  band: AffordabilityBand;
  /** Largest EMI that keeps FOIR at the comfortable ceiling, paise. */
  maxComfortableEmi: number;
  /** Months of (expenses + all EMIs) covered by emergency savings. */
  bufferMonths: number;
  /** Monthly surplus after expenses and all EMIs, paise. */
  monthlySurplus: number;
  /** Plain-English, rule-transparent notes. Never "Eligible/Not eligible". */
  notes: string[];
}

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'danger';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  body: string;
}
