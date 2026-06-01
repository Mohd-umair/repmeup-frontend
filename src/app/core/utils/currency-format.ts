/** Default storefront / billing currency for RepMeUp (India). */
export const DEFAULT_CURRENCY = 'INR';

/**
 * Format an amount in INR (or given ISO code) using Indian locale grouping.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) {
    return '—';
  }
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const n = Number(amount);
  const maxFrac = Number.isInteger(n) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: 0
    }).format(n);
  } catch {
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: maxFrac })}`;
  }
}

/** Compact stat values (revenue KPIs) — whole rupees, no decimals. */
export function formatInrCompact(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) {
    return formatMoney(0, DEFAULT_CURRENCY);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Number(amount));
}
