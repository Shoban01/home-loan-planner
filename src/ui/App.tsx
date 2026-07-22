import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { formatINR as fmt, formatCompactINR as fmtC, rupees, toRupees } from '../engine/money.ts';
import { NumField, Slider, InsightCard, Expander } from './components.tsx';
import { useLoanScenario } from './useLoanScenario.ts';
import { TrueCost } from './TrueCost.tsx';
import { useState } from 'react';
import { computeEmi, computeSchedule } from '../engine/loan.ts';
import type { YearSummary } from '../engine/types.ts';


const toL = (paise: number, dp = 1) => +(toRupees(paise) / 1e5).toFixed(dp);

function GoalSeek({ s }: { s: ReturnType<typeof useLoanScenario> }) {
  const [goalYr, setGoalYr] = useState(15);
  if (s.tenureYr < 2) return null;

  const goal = Math.min(goalYr, s.tenureYr - 1);           // can't "finish early" later than tenure
  const goalMonths = goal * 12;
  const goalEmi = computeEmi(s.principal, s.rate, goalMonths);
  const extraPaise = goalEmi - s.base.emiAtStart;
  const goalInterest = computeSchedule({
    principal: s.principal, annualRatePct: s.rate, tenureMonths: goalMonths,
  }).totalInterest;
  const savedPaise = s.base.totalInterest - goalInterest;
  const goalFoirPct = s.income > 0
    ? ((s.otherEmis + toRupees(goalEmi)) / s.income) * 100
    : 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 mb-2">
        <span className="font-semibold">Or set a goal — finish in</span>
        <NumField value={goal} onCommit={setGoalYr}
          min={1} max={Math.max(1, s.tenureYr - 1)} decimals={0} suffix="yr" />
        <span className="text-slate-400">instead of {s.tenureYr}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600 mb-2">
        Pay about <b>{fmt(Math.max(0, extraPaise))}/mo extra</b> (total EMI {fmt(goalEmi)}) and
        you're done in <b>{goal} years</b> — saving <b>{fmtC(savedPaise)}</b> in interest.
      </p>
      {goalFoirPct > 45 && (
        <p className="text-xs text-amber-700 mb-2">
          Heads up: that EMI would be ~{Math.round(goalFoirPct)}% of your income — check
          "Can I afford this loan?" below before committing to it.
        </p>
      )}
      <button
        onClick={() => {
          s.setExtra(Math.max(0, Math.round(toRupees(extraPaise))));
          s.setMode('reduce_tenure');
        }}
        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
        Apply this plan
      </button>
    </div>
  );
}

/**
 * Display-level fix for the whole-rupee EMI rounding residual: the engine
 * (correctly, like banks) may produce one extra month with a tiny sweep-up
 * payment (e.g. ₹102 in month 241 of a 240-month loan). Charting that as a
 * full "year 21" is honest math but misleading pedagogy — so for display,
 * fold any final year whose total payment is less than one EMI into the
 * previous year. The engine and its tests stay untouched.
 */
function foldResidualYear(years: YearSummary[], emiAtStart: number): YearSummary[] {
  const last = years[years.length - 1];
  if (years.length < 2 || last.totalPaid >= emiAtStart) return years;
  const prev = years[years.length - 2];
  return [...years.slice(0, -2), {
    ...prev,
    interestPaid: prev.interestPaid + last.interestPaid,
    principalPaid: prev.principalPaid + last.principalPaid,
    totalPaid: prev.totalPaid + last.totalPaid,
    closingBalance: last.closingBalance,
    cumulativeInterest: last.cumulativeInterest,
    cumulativePrincipal: last.cumulativePrincipal,
    cumulativePaid: last.cumulativePaid,
  }];
}

