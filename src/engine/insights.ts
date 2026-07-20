import type { Insight, Schedule } from './types.ts';
import { formatCompactINR, formatINR } from './money.ts';

/**
 * Each function inspects engine output and returns zero or more insights in
 * plain English, always using the user's own numbers. Adding an insight never
 * requires touching UI code — the UI renders Insight[] generically.
 */

export function baseInsights(s: Schedule): Insight[] {
  const out: Insight[] = [];
  const first = s.rows[0];

  const sharePct = Math.round((first.interest / first.emi) * 100);
  out.push({
    id: 'first-emi-split',
    severity: 'info',
    title: `Your first EMI is ${sharePct}% interest`,
    body:
      `Of your first ${formatINR(first.emi)} payment, ${formatINR(first.interest)} ` +
      `is interest and only ${formatINR(first.principalComponent)} reduces the loan. ` +
      `Interest is charged on the outstanding balance — and the balance is at its ` +
      `peak on day one. This flips slowly over the tenure.`,
  });

  if (s.totalInterest > s.totalPrincipal) {
    out.push({
      id: 'interest-exceeds-principal',
      severity: 'warning',
      title: `Interest alone costs more than the loan itself`,
      body:
        `You borrow ${formatCompactINR(s.totalPrincipal)} but repay ` +
        `${formatCompactINR(s.totalPaid)} — the extra ` +
        `${formatCompactINR(s.totalInterest)} is interest. This is normal for ` +
        `long tenures; it's also why every early prepayment punches above its weight.`,
    });
  }

  const y5 = s.years[Math.min(4, s.years.length - 1)];
  if (s.years.length > 5) {
    out.push({
      id: 'five-year-checkpoint',
      severity: 'info',
      title: `The bank owns your first five years`,
      body:
        `After 5 years you'll have paid ${formatCompactINR(y5.cumulativePaid)}, ` +
        `but only ${formatCompactINR(y5.cumulativePrincipal)} of it reduced your ` +
        `loan. The other ${formatCompactINR(y5.cumulativeInterest)} was interest.`,
    });
  }

  if (s.negativeAmortization) {
    out.push({
      id: 'negative-amortization',
      severity: 'danger',
      title: `Your EMI no longer covers the interest`,
      body:
        `At this rate, the EMI is smaller than the monthly interest, so the ` +
        `balance grows instead of shrinking. Banks handle rate rises by silently ` +
        `stretching your tenure — ask yours to increase the EMI instead.`,
    });
  }

  return out;
}

/** Compare a prepayment scenario against the base loan. */
export function prepaymentInsight(base: Schedule, variant: Schedule): Insight {
  const interestSaved = base.totalInterest - variant.totalInterest;
  const monthsSaved = base.months - variant.months;
  const yearsSaved = (monthsSaved / 12).toFixed(1);
  return {
    id: 'prepayment-savings',
    severity: interestSaved > 0 ? 'positive' : 'info',
    title:
      interestSaved > 0
        ? `This plan saves ${formatCompactINR(interestSaved)}`
        : `This plan doesn't change much`,
    body:
      interestSaved > 0
        ? `You'd finish ${yearsSaved} years early and pay ` +
          `${formatCompactINR(interestSaved)} less interest. Prepayments work ` +
          `best early, when the balance — and therefore the interest — is largest. ` +
          `RBI rules: floating-rate home loans to individuals have zero prepayment penalty.`
        : `Late or small prepayments save little because most interest was ` +
          `already paid in the early years.`,
  };
}

/** The "reduce tenure vs reduce EMI" myth-buster. */
export function tenureVsEmiInsight(
  reduceTenure: Schedule,
  reduceEmi: Schedule,
): Insight {
  const diff = reduceEmi.totalInterest - reduceTenure.totalInterest;
  return {
    id: 'tenure-vs-emi',
    severity: 'warning',
    title: `Reduce tenure, not EMI`,
    body:
      `The same prepayments save ${formatCompactINR(diff)} more if the bank ` +
      `shortens your tenure instead of lowering your EMI. Banks default to ` +
      `lowering the EMI — you must explicitly ask for tenure reduction.`,
  };
}

/** Floating-rate stress test. */
export function rateShockInsight(base: Schedule, shocked: Schedule): Insight {
  const extraMonths = shocked.months - base.months;
  const extraInterest = shocked.totalInterest - base.totalInterest;
  return {
    id: 'rate-shock',
    severity: shocked.negativeAmortization ? 'danger' : 'warning',
    title: `If rates rise ${(
      shocked.rows[shocked.rows.length - 1].annualRatePct -
      base.params.annualRatePct
    ).toFixed(1)}%…`,
    body: shocked.negativeAmortization
      ? `…your current EMI wouldn't even cover the interest. The bank would ` +
        `stretch your tenure indefinitely unless you raise the EMI.`
      : `…and your EMI stays the same, your loan stretches by ` +
        `${extraMonths} months and costs ${formatCompactINR(extraInterest)} more. ` +
        `Nearly all Indian home loans float with the repo rate — budget for this.`,
  };
}
