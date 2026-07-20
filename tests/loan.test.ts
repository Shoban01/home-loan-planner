import { describe, expect, it } from 'vitest';
import { computeEmi, computeSchedule, principalForEmi, MAX_MONTHS } from '../src/engine/loan.ts';
import { lakh, rupees } from '../src/engine/money.ts';

const P = lakh(50);
const RATE = 8.5;
const MONTHS = 240;

const base = () =>
  computeSchedule({ principal: P, annualRatePct: RATE, tenureMonths: MONTHS });

describe('computeEmi — goldens (cross-checked against bank calculators)', () => {
  it('₹50L @ 8.5% / 240mo → ₹43,391', () => {
    expect(computeEmi(P, RATE, MONTHS)).toBe(rupees(43391));
  });
  it('₹30L @ 9% / 180mo → ₹30,428', () => {
    expect(computeEmi(lakh(30), 9, 180)).toBe(rupees(30428));
  });
  it('zero-rate loan divides principal evenly', () => {
    expect(computeEmi(rupees(120000), 0, 12)).toBe(rupees(10000));
  });
});

describe('computeSchedule — base loan goldens', () => {
  it('total interest ≈ ₹54.14L and total paid ≈ ₹1.041 Cr', () => {
    const s = base();
    expect(Math.round(s.totalInterest / 100)).toBe(5413942);
    expect(Math.round(s.totalPaid / 100)).toBe(10413942);
  });
  it('first EMI is 81.6% interest (₹35,416.67 of ₹43,391)', () => {
    const s = base();
    // Interest is computed to the paise (see loan.ts): 50,00,000 × 8.5%/12
    // = ₹35,416.666… → 3,541,667 paise. The UI displays it rounded (₹35,417).
    expect(s.rows[0].interest).toBe(3541667);
    expect(s.rows[0].principalComponent).toBe(rupees(43391) - 3541667); // ₹7,974.33
    expect(Math.round(s.rows[0].interest / 100)).toBe(35417); // display value
  });
  it('after 5 years only ₹5.9L of ₹26L paid has cleared principal', () => {
    const y5 = base().years[4];
    expect(Math.round(y5.cumulativePaid / 100)).toBeGreaterThan(2590000);
    expect(Math.round(y5.cumulativePrincipal / 100)).toBeLessThan(600000);
  });
  it('may run one extra month for the rounding residual', () => {
    // EMI is rounded to the rupee, so a tiny final payment can spill into
    // month n+1 — exactly what banks do.
    expect(base().months).toBeLessThanOrEqual(MONTHS + 1);
  });
});

describe('computeSchedule — invariants', () => {
  it('closing balance chain is consistent and ends at zero', () => {
    const s = base();
    expect(s.rows.at(-1)!.closingBalance).toBe(0);
    for (let i = 1; i < s.rows.length; i++) {
      expect(s.rows[i].openingBalance).toBe(s.rows[i - 1].closingBalance);
    }
  });
  it('principal components + prepayments sum exactly to the loan', () => {
    const s = base();
    const sum = s.rows.reduce((a, r) => a + r.principalComponent + r.prepayment, 0);
    expect(sum).toBe(P);
  });
  it('total paid = total interest + total principal', () => {
    const s = base();
    expect(s.totalPaid).toBe(s.totalInterest + s.totalPrincipal);
  });
  it('prepayment never increases total interest', () => {
    const s = computeSchedule(
      { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
      { prepayment: { extraMonthly: rupees(5000) } },
    );
    expect(s.totalInterest).toBeLessThan(base().totalInterest);
  });
});

describe('prepayments', () => {
  it('₹5k/month extra (reduce_tenure) saves ~₹13.9L and 4.5 years', () => {
    const s = computeSchedule(
      { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
      { prepayment: { extraMonthly: rupees(5000), mode: 'reduce_tenure' } },
    );
    expect(s.months).toBe(187);
    const saved = base().totalInterest - s.totalInterest;
    expect(Math.round(saved / lakh(1))).toBe(14); // ₹13.9L
  });
  it('reduce_tenure beats reduce_emi by ~₹7.8L for the same prepayments', () => {
    const opts = { extraMonthly: rupees(5000) };
    const tenure = computeSchedule(
      { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
      { prepayment: { ...opts, mode: 'reduce_tenure' } },
    );
    const emi = computeSchedule(
      { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
      { prepayment: { ...opts, mode: 'reduce_emi' } },
    );
    expect(emi.totalInterest - tenure.totalInterest).toBeGreaterThan(lakh(7));
  });
  it('prepayment is capped at the outstanding balance', () => {
    const s = computeSchedule(
      { principal: rupees(100000), annualRatePct: 10, tenureMonths: 120 },
      { prepayment: { extraMonthly: rupees(200000) } },
    );
    expect(s.months).toBe(1);
    expect(s.rows[0].closingBalance).toBe(0);
  });
});

describe('rate changes', () => {
  it('+2% at month 25 with constant EMI stretches 240 → 414 months', () => {
    const s = computeSchedule(
      { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
      { rateChanges: [{ fromMonth: 25, annualRatePct: 10.5 }], rateChangeMode: 'reduce_tenure' },
    );
    expect(s.months).toBe(414);
    expect(s.negativeAmortization).toBe(false);
  });
  it('extreme shock flags negative amortization instead of looping', () => {
    const s = computeSchedule(
      { principal: P, annualRatePct: 8.5, tenureMonths: 360 },
      { rateChanges: [{ fromMonth: 2, annualRatePct: 15 }], rateChangeMode: 'reduce_tenure' },
    );
    expect(s.negativeAmortization).toBe(true);
    expect(s.months).toBeLessThanOrEqual(MAX_MONTHS);
  });
});

describe('principalForEmi', () => {
  it('round-trips with computeEmi within ₹100', () => {
    const emi = computeEmi(P, RATE, MONTHS);
    expect(Math.abs(principalForEmi(emi, RATE, MONTHS) - P)).toBeLessThan(rupees(100));
  });
});