export default function App() {
  const s = useLoanScenario();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = s.shareUrl();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'My home loan scenario — LoanLabs', url }); } catch { /* user cancelled */ }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const { base, plan, shocked, aff } = s;

  const first = base.rows[0];
  const firstSharePct = Math.round((first.interest / first.emi) * 100);
  const displayYears = foldResidualYear(base.years, base.emiAtStart);
  const planYears = plan ? foldResidualYear(plan.years, plan.emiAtStart) : null;
  const shockYears = shocked ? foldResidualYear(shocked.years, shocked.emiAtStart) : null;

  const maxYear = displayYears.length;
  const sy = displayYears[Math.min(s.scrubYear, maxYear) - 1];

  const compositionData = displayYears.map((y) => ({
    year: y.year, Interest: toL(y.interestPaid, 2), Principal: toL(y.principalPaid, 2),
  }));
  const balanceData = displayYears.map((y, i) => ({
    year: y.year,
    Base: toL(y.closingBalance),
    Plan: planYears ? toL(planYears[i]?.closingBalance ?? 0) : undefined,
  }));
  const shockData = shockYears
    ? shockYears.map((y, i) => ({
        year: y.year,
        Base: displayYears[i] ? toL(displayYears[i].closingBalance) : undefined,
        Risen: toL(y.closingBalance),
      }))
    : [];

  const saved = plan ? base.totalInterest - plan.totalInterest : 0;
  const yearsEarly = plan ? ((base.months - plan.months) / 12).toFixed(1) : '0';
  const active = plan ?? base;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">

        {/* Masthead — scrolls away, sticky EMI header takes over */}
<div className="px-5 pt-4 pb-3">
  <p className="text-xl font-bold text-emerald-700 leading-tight flex items-center gap-1.5">
    LoanLabs 🏠
  </p>
  <p className="text-xs text-slate-500">Understand your home loan before you commit</p>
</div>

<div className="h-px bg-slate-200 mx-5 mb-3" />

