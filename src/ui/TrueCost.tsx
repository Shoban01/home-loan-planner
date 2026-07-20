import { useState } from 'react';
import { formatINR as fmt, formatCompactINR as fmtC, rupees } from '../engine/money.ts';
import type { Schedule } from '../engine/types.ts';
import { NumField, Expander, InsightCard } from './components.tsx';
import { IN } from '../config/in.ts';

/**
 * "What will I actually pay on day zero?" — the costs the loan doesn't cover.
 * Inputs here are location-specific one-offs, so they're local state and not
 * part of the shareable URL scenario (PROJECT.md §4).
 */
export function TrueCost({
  priceL, dpPct, principal, tenureYr, base,
}: {
  priceL: number; dpPct: number; principal: number; tenureYr: number; base: Schedule;
}) {
  const [open, setOpen] = useState(false);
  const [stampPct, setStampPct] = useState(7);
  const [underConstruction, setUnderConstruction] = useState(false);
  const [procFeePct, setProcFeePct] = useState(0.5);
  const [insurance, setInsurance] = useState(0); // premium in rupees

  const price = rupees(priceL * 1e5);
  const downPayment = Math.round(price * dpPct / 100);
  const stamp = Math.round(price * stampPct / 100);
  const registration = Math.round(price * IN.upfrontCosts.registrationPct / 100);
  const gst = underConstruction
    ? Math.round(price * IN.upfrontCosts.gstUnderConstructionPct / 100)
    : 0;
  const procFee = Math.round(principal * procFeePct / 100);
  const dayZero = downPayment + stamp + registration + gst + procFee;

  // A premium financed inside the loan repays at the same multiple as the loan.
  const loanMultiple = base.totalPaid / base.params.principal;
  const insuranceTrueCost = Math.round(rupees(insurance) * loanMultiple);

  const rows: Array<[string, number]> = [
    [`Down payment (${dpPct}%)`, downPayment],
    [`Stamp duty (${stampPct}%)`, stamp],
    [`Registration (${IN.upfrontCosts.registrationPct}%)`, registration],
    ...(underConstruction ? [[`GST — under-construction (${IN.upfrontCosts.gstUnderConstructionPct}%)`, gst] as [string, number]] : []),
    [`Processing fee (${procFeePct}% of loan)`, procFee],
  ];

  return (
    <Expander title="What will I actually pay on day zero?"
      subtitle="Stamp duty, registration & fees the loan doesn't cover"
      open={open} onToggle={() => setOpen((o) => !o)}>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-3 text-sm text-slate-500">
        <span>Stamp duty</span>
        <NumField value={stampPct} onCommit={setStampPct} min={0} max={12} decimals={1} suffix="%" />
        <span>· Processing fee</span>
        <NumField value={procFeePct} onCommit={setProcFeePct} min={0} max={3} decimals={2} suffix="%" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 mb-4">
        <input type="checkbox" checked={underConstruction}
          onChange={(e) => setUnderConstruction(e.target.checked)}
          className="accent-emerald-600" />
        Under-construction property (adds {IN.upfrontCosts.gstUnderConstructionPct}% GST)
      </label>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
        <p className="text-xs text-slate-400 mb-2">Cash you need on day zero — none of this comes from the loan:</p>
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between text-sm py-0.5 tabular-nums">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-700">{fmt(amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold border-t border-slate-200 mt-2 pt-2 tabular-nums">
          <span>Total day-zero cash</span>
          <span className="text-slate-900">{fmtC(dayZero)}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Indicative — stamp duty and registration vary by state (Tamil Nadu is ~7% + 1%; women
        owners get concessions in several states). Confirm with your registrar's office. Budget a
        little extra for interiors, society deposits, and moving.
      </p>

      <p className="text-sm font-semibold text-slate-600 mb-2">One thing to watch: loan insurance</p>
      <div className="flex items-center gap-2 mb-3 text-sm text-slate-500">
        <span>Premium the bank proposes:</span>
        <NumField value={insurance} onCommit={setInsurance} min={0} max={2000000} decimals={0} prefix="₹" wide />
      </div>
      {insurance > 0 ? (
        <InsightCard tone="warn" title={`That ${fmtC(rupees(insurance))} premium really costs ${fmtC(insuranceTrueCost)}`}>
          Banks often add a single-premium home-loan protection plan (HLPP) <b>into the loan
          itself</b> — so you pay interest on it for {tenureYr} years, turning{' '}
          {fmtC(rupees(insurance))} into about <b>{fmtC(insuranceTrueCost)}</b>. Insurance for your
          family is a genuinely good idea — but a plain <b>term life policy</b> bought separately
          usually gives more cover for far less, and it isn't compulsory to buy the bank's plan to
          get the loan. Ask for the loan offer with and without it.
        </InsightCard>
      ) : (
        <p className="text-xs text-slate-400">
          If the bank quotes a one-time insurance premium with your loan, enter it above to see
          what it really costs once it's financed inside the loan.
        </p>
      )}
    </Expander>
  );
}
