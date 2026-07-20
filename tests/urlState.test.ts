import { describe, expect, it } from 'vitest';
import { clampScenario, decodeScenario, encodeScenario, type ScenarioV1 } from '../src/ui/urlState.ts';

const sample: ScenarioV1 = {
  v: 1,
  loan: { priceL: 60, dpPct: 25, rate: 8.35, tenureYr: 18 },
  prepay: { extra: 7500, mode: 'reduce_tenure' },
  shock: { add: 2, startYr: 3, rampYrs: 8, mode: 'keep_emi' },
  afford: { income: 150000, emis: 8000, expenses: 50000, savings: 700000 },
};

describe('urlState', () => {
  it('round-trips a scenario exactly', () => {
    expect(decodeScenario(encodeScenario(sample))).toEqual(sample);
  });
  it('is URL-safe (no +, /, =)', () => {
    expect(encodeScenario(sample)).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
  it('returns null for garbage', () => {
    expect(decodeScenario('not-base64!!!')).toBeNull();
    expect(decodeScenario(encodeScenario(sample).slice(0, 10))).toBeNull();
  });
  it('returns null for unknown versions (forces explicit migration)', () => {
    const v2 = btoa(JSON.stringify({ ...sample, v: 2 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    expect(decodeScenario(v2)).toBeNull();
  });
  it('clamps hostile values into sane bounds', () => {
    const evil = btoa(JSON.stringify({
      v: 1,
      loan: { priceL: 9e9, dpPct: -50, rate: 'DROP TABLE', tenureYr: 999 },
      prepay: { extra: -1, mode: 'steal_money' },
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const s = decodeScenario(evil)!;
    expect(s.loan.priceL).toBe(2000);
    expect(s.loan.dpPct).toBe(0);
    expect(s.loan.rate).toBe(8.5);       // non-number → default
    expect(s.loan.tenureYr).toBe(40);
    expect(s.prepay.extra).toBe(0);
    expect(s.prepay.mode).toBe('reduce_tenure');
    expect(s.afford.income).toBe(120000); // missing section → defaults
  });
  it('clampScenario fills a fully empty object with defaults', () => {
    const s = clampScenario({});
    expect(s.loan).toEqual({ priceL: 62.5, dpPct: 20, rate: 8.5, tenureYr: 20 });
    expect(s.shock.mode).toBe('keep_emi');
  });
});