<header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-3 flex justify-between items-end">
          <div>
            <p className="text-xs text-slate-400">Monthly EMI</p>
            <p className="text-2xl font-bold tabular-nums">
              {fmt(base.emiAtStart)}<span className="text-sm font-normal text-slate-400">/mo</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">You'll repay</p>
            <p className="text-lg font-bold text-amber-600 tabular-nums">{fmtC(active.totalPaid)}</p>
          </div>
        </header>

        {/* Act 1 — inputs */}
        <section className="px-5 pt-5 pb-2">
          <Slider label="Property price" value={s.priceL} min={10} max={300} step={0.5}
            edit={{ min: 1, max: 2000, decimals: 1, prefix: '₹', suffix: 'L', wide: true }}
            hint={s.priceL >= 100 ? ` ₹${(s.priceL / 100).toFixed(2)} Cr` : undefined}
            onChange={s.setPriceL} />
          <Slider label="Down payment" value={s.dpPct} min={10} max={60} step={1}
            edit={{ min: 0, max: 90, decimals: 0, suffix: '%' }}
            hint={fmtC(rupees(s.priceL * 1e5 * s.dpPct / 100))}
            onChange={s.setDpPct} />
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Interest rate" value={s.rate} min={7} max={12} step={0.05}
              edit={{ min: 1, max: 20, decimals: 2, suffix: '%' }}
              onChange={s.setRate} />
            <Slider label="Tenure" value={s.tenureYr} min={5} max={30} step={1}
              edit={{ min: 1, max: 40, decimals: 0, suffix: 'yr' }}
              onChange={s.setTenure} />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3 text-sm text-slate-600 tabular-nums">
            ₹{s.priceL}L price − {fmtC(rupees(s.priceL * 1e5 * s.dpPct / 100))} from your pocket ={' '}
            <span className="font-semibold text-slate-800">{fmtC(s.principal)} you borrow</span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            🔒 Everything runs on your device — no login, no server, no data collected.
          </p>
        </section>

        {/* Act 2 — the reveal */}
        <section className="px-5 py-4 border-t border-slate-100">
          <p className="text-base leading-relaxed mb-1">
            Over {s.tenureYr} years, your <span className="font-semibold">{fmtC(s.principal)} loan</span> adds up to{' '}
            <span className="font-bold text-amber-600">{fmtC(base.totalPaid)}</span>.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            <span className="font-semibold text-amber-700">{fmtC(base.totalInterest)}</span> of that is the
            cost of borrowing over time — normal for a long loan, and something you can shrink
            (we'll show you how below). Here's where each year's payments go:
          </p>

          <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={compositionData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: '₹ lakh / yr', angle: -90, position: 'insideLeft', offset: 22, style: { fontSize: 10, fill: '#94a3b8' } }} />
                <Tooltip formatter={(v: number, n: string) => [`₹${v}L`, n]} labelFormatter={(y) => `Year ${y}`} />
                <Area type="monotone" dataKey="Interest" stackId="1" stroke="#d97706" fill="#fbbf24" fillOpacity={0.75} />
                <Area type="monotone" dataKey="Principal" stackId="1" stroke="#059669" fill="#34d399" fillOpacity={0.75} />
                <ReferenceLine x={Math.min(s.scrubYear, maxYear)} stroke="#64748b" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 mt-1 mb-4">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1" />Interest (bank's share)</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400 mr-1" />Principal (your house)</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-slate-500 whitespace-nowrap">Drag to year</span>
            <input type="range" min={1} max={maxYear} step={1} value={Math.min(s.scrubYear, maxYear)}
              onChange={(e) => s.setScrubYear(Number(e.target.value))}
              className="w-full accent-slate-600" />
            <span className="text-sm font-semibold tabular-nums w-6 text-right">{Math.min(s.scrubYear, maxYear)}</span>
          </div>
          {sy && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm leading-relaxed">
              By end of year {sy.year} you'll have paid <span className="font-semibold">{fmtC(sy.cumulativePaid)}</span> —
              but only <span className="font-semibold text-emerald-700">{fmtC(sy.cumulativePrincipal)}</span> reduced your loan.{' '}
              <span className="font-semibold text-amber-700">{fmtC(sy.cumulativeInterest)}</span> was interest.
              You'd still owe <span className="font-semibold">{fmtC(sy.closingBalance)}</span>.
            </div>
          )}
          <button onClick={share}
            className="mt-3 text-sm text-emerald-700 font-semibold">
            {copied ? '✓ Link copied!' : 'Share this scenario 🔗'}
          </button>
          <p className="text-xs text-slate-400 mt-0.5">
            The link carries your numbers — whoever opens it sees exactly this loan, interactively.
          </p>
        </section>

        {/* Act 3 — prepayment what-if */}
        <section className="px-5 py-4 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-600 mb-3">What if I pay a little extra each month?</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {[0, 2000, 5000, 10000].map((v) => (
              <button key={v} onClick={() => s.setExtra(v)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  s.extra === v
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}>
                {v === 0 ? 'Nothing' : `+₹${v / 1000}k`}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 mb-3 text-sm ${
            ![0, 2000, 5000, 10000].includes(s.extra) ? 'text-emerald-700' : 'text-slate-500'
          }`}>
            <span>Or your own amount:</span>
            <NumField value={s.extra} onCommit={s.setExtra} min={0} max={1000000} decimals={0} prefix="₹" wide />
            <span className="text-slate-400">/mo</span>
          </div>

          <GoalSeek s={s} />

          {plan && (
            <>
              <div className="flex gap-2 mb-3 text-xs">
                {([['reduce_tenure', 'Shorten tenure ✓ recommended'], ['reduce_emi', 'Lower EMI (bank default)']] as const).map(([m, label]) => (
                  <button key={m} onClick={() => s.setMode(m)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      s.mode === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <InsightCard tone="good" title={`This plan saves ${fmtC(saved)}`}>
                Paying ₹{s.extra.toLocaleString('en-IN')} extra monthly{' '}
                {s.mode === 'reduce_tenure'
                  ? <>ends your loan <b>{yearsEarly} years early</b> and cuts <b>{fmtC(saved)}</b> of interest. RBI rules: floating-rate home loans have <b>zero prepayment penalty</b>.</>
                  : <>saves {fmtC(saved)} — but the same money saves far more if you ask the bank to <b>shorten the tenure</b> instead of lowering the EMI. Banks default to lowering EMI; you must ask.</>}
              </InsightCard>

              <div className="h-40 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={balanceData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number, n: string) => [`₹${v}L owed`, n === 'Base' ? 'Without extra' : 'With your plan']}
                      labelFormatter={(y) => `Year ${y}`} />
                    <Line type="monotone" dataKey="Base" stroke="#94a3b8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Plan" stroke="#059669" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-400 mt-1">Outstanding balance: grey = original plan, green = with extra payments.</p>
            </>
          )}
        </section>

        {/* Rate shock — collapsed */}
        {s.months > 36 && (
          <Expander title="What if interest rates change?"
            subtitle="Most home loans float with RBI's repo rate — stress-test yours"
            open={s.shockOpen} onToggle={() => s.setShockOpen(!s.shockOpen)}>
            <p className="text-xs text-slate-400 mb-3">
              Rates move in small 0.25% steps — but steps add up: between May 2022 and Feb 2023 the
              repo rose 2.5%, and home loan rates followed within weeks. Falls happen too:
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {([['none', 'No change', 0, 3, 0], ['fast', '+2.5% fast (like 2022)', 2.5, 3, 1], ['drift', '+2% slow drift', 2, 3, 8]] as const).map(([k, label, add, startYr, rampYrs]) => {
                const isActive = add === 0
                  ? s.shockAdd === 0
                  : s.shockAdd === add && s.shockStartYr === startYr && s.shockRampYrs === rampYrs;
                return (
                  <button key={k}
                    onClick={() => { s.setShockAdd(add); s.setShockStartYr(startYr); s.setShockRampYrs(rampYrs); }}
                    className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                      isActive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-sm text-slate-500">
              <span>Or your own:</span>
              <NumField value={s.shockAdd} onCommit={s.setShockAdd} min={-2} max={5} decimals={2} suffix="%" />
              <span>from year</span>
              <NumField value={s.shockStartYr} onCommit={s.setShockStartYr} min={1}
                max={Math.max(1, s.tenureYr - 2)} decimals={0} />
              <span>over</span>
              <NumField value={s.shockRampYrs} onCommit={s.setShockRampYrs} min={0} max={15}
                decimals={0} suffix="yrs" />
              <span className="text-xs text-slate-400">(0 = all at once)</span>
            </div>

            {shocked && (
              <>
                {s.shockAdd > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    {([['keep_emi', 'Bank keeps my EMI (their default)'], ['raise_emi', 'I raise my EMI (stay on track)']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => s.setShockMode(m)}
                        className={`px-3 py-1.5 rounded-lg border ${
                          s.shockMode === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {s.shockAdd > 0 && s.effectiveShockMode === 'keep_emi' && shocked.negativeAmortization && (
                  <InsightCard tone="alert" title="At this rate, the EMI stops working">
                    A +{s.shockAdd}% rise means {fmt(base.emiAtStart)} no longer covers even the monthly
                    interest — the balance would grow instead of shrink, and the loan would never
                    end. The fix is simple and fully in your hands: raise your EMI to about{' '}
                    <b>{fmt(s.adviceEmi)}</b> and you're back on schedule.
                  </InsightCard>
                )}
                {s.shockAdd > 0 && s.effectiveShockMode === 'keep_emi' && !shocked.negativeAmortization && (
                  <InsightCard tone="warn" title={`Same EMI, ${((shocked.months - base.months) / 12).toFixed(1)} more years`}>
                    If rates rise +{s.shockAdd}%
                    {s.shockRampYrs > 0 && <> in 0.25% steps over ~{s.shockRampYrs} years</>}
                    {' '}starting year {s.shockStartYr}, and your EMI stays {fmt(base.emiAtStart)}, the loan
                    quietly stretches from {Math.round(base.months / 12)} to{' '}
                    <b>{(shocked.months / 12).toFixed(1)} years</b> —{' '}
                    {fmtC(shocked.totalInterest - base.totalInterest)} more interest. Banks do this
                    silently; many borrowers never notice. Your move: ask for an EMI of about{' '}
                    <b>{fmt(s.adviceEmi)}</b> (+{fmt(s.adviceEmi - base.emiAtStart)}/mo) and keep your finish date.
                  </InsightCard>
                )}
                {s.shockAdd > 0 && s.effectiveShockMode === 'raise_emi' && (
                  <InsightCard tone="good" title="Raising the EMI absorbs the rise">
                    Letting your EMI climb with each step — reaching about{' '}
                    <b>{fmt(s.shockedFinalEmi)}</b> (+{fmt(s.shockedFinalEmi - base.emiAtStart)}/mo) —
                    keeps you finishing in ~{(shocked.months / 12).toFixed(1)} years, with{' '}
                    {fmtC(shocked.totalInterest - base.totalInterest)} extra interest — a fraction
                    of what the silent stretch costs. This is also a good number to stress-test in
                    "Can I afford this loan?" below.
                  </InsightCard>
                )}
                {s.shockAdd < 0 && (
                  <InsightCard tone="good" title={`A ${Math.abs(s.shockAdd)}% fall quietly works for you`}>
                    If rates ease {Math.abs(s.shockAdd)}% and you keep paying {fmt(base.emiAtStart)}, the loan
                    finishes in ~{(shocked.months / 12).toFixed(1)} years instead of{' '}
                    {Math.round(base.months / 12)} — saving{' '}
                    {fmtC(base.totalInterest - shocked.totalInterest)}. One tip: banks pass on cuts
                    less eagerly than hikes. Check your rate once a year; if it hasn't moved with the
                    repo, a written request — or a balance-transfer quote from another bank — usually
                    fixes it.
                  </InsightCard>
                )}

                <div className="h-40 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={shockData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number, n: string) => [`₹${v}L owed`, n === 'Base' ? "Today's rate" : `At ${s.shockAdd > 0 ? '+' : ''}${s.shockAdd}%`]}
                        labelFormatter={(y) => `Year ${y}`} />
                      <Line type="monotone" dataKey="Base" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Risen" stroke={s.shockAdd < 0 ? '#059669' : '#e11d48'} strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Outstanding balance: grey = today's rate, {s.shockAdd < 0 ? 'green = after the fall' : 'red = after the rise'}.
                </p>
              </>
            )}
          </Expander>
        )}

        {/* Affordability — collapsed */}
        <Expander title="Can I afford this loan?"
          subtitle="Check it against your income — 🔒 stays on your device "
          open={s.affOpen} onToggle={() => s.setAffOpen(!s.affOpen)}>
          <div className="space-y-3 mb-4">
            {([
              ['Take-home income', s.income, s.setIncome, '/mo', 5000, 10000000],
              ['Existing EMIs (car, personal…)', s.otherEmis, s.setOtherEmis, '/mo', 0, 1000000],
              ['Monthly expenses', s.expenses, s.setExpenses, '/mo', 0, 10000000],
              ['Savings left after down payment', s.savings, s.setSavings, '', 0, 100000000],
            ] as const).map(([label, val, set, suffix, mn, mx]) => (
              <div key={label} className="flex justify-between items-center gap-2">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="flex items-baseline gap-1">
                  <NumField value={val} onCommit={set} min={mn} max={mx} decimals={0} prefix="₹" wide />
                  {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              aff.band === 'comfortable' ? 'bg-emerald-100 text-emerald-800'
              : aff.band === 'stretch' ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
            }`}>
              {aff.band === 'comfortable' ? 'Fits comfortably' : aff.band === 'stretch' ? 'A stretch' : 'Too tight for comfort'}
            </span>
            <span className="text-sm text-slate-600 tabular-nums">
              {Math.round(aff.foirPct)}% of income → EMIs
            </span>
          </div>

          <div className="relative h-2.5 rounded-full overflow-hidden flex mb-1">
            <div className="bg-emerald-200" style={{ width: '58.3%' }} />
            <div className="bg-amber-200" style={{ width: '16.7%' }} />
            <div className="bg-rose-200" style={{ width: '25%' }} />
            <div className="absolute top-0 h-full w-1 bg-slate-700 rounded"
              style={{ left: `${Math.min(aff.foirPct, 59) / 60 * 100}%` }} />
          </div>
          <div className="flex text-[10px] text-slate-400 mb-3 tabular-nums">
            <span style={{ width: '58.3%' }}>up to 35% comfortable</span>
            <span style={{ width: '16.7%' }}>45%</span>
            <span>tight</span>
          </div>

          <p className="text-sm leading-relaxed text-slate-600 mb-3">
            {aff.band === 'comfortable' && (
              <>This EMI fits with room to breathe — about <b>{fmt(Math.max(0, aff.monthlySurplus))}</b> stays
              free each month for savings and life.</>
            )}
            {aff.band === 'stretch' && (
              <>Doable, but with less slack than we'd like{aff.monthlySurplus >= 0 && (
                <> — <b>{fmt(aff.monthlySurplus)}</b> would remain each month</>
              )}. A bigger down payment or a slightly smaller home would turn "tight" into "easy".</>
            )}
            {aff.band === 'danger' && (
              <>Right now this EMI would squeeze your monthly budget hard. That's not a no — it's a
              "not yet". The number below is a loan size that fits your income today.</>
            )}
          </p>

          {aff.bufferMonths < 6 && (
            <p className="text-sm leading-relaxed text-slate-600 mb-3">
              Your savings would cover <b>{aff.bufferMonths.toFixed(1)} months</b> of expenses and EMIs.
              Growing that toward <b>6 months</b> before signing means a job gap never threatens your home.
            </p>
          )}

          <p className="text-xs text-slate-400 mb-3">
            A bank may approve up to ~55% of your income — their risk is covered by your house.
            We aim for what stays comfortable for <i>you</i>: up to 35%.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-600 leading-relaxed mb-2">
              A comfortable EMI for you is about <b>{fmt(aff.maxComfortableEmi)}</b> — at {s.rate}% for{' '}
              {s.tenureYr} years, that supports a loan of{' '}
              <b className="text-emerald-700">{fmtC(aff.safeLoan)}</b>.
            </p>
            <button onClick={s.applySafeLoan}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
              Try {fmtC(aff.safeLoan)} as my loan
            </button>
          </div>
        </Expander>

        <TrueCost priceL={s.priceL} dpPct={s.dpPct} principal={s.principal}
          tenureYr={s.tenureYr} base={base} />

        {/* Teach — always-on insights */}
        <section className="px-5 py-4 border-t border-slate-100 pb-8">
          <p className="text-sm font-semibold text-slate-600 mb-3">Three things worth knowing early</p>
          <InsightCard tone="warn" title={`Your first EMI is ${firstSharePct}% interest`}>
            Of your first {fmt(first.emi)} payment, {fmt(first.interest)} is interest
            and only {fmt(first.principalComponent)} reduces the loan. Interest works like rent on
            borrowed money: the more you still hold, the more rent you pay — so it's naturally
            highest at the start and fades every year.
          </InsightCard>
          {maxYear > 5 && (
            <InsightCard tone="info" title="The early years mostly pay interest — by design">
              After 5 years you'll have paid {fmtC(base.years[4].cumulativePaid)}, of which{' '}
              {fmtC(base.years[4].cumulativePrincipal)} cleared principal. This is exactly why prepaying
              <b> early</b> is a superpower — and prepaying late barely moves the needle.
            </InsightCard>
          )}
          {base.totalInterest > s.principal && (
            <InsightCard tone="warn" title="Why the total is roughly double">
              You borrow {fmtC(s.principal)} and repay {fmtC(base.totalPaid)} — the difference is the
              price of {s.tenureYr} years of time, and lakhs of homeowners pay it happily for a roof
              they own. You hold two levers to shrink it: a shorter tenure, and early prepayments
              (try the chips above).
            </InsightCard>
          )}
          <p className="text-xs text-slate-400 mt-4 leading-relaxed">
            Educational tool, not financial advice. Numbers use the standard reducing-balance method
            banks use; actual EMIs may differ by a few rupees due to disbursal dates and rounding.
          </p>
        </section>
      </div>
    </div>
  );
}
