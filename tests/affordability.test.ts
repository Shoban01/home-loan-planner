import { describe, expect, it } from 'vitest';
import {
  computeAffordability,
  safeLoanAmount,
  FOIR_COMFORTABLE_MAX,
} from '../src/engine/affordability.ts';
import { computeSchedule } from '../src/engine/loan.ts';
import {
  baseInsights,
  prepaymentInsight,
  tenureVsEmiInsight,
} from '../src/engine/insights.ts';
import { lakh, rupees } from '../src/engine/money.ts';

const profile = {
  netMonthlyIncome: rupees(120000),
  existingEmis: rupees(8000),
  monthlyExpenses: rupees(45000),
  emergencySavings: rupees(400000),
};

describe('computeAffordability', () => {
  it('₹43,391 EMI on ₹1.2L income → stretch (FOIR 42.8%)', () => {
    const r = computeAffordability({ ...profile, proposedEmi: rupees(43391) });
    expect(r.band).toBe('stretch');
    expect(r.foirPct).toBeCloseTo(42.8, 0);
    expect(r.maxComfortableEmi).toBe(rupees(34000));
  });
  it('small EMI with thin savings buffer is downgraded to stretch', () => {
    const r = computeAffordability({
      ...profile,
      emergencySavings: rupees(100000),
      proposedEmi: rupees(20000),
    });
    expect(r.band).toBe('stretch');
    expect(r.bufferMonths).toBeLessThan(6);
  });
  it('never returns a binary verdict — always explains the rule', () => {
    const r = computeAffordability({ ...profile, proposedEmi: rupees(70000) });
    expect(r.band).toBe('danger');
    expect(r.notes.join(' ')).toContain(`${FOIR_COMFORTABLE_MAX}%`);
  });
  it('safe loan amount scales with income', () => {
    const small = safeLoanAmount(rupees(80000), 0, 8.5, 240);
    const large = safeLoanAmount(rupees(160000), 0, 8.5, 240);
    expect(large).toBeGreaterThan(small * 1.9);
    expect(small).toBeGreaterThan(lakh(25));
  });
});

describe('insights', () => {
  const base = computeSchedule({
    principal: lakh(50),
    annualRatePct: 8.5,
    tenureMonths: 240,
  });

  it('base loan surfaces the first-EMI split and 5-year checkpoint', () => {
    const ids = baseInsights(base).map((i) => i.id);
    expect(ids).toContain('first-emi-split');
    expect(ids).toContain('interest-exceeds-principal');
    expect(ids).toContain('five-year-checkpoint');
  });
  it('insight bodies use the user’s own numbers', () => {
    const first = baseInsights(base).find((i) => i.id === 'first-emi-split')!;
    expect(first.body).toContain('₹35,417');
    expect(first.title).toContain('82%');
  });
  it('prepayment insight reports savings and early finish', () => {
    const variant = computeSchedule(base.params, {
      prepayment: { extraMonthly: rupees(5000) },
    });
    const ins = prepaymentInsight(base, variant);
    expect(ins.severity).toBe('positive');
    expect(ins.body).toContain('4.5 years early');
  });
  it('tenure-vs-EMI insight quantifies the gap', () => {
    const t = computeSchedule(base.params, {
      prepayment: { extraMonthly: rupees(5000), mode: 'reduce_tenure' },
    });
    const e = computeSchedule(base.params, {
      prepayment: { extraMonthly: rupees(5000), mode: 'reduce_emi' },
    });
    const ins = tenureVsEmiInsight(t, e);
    expect(ins.title).toBe('Reduce tenure, not EMI');
    expect(ins.body).toMatch(/₹7\.[0-9]L/);
  });
});
