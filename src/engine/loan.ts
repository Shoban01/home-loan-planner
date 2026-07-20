import type {
  LoanParams,
  Schedule,
  ScheduleOptions,
  ScheduleRow,
  YearSummary,
} from './types.ts';

/** Hard cap so a rate shock that outruns the EMI can't loop forever. */
export const MAX_MONTHS = 600;

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 12 / 100;
}

/**
 * Standard reducing-balance EMI, rounded to the nearest rupee (in paise),
 * matching how Indian banks quote it.
 *
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function computeEmi(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  if (principal <= 0) return 0;
  if (tenureMonths <= 0) throw new Error('tenureMonths must be positive');
  const r = monthlyRate(annualRatePct);
  if (r === 0) return roundToRupee(principal / tenureMonths);
  const f = Math.pow(1 + r, tenureMonths);
  return roundToRupee((principal * r * f) / (f - 1));
}

/**
 * Inverse of computeEmi: the principal a given EMI can service.
 * Used by the affordability calculator ("safe loan amount").
 */
export function principalForEmi(
  emi: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  const r = monthlyRate(annualRatePct);
  if (r === 0) return emi * tenureMonths;
  const f = Math.pow(1 + r, tenureMonths);
  return Math.round((emi * (f - 1)) / (r * f));
}

function roundToRupee(paise: number): number {
  return Math.round(paise / 100) * 100;
}

function roundPaise(x: number): number {
  return Math.round(x);
}

/**
 * Generates the full month-by-month schedule.
 *
 * Design notes:
 * - Pure function: same inputs, same output. No clocks, no locale, no I/O.
 * - Interest each month = opening balance * monthly rate, rounded to paise.
 * - Prepayments apply after the regular EMI in the same month.
 * - 'reduce_emi' mode recomputes the EMI over the *remaining original tenure*
 *   after any prepayment — mirroring bank behaviour.
 * - A rate change with rateChangeMode 'reduce_tenure' keeps the EMI constant
 *   (the bank default that silently stretches your tenure when rates rise);
 *   'reduce_emi' re-derives the EMI over the remaining tenure.
 */
export function computeSchedule(
  params: LoanParams,
  options: ScheduleOptions = {},
): Schedule {
  const { principal, tenureMonths } = params;
  if (principal <= 0) throw new Error('principal must be positive');
  if (tenureMonths <= 0 || tenureMonths > MAX_MONTHS) {
    throw new Error(`tenureMonths must be in 1..${MAX_MONTHS}`);
  }

  const prep = options.prepayment ?? {};
  const prepMode = prep.mode ?? 'reduce_tenure';
  const rateMode = options.rateChangeMode ?? 'reduce_tenure';
  const lumpsumMonth = prep.lumpsumMonthOfYear ?? 12;
  const rateChanges = [...(options.rateChanges ?? [])].sort(
    (a, b) => a.fromMonth - b.fromMonth,
  );

  let rate = params.annualRatePct;
  let emi = computeEmi(principal, rate, tenureMonths);
  const emiAtStart = emi;

  const rows: ScheduleRow[] = [];
  let balance = principal;
  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  let negativeAmortization = false;

  while (balance > 0 && month < MAX_MONTHS) {
    month += 1;

    const change = rateChanges.find((c) => c.fromMonth === month);
    if (change) {
      rate = change.annualRatePct;
      if (rateMode === 'reduce_emi') {
        emi = computeEmi(balance, rate, Math.max(1, tenureMonths - month + 1));
      }
    }

    const openingBalance = balance;
    const interest = roundPaise(openingBalance * monthlyRate(rate));

    let payment = emi;
    let principalComponent = payment - interest;

    if (principalComponent <= 0) {
      // EMI no longer covers interest: negative amortization. We keep the
      // payment, let the balance grow, and flag the schedule.
      negativeAmortization = true;
    }

    // Final-payment correction: never overpay past zero.
    if (principalComponent >= openingBalance) {
      principalComponent = openingBalance;
      payment = principalComponent + interest;
    }

    balance = openingBalance - principalComponent;

    // Prepayments (only while a balance remains).
    let prepayment = 0;
    if (balance > 0) {
      if (prep.extraMonthly && prep.extraMonthly > 0) {
        prepayment += Math.min(prep.extraMonthly, balance);
      }
      if (
        prep.annualLumpsum &&
        prep.annualLumpsum > 0 &&
        month % 12 === lumpsumMonth % 12
      ) {
        prepayment += Math.min(prep.annualLumpsum, balance - prepayment);
      }
      balance -= prepayment;

      if (prepayment > 0 && prepMode === 'reduce_emi' && balance > 0) {
        emi = computeEmi(balance, rate, Math.max(1, tenureMonths - month));
      }
    }

    totalInterest += interest;
    totalPaid += payment + prepayment;

    rows.push({
      month,
      openingBalance,
      emi: payment,
      interest,
      principalComponent,
      prepayment,
      closingBalance: balance,
      annualRatePct: rate,
    });
  }

  if (balance > 0) negativeAmortization = true;

  return {
    params,
    options,
    rows,
    years: summarizeByYear(rows),
    months: rows.length,
    emiAtStart,
    totalInterest,
    totalPrincipal: principal - balance,
    totalPaid,
    negativeAmortization,
  };
}

function summarizeByYear(rows: ScheduleRow[]): YearSummary[] {
  const years: YearSummary[] = [];
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  let cumulativePaid = 0;

  for (let i = 0; i < rows.length; i += 12) {
    const slice = rows.slice(i, i + 12);
    const interestPaid = slice.reduce((s, r) => s + r.interest, 0);
    const principalPaid = slice.reduce(
      (s, r) => s + r.principalComponent + r.prepayment,
      0,
    );
    const totalPaid = slice.reduce((s, r) => s + r.emi + r.prepayment, 0);
    cumulativeInterest += interestPaid;
    cumulativePrincipal += principalPaid;
    cumulativePaid += totalPaid;
    years.push({
      year: i / 12 + 1,
      interestPaid,
      principalPaid,
      totalPaid,
      closingBalance: slice[slice.length - 1].closingBalance,
      cumulativeInterest,
      cumulativePrincipal,
      cumulativePaid,
    });
  }
  return years;
}
