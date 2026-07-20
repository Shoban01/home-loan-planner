/**
 * Shareable scenario state, encoded in the URL as ?s=<base64url(json)>.
 *
 * Pure functions only — DOM wiring lives in useLoanScenario. Untrusted by
 * design: anything can arrive in a crafted URL, so decode clamps every value
 * to sane bounds and returns null for garbage rather than throwing.
 * True-cost inputs (stamp duty %, etc.) are deliberately NOT in v1 — they're
 * location-specific one-offs, not part of the core scenario people compare.
 */

export interface ScenarioV1 {
  v: 1;
  loan: { priceL: number; dpPct: number; rate: number; tenureYr: number };
  prepay: { extra: number; mode: 'reduce_tenure' | 'reduce_emi' };
  shock: { add: number; startYr: number; rampYrs: number; mode: 'keep_emi' | 'raise_emi' };
  afford: { income: number; emis: number; expenses: number; savings: number };
}

const clamp = (n: unknown, min: number, max: number, fallback: number): number => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, x));
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;

/** Clamp an arbitrary parsed object into a valid ScenarioV1. */
export function clampScenario(raw: any): ScenarioV1 {
  return {
    v: 1,
    loan: {
      priceL: clamp(raw?.loan?.priceL, 1, 2000, 62.5),
      dpPct: clamp(raw?.loan?.dpPct, 0, 90, 20),
      rate: clamp(raw?.loan?.rate, 1, 20, 8.5),
      tenureYr: clamp(raw?.loan?.tenureYr, 1, 40, 20),
    },
    prepay: {
      extra: clamp(raw?.prepay?.extra, 0, 1_000_000, 0),
      mode: oneOf(raw?.prepay?.mode, ['reduce_tenure', 'reduce_emi'] as const, 'reduce_tenure'),
    },
    shock: {
      add: clamp(raw?.shock?.add, -2, 5, 0),
      startYr: clamp(raw?.shock?.startYr, 1, 38, 3),
      rampYrs: clamp(raw?.shock?.rampYrs, 0, 15, 0),
      mode: oneOf(raw?.shock?.mode, ['keep_emi', 'raise_emi'] as const, 'keep_emi'),
    },
    afford: {
      income: clamp(raw?.afford?.income, 5000, 10_000_000, 120000),
      emis: clamp(raw?.afford?.emis, 0, 1_000_000, 0),
      expenses: clamp(raw?.afford?.expenses, 0, 10_000_000, 45000),
      savings: clamp(raw?.afford?.savings, 0, 100_000_000, 500000),
    },
  };
}

export function encodeScenario(s: ScenarioV1): string {
  const b64 = btoa(JSON.stringify(s));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Returns a clamped scenario, or null for garbage / unknown versions. */
export function decodeScenario(param: string): ScenarioV1 | null {
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const raw = JSON.parse(atob(b64));
    // migrateScenario: v1 is the only version. When v2 lands, migrate v1→v2
    // here and bump the check — never silently accept unknown versions.
    if (raw?.v !== 1) return null;
    return clampScenario(raw);
  } catch {
    return null;
  }
}
