import { useEffect, useMemo, useState } from 'react';
import { computeEmi, computeSchedule, principalForEmi } from '../engine/loan.ts';
import { computeAffordability, safeLoanAmount } from '../engine/affordability.ts';
import { rupees } from '../engine/money.ts';
import { rampToRateChanges, lastFullEmi } from './scenario.ts';
import { IN } from '../config/in.ts';
import { decodeScenario, encodeScenario, type ScenarioV1 } from './urlState.ts';

function fromUrl(): ScenarioV1 | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search).get('s');
  return p ? decodeScenario(p) : null;
}
const initial = fromUrl();

export type ShockMode = 'keep_emi' | 'raise_emi';

/**
 * Owns every piece of scenario state and all derived engine output.
 * Components below this hook are presentation-only.
 */
export function useLoanScenario() {
  const d = IN.defaults;
  const u = initial;
  const [priceL, setPriceL] = useState(u?.loan.priceL ?? d.propertyPricePaise / 1e7); // lakh
  const [dpPct, setDpPct] = useState(u?.loan.dpPct ?? d.downPaymentPct);
  const [rate, setRate] = useState(u?.loan.rate ?? d.annualRatePct);
  const [tenureYr, setTenureYr] = useState(u?.loan.tenureYr ?? d.tenureYears);
  const [scrubYear, setScrubYear] = useState(5);

  const [extra, setExtra] = useState(u?.prepay.extra ?? 0); // rupees / month
  const [mode, setMode] = useState<'reduce_tenure' | 'reduce_emi'>(u?.prepay.mode ?? 'reduce_tenure');

  const [shockOpen, setShockOpen] = useState((u?.shock.add ?? 0) !== 0);
  const [shockAdd, setShockAdd] = useState(u?.shock.add ?? 0);
  const [shockStartYr, setShockStartYr] = useState(u?.shock.startYr ?? 3);
  const [shockRampYrs, setShockRampYrs] = useState(u?.shock.rampYrs ?? 0);
  const [shockMode, setShockMode] = useState<ShockMode>(u?.shock.mode ?? 'keep_emi');

  const [affOpen, setAffOpen] = useState(false);
  const [income, setIncome] = useState(u?.afford.income ?? 120000); // rupees / month
  const [otherEmis, setOtherEmis] = useState(u?.afford.emis ?? 0);
  const [expenses, setExpenses] = useState(u?.afford.expenses ?? 45000);
  const [savings, setSavings] = useState(u?.afford.savings ?? 500000);

  const principal = rupees(priceL * 1e5 * (1 - dpPct / 100));
  const months = tenureYr * 12;
  const params = { principal, annualRatePct: rate, tenureMonths: months };

  const base = useMemo(() => computeSchedule(params), [principal, rate, months]);

  const plan = useMemo(
    () =>
      extra > 0
        ? computeSchedule(params, { prepayment: { extraMonthly: rupees(extra), mode } })
        : null,
    [principal, rate, months, extra, mode],
  );

  const shockFromMonth = shockStartYr * 12 + 1;
  const effectiveShockMode: ShockMode = shockAdd < 0 ? 'keep_emi' : shockMode;
  const shocked = useMemo(
    () =>
      shockAdd !== 0 && months > shockFromMonth + 11
        ? computeSchedule(params, {
            rateChanges: rampToRateChanges(rate, shockAdd, shockFromMonth, shockRampYrs),
            rateChangeMode: effectiveShockMode === 'raise_emi' ? 'reduce_emi' : 'reduce_tenure',
          })
        : null,
    [principal, rate, months, shockAdd, shockFromMonth, shockRampYrs, effectiveShockMode],
  );
  const adviceEmi = shocked
    ? computeEmi(
        base.rows[Math.min(shockFromMonth - 2, base.rows.length - 1)].closingBalance,
        rate + shockAdd,
        Math.max(1, months - (shockFromMonth - 1)),
      )
    : 0;

  const aff = useMemo(() => {
    const r = computeAffordability({
      netMonthlyIncome: rupees(Math.max(1, income)),
      existingEmis: rupees(otherEmis),
      monthlyExpenses: rupees(expenses),
      emergencySavings: rupees(savings),
      proposedEmi: base.emiAtStart,
    });
    return {
      ...r,
      safeLoan: safeLoanAmount(rupees(Math.max(1, income)), rupees(otherEmis), rate, months),
    };
  }, [income, otherEmis, expenses, savings, base.emiAtStart, rate, months]);

  // Keep the URL in sync so the address bar is always a shareable snapshot.
  const scenario: ScenarioV1 = {
    v: 1,
    loan: { priceL, dpPct, rate, tenureYr },
    prepay: { extra, mode },
    shock: { add: shockAdd, startYr: shockStartYr, rampYrs: shockRampYrs, mode: shockMode },
    afford: { income, emis: otherEmis, expenses, savings },
  };
  const encoded = encodeScenario(scenario);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `${window.location.pathname}?s=${encoded}`);
  }, [encoded]);

  return {
    // inputs
    priceL, setPriceL, dpPct, setDpPct, rate, setRate, tenureYr,
    setTenure: (v: number) => { setTenureYr(v); setScrubYear((s) => Math.min(s, v)); },
    scrubYear, setScrubYear,
    extra, setExtra, mode, setMode,
    shockOpen, setShockOpen, shockAdd, setShockAdd, shockStartYr, setShockStartYr,
    shockRampYrs, setShockRampYrs, shockMode, setShockMode, effectiveShockMode,
    affOpen, setAffOpen, income, setIncome, otherEmis, setOtherEmis,
    expenses, setExpenses, savings, setSavings,
    // derived
    principal, months, base, plan, shocked, adviceEmi,
    shockedFinalEmi: shocked ? lastFullEmi(shocked) : 0,
    aff,
    shareUrl: () =>
      typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}?s=${encoded}`,
    applySafeLoan: () => {
      setPriceL(+((aff.safeLoan / 100 / 1e5) / (1 - dpPct / 100)).toFixed(1));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  };
}
