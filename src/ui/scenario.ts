import type { RateChange, Schedule } from '../engine/types.ts';

/**
 * Express a stepped rate ramp as the engine's native rateChanges[] list.
 *
 * The engine deliberately has no "ramp" concept — a ramp IS a list of rate
 * changes (PROJECT.md §3). This helper is the single place that mapping
 * lives. Semantics match the shipped demo exactly: the change moves in
 * 0.25% increments, evenly spaced over rampYears, with the final step
 * landing on the exact target (so a +1.1% ramp ends at +1.1%, not +1.0%).
 * rampYears = 0 means a single instant change at fromMonth.
 */
export function rampToRateChanges(
  baseRatePct: number,
  addPct: number,
  fromMonth: number,
  rampYears: number,
): RateChange[] {
  if (addPct === 0) return [];
  const sign = addPct > 0 ? 1 : -1;
  const totalSteps = Math.max(1, Math.round(Math.abs(addPct) / 0.25));
  const rampMonths = rampYears * 12;
  if (rampMonths === 0) {
    return [{ fromMonth, annualRatePct: baseRatePct + addPct }];
  }
  const interval = Math.max(1, Math.round(rampMonths / totalSteps));
  const changes: RateChange[] = [];
  for (let s = 1; s <= totalSteps; s++) {
    const delta = sign * (s >= totalSteps ? Math.abs(addPct) : s * 0.25);
    changes.push({
      fromMonth: fromMonth + (s - 1) * interval,
      annualRatePct: baseRatePct + delta,
    });
  }
  return changes;
}

/**
 * The EMI in force near the end of a schedule (last full month, skipping the
 * residual-corrected final payment). For a raise-EMI shock this is the EMI
 * the borrower ends up paying after all steps have landed.
 */
export function lastFullEmi(s: Schedule): number {
  const rows = s.rows;
  if (rows.length >= 2) return rows[rows.length - 2].emi;
  return rows[0]?.emi ?? 0;
}
