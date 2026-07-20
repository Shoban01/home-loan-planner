/**
 * Everything India-specific lives here. The engine never imports from config;
 * the UI composes engine + config. Adding a country = adding a sibling file,
 * not touching the engine.
 */

export const IN = {
  countryCode: 'IN',
  currency: 'INR',
  locale: 'en-IN',

  defaults: {
    propertyPricePaise: 62_50_000_00, // ₹62.5L
    downPaymentPct: 20,
    annualRatePct: 8.5,
    tenureYears: 20,
  },

  sliderRanges: {
    propertyPriceLakh: { min: 10, max: 300, step: 0.5 },
    downPaymentPct: { min: 10, max: 60, step: 1 },
    annualRatePct: { min: 7, max: 12, step: 0.05 },
    tenureYears: { min: 5, max: 30, step: 1 },
  },

  /**
   * One-time costs typically NOT covered by the loan. Percentages are of
   * property value; indicative, state-dependent — always shown as estimates.
   */
  upfrontCosts: {
    stampDutyPctRange: [5, 8] as const,
    registrationPct: 1,
    gstUnderConstructionPct: 5,
    processingFeePctRange: [0.25, 1] as const,
  },

  facts: {
    prepaymentPenalty:
      'RBI mandates zero prepayment/foreclosure charges on floating-rate ' +
      'home loans to individuals.',
    loanInsurance:
      'Single-premium home loan protection plans are often added to the loan ' +
      'and financed at your loan rate for the full tenure. A plain term life ' +
      'policy is usually far cheaper for the same cover.',
    rateResets:
      'Most home loans are repo-linked (EBLR). When rates rise, banks keep ' +
      'your EMI constant and stretch the tenure unless you ask otherwise.',
  },
} as const;

export type CountryConfig = typeof IN;
