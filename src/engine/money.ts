/** Integer-paise money helpers plus Indian-locale formatting. */

export const PAISE = 100;

export function rupees(amount: number): number {
  return Math.round(amount * PAISE);
}

export function lakh(amount: number): number {
  return rupees(amount * 100_000);
}

export function toRupees(paise: number): number {
  return paise / PAISE;
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** "₹43,391" — always whole rupees. */
export function formatINR(paise: number): string {
  return inr.format(Math.round(toRupees(paise)));
}

/** "₹54.1L", "₹1.04 Cr" — for headlines, not ledgers. */
export function formatCompactINR(paise: number): string {
  const r = toRupees(paise);
  const abs = Math.abs(r);
  if (abs >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  return formatINR(paise);
}
