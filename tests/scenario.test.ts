import { describe, expect, it } from 'vitest';
import { computeSchedule } from '../src/engine/loan.ts';
import { rampToRateChanges, lastFullEmi } from '../src/ui/scenario.ts';
import { lakh, rupees } from '../src/engine/money.ts';

/**
 * These goldens were produced by the Phase-1 demo's inline engine and
 * cross-verified during the M4 session. The TS engine + rampToRateChanges
 * must reproduce them exactly — this is the proof that the M2 port didn't
 * change behaviour.
 */
const P = lakh(50);
const RATE = 8.5;
const M = 240;
const params = { principal: P, annualRatePct: RATE, tenureMonths: M };
const base = computeSchedule(params);

describe('rampToRateChanges', () => {
  it('instant change is a single entry', () => {
    expect(rampToRateChanges(8.5, 2, 25, 0)).toEqual([
      { fromMonth: 25, annualRatePct: 10.5 },
    ]);
  });
  it('+2% over 8 years = 8 steps of 0.25%, 12 months apart', () => {
    const c = rampToRateChanges(8.5, 2, 37, 8);
    expect(c).toHaveLength(8);
    expect(c[0]).toEqual({ fromMonth: 37, annualRatePct: 8.75 });
    expect(c[7]).toEqual({ fromMonth: 37 + 7 * 12, annualRatePct: 10.5 });
  });
  it('non-multiple target lands exactly on the final step', () => {
    const c = rampToRateChanges(8.5, 1.1, 37, 2);
    expect(c[c.length - 1].annualRatePct).toBeCloseTo(9.6, 10);
  });
  it('falls produce descending rates', () => {
    const c = rampToRateChanges(8.5, -1, 37, 0);
    expect(c).toEqual([{ fromMonth: 37, annualRatePct: 7.5 }]);
  });
});

describe('M2 port equivalence — demo goldens', () => {
  it('fast cycle: +2.5% over 1yr from yr 3, keep EMI → 458 months, +₹94.2L interest', () => {
    const s = computeSchedule(params, {
      rateChanges: rampToRateChanges(RATE, 2.5, 37, 1),
      rateChangeMode: 'reduce_tenure',
    });
    expect(s.months).toBe(458);
    expect(s.negativeAmortization).toBe(false);
    expect(Math.round((s.totalInterest - base.totalInterest) / lakh(0.1))).toBe(942);
  });
  it('slow drift: +2% over 8yr from yr 3, keep EMI → 294 months, +₹23.2L interest', () => {
    const s = computeSchedule(params, {
      rateChanges: rampToRateChanges(RATE, 2, 37, 8),
      rateChangeMode: 'reduce_tenure',
    });
    expect(s.months).toBe(294);
    expect(Math.round((s.totalInterest - base.totalInterest) / lakh(0.1))).toBe(232);
  });
  it('slow drift, raise EMI → 241 months, final EMI ₹48,282', () => {
    const s = computeSchedule(params, {
      rateChanges: rampToRateChanges(RATE, 2, 37, 8),
      rateChangeMode: 'reduce_emi',
    });
    expect(s.months).toBe(241);
    expect(lastFullEmi(s)).toBe(rupees(48282));
  });
  it('fall: -1% instant at yr 3, keep EMI → 216 months, saves ₹10.6L', () => {
    const s = computeSchedule(params, {
      rateChanges: rampToRateChanges(RATE, -1, 37, 0),
      rateChangeMode: 'reduce_tenure',
    });
    expect(s.months).toBe(216);
    expect(Math.round((base.totalInterest - s.totalInterest) / lakh(0.1))).toBe(106);
  });
});
