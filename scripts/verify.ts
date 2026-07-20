/**
 * Framework-free verification harness. Runs with plain `node scripts/verify.ts`
 * (Node 22.18+ strips types natively). Mirrors the Vitest suite so the engine
 * can be validated in environments without npm access.
 */
import assert from 'node:assert/strict';
import { computeEmi, computeSchedule, principalForEmi } from '../src/engine/loan.ts';
import { computeAffordability } from '../src/engine/affordability.ts';
import { baseInsights, prepaymentInsight, tenureVsEmiInsight, rateShockInsight } from '../src/engine/insights.ts';
import { lakh, rupees, formatINR, formatCompactINR, toRupees } from '../src/engine/money.ts';

const P = lakh(50); // ₹50,00,000
const RATE = 8.5;
const MONTHS = 240;

// --- Golden: EMI ------------------------------------------------------------
const emi = computeEmi(P, RATE, MONTHS);
console.log('EMI ₹50L @8.5% 240mo =', formatINR(emi), `(${toRupees(emi)})`);

// --- Base schedule ----------------------------------------------------------
const base = computeSchedule({ principal: P, annualRatePct: RATE, tenureMonths: MONTHS });
console.log('months =', base.months);
console.log('totalInterest =', formatCompactINR(base.totalInterest), toRupees(base.totalInterest));
console.log('totalPaid =', formatCompactINR(base.totalPaid), toRupees(base.totalPaid));
console.log('first month: interest =', formatINR(base.rows[0].interest),
  'principal =', formatINR(base.rows[0].principalComponent),
  'share =', ((base.rows[0].interest / base.rows[0].emi) * 100).toFixed(1) + '%');
const y5 = base.years[4];
console.log('after 5y: paid =', formatCompactINR(y5.cumulativePaid),
  'principal cleared =', formatCompactINR(y5.cumulativePrincipal),
  'interest =', formatCompactINR(y5.cumulativeInterest));

// Invariants
assert.equal(base.rows[0].interest, 3541667, 'first-month interest is paise-precise');
assert.equal(base.rows[base.rows.length - 1].closingBalance, 0, 'ends at zero');
const principalSum = base.rows.reduce((s, r) => s + r.principalComponent + r.prepayment, 0);
assert.equal(principalSum, P, 'principal components sum to loan');
assert.ok(base.rows.every((r, i) => i === 0 || r.openingBalance === base.rows[i - 1].closingBalance), 'balance chain');
assert.ok(Math.abs(base.totalPaid - (base.totalInterest + base.totalPrincipal)) < 100, 'paid = interest + principal');

