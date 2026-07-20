import type { AffordabilityInput, AffordabilityResult } from './types.ts';
import { formatINR } from './money.ts';
import { principalForEmi } from './loan.ts';

/**
 * Rule thresholds are exported so the UI can *show* the rule, not just the
 * verdict. Transparency is the pedagogy: "we flag risk when EMI + existing
 * obligations exceed 45% of take-home income".
 */
export const FOIR_COMFORTABLE_MAX = 35;
export const FOIR_STRETCH_MAX = 45;
export const MIN_BUFFER_MONTHS = 6;

export function computeAffordability(
  input: AffordabilityInput,
): AffordabilityResult {
  const {
    netMonthlyIncome,
    existingEmis,
    monthlyExpenses,
    emergencySavings,
    proposedEmi,
  } = input;
  if (netMonthlyIncome <= 0) throw new Error('income must be positive');

  const obligations = existingEmis + proposedEmi;
  const foirPct = (obligations / netMonthlyIncome) * 100;
  const monthlySurplus = netMonthlyIncome - monthlyExpenses - obligations;
  const monthlyOutgo = monthlyExpenses + obligations;
  const bufferMonths =
    monthlyOutgo > 0 ? emergencySavings / monthlyOutgo : Infinity;

  const maxComfortableEmi = Math.max(
    0,
    Math.round((netMonthlyIncome * FOIR_COMFORTABLE_MAX) / 100 - existingEmis),
  );

  let band: AffordabilityResult['band'];
  if (foirPct <= FOIR_COMFORTABLE_MAX && monthlySurplus > 0) {
    band = 'comfortable';
  } else if (foirPct <= FOIR_STRETCH_MAX && monthlySurplus >= 0) {
    band = 'stretch';
  } else {
    band = 'danger';
  }
  if (band === 'comfortable' && bufferMonths < MIN_BUFFER_MONTHS) {
    band = 'stretch';
  }

  const notes: string[] = [];
  notes.push(
    `${foirPct.toFixed(0)}% of your take-home income would go to EMIs. ` +
      `We call up to ${FOIR_COMFORTABLE_MAX}% comfortable and above ` +
      `${FOIR_STRETCH_MAX}% risky — banks may approve up to ~55%, because ` +
      `their risk is covered by your house. Yours isn't.`,
  );
  if (monthlySurplus < 0) {
    notes.push(
      `Your expenses plus EMIs exceed income by ${formatINR(-monthlySurplus)} ` +
        `a month. This loan doesn't fit your current budget.`,
    );
  } else {
    notes.push(
      `After expenses and EMIs you'd have ${formatINR(monthlySurplus)} left ` +
        `each month for savings, investments, and surprises.`,
    );
  }
  if (bufferMonths < MIN_BUFFER_MONTHS) {
    notes.push(
      `Your emergency savings cover ${bufferMonths.toFixed(1)} months of ` +
        `outgo after the down payment. Aim for ${MIN_BUFFER_MONTHS}+ months ` +
        `before signing — a job gap shouldn't cost you the house.`,
    );
  }
  if (proposedEmi > maxComfortableEmi) {
    notes.push(
      `A comfortable EMI for you is about ${formatINR(maxComfortableEmi)}. ` +
        `Consider a bigger down payment, a longer search, or a smaller home.`,
    );
  }

  return {
    foirPct,
    band,
    maxComfortableEmi,
    bufferMonths,
    monthlySurplus,
    notes,
  };
}

/** "Safe loan amount": principal serviceable by the comfortable EMI. */
export function safeLoanAmount(
  netMonthlyIncome: number,
  existingEmis: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  const emi = Math.max(
    0,
    (netMonthlyIncome * FOIR_COMFORTABLE_MAX) / 100 - existingEmis,
  );
  return principalForEmi(emi, annualRatePct, tenureMonths);
}