// --- Prepayment: +₹5k/month, reduce tenure ---------------------------------
const extra5k = computeSchedule(
  { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
  { prepayment: { extraMonthly: rupees(5000), mode: 'reduce_tenure' } },
);
console.log('\n+5k/mo: months =', extra5k.months,
  'saved =', formatCompactINR(base.totalInterest - extra5k.totalInterest),
  'years early =', ((base.months - extra5k.months) / 12).toFixed(1));
assert.ok(extra5k.totalInterest < base.totalInterest, 'prepayment reduces interest');
assert.ok(extra5k.months < base.months, 'prepayment shortens tenure');

// --- Reduce tenure vs reduce EMI -------------------------------------------
const extra5kEmiMode = computeSchedule(
  { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
  { prepayment: { extraMonthly: rupees(5000), mode: 'reduce_emi' } },
);
console.log('reduce_emi mode: months =', extra5kEmiMode.months,
  'interest =', formatCompactINR(extra5kEmiMode.totalInterest),
  '| tenure-mode advantage =', formatCompactINR(extra5kEmiMode.totalInterest - extra5k.totalInterest));
assert.ok(extra5kEmiMode.totalInterest > extra5k.totalInterest, 'reduce_tenure beats reduce_emi');

// --- Annual lumpsum ---------------------------------------------------------
const bonus = computeSchedule(
  { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
  { prepayment: { annualLumpsum: rupees(100000), lumpsumMonthOfYear: 12 } },
);
console.log('₹1L bonus/yr: months =', bonus.months,
  'saved =', formatCompactINR(base.totalInterest - bonus.totalInterest));

// --- Rate shock +2% at month 25, bank keeps EMI ----------------------------
const shocked = computeSchedule(
  { principal: P, annualRatePct: RATE, tenureMonths: MONTHS },
  { rateChanges: [{ fromMonth: 25, annualRatePct: RATE + 2 }], rateChangeMode: 'reduce_tenure' },
);
console.log('rate +2% @m25 keep-EMI: months =', shocked.months,
  'extra interest =', formatCompactINR(shocked.totalInterest - base.totalInterest),
  'negAm =', shocked.negativeAmortization);
assert.ok(shocked.months > base.months, 'rate rise stretches tenure');

// --- principalForEmi round-trip --------------------------------------------
const back = principalForEmi(emi, RATE, MONTHS);
assert.ok(Math.abs(back - P) < rupees(100), `round-trip within ₹100 (got ${formatINR(back)})`);

// --- Edge cases -------------------------------------------------------------
const oneMonth = computeSchedule({ principal: rupees(10000), annualRatePct: 12, tenureMonths: 1 });
assert.equal(oneMonth.months, 1);
assert.equal(oneMonth.rows[0].closingBalance, 0);

const zeroRate = computeSchedule({ principal: rupees(120000), annualRatePct: 0, tenureMonths: 12 });
assert.equal(zeroRate.totalInterest, 0);
assert.equal(zeroRate.months, 12);

const hugePrepay = computeSchedule(
  { principal: rupees(100000), annualRatePct: 10, tenureMonths: 120 },
  { prepayment: { extraMonthly: rupees(200000) } },
);
assert.equal(hugePrepay.months, 1, 'prepayment capped at balance');

// --- Affordability ----------------------------------------------------------
const aff = computeAffordability({
  netMonthlyIncome: rupees(120000),
  existingEmis: rupees(8000),
  monthlyExpenses: rupees(45000),
  emergencySavings: rupees(400000),
  proposedEmi: emi,
});
console.log('\naffordability: FOIR =', aff.foirPct.toFixed(1) + '%', 'band =', aff.band,
  'maxComfortableEmi =', formatINR(aff.maxComfortableEmi),
  'buffer =', aff.bufferMonths.toFixed(1) + 'mo');
assert.ok(aff.foirPct > 35 && aff.foirPct < 50);

// --- Insights render --------------------------------------------------------
for (const i of baseInsights(base)) console.log('•', i.severity, '|', i.title);
console.log('•', prepaymentInsight(base, extra5k).title);
console.log('•', tenureVsEmiInsight(extra5k, extra5kEmiMode).title);
console.log('•', rateShockInsight(base, shocked).title);

// --- URL scenario state ------------------------------------------------------
const { encodeScenario, decodeScenario } = await import('../src/ui/urlState.ts');
const sc = {
  v: 1 as const,
  loan: { priceL: 60, dpPct: 25, rate: 8.35, tenureYr: 18 },
  prepay: { extra: 7500, mode: 'reduce_tenure' as const },
  shock: { add: 2, startYr: 3, rampYrs: 8, mode: 'keep_emi' as const },
  afford: { income: 150000, emis: 8000, expenses: 50000, savings: 700000 },
};
assert.deepEqual(decodeScenario(encodeScenario(sc)), sc, 'url round-trip');
assert.equal(decodeScenario('garbage!!'), null, 'garbage url → null');
const evil = decodeScenario(Buffer.from(JSON.stringify({ v: 1, loan: { priceL: 9e9 } })).toString('base64url'));
assert.equal(evil && evil.loan.priceL, 2000, 'hostile url clamped');

console.log('\nALL CHECKS PASSED');
