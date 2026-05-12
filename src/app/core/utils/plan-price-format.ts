/**
 * Subscription plan amounts are stored in INR (whole rupees, not paise).
 * Razorpay uses `priceInr` on the Plan document in paise separately.
 */

export function formatPlanPriceMonthly(price: number | string): string {
  if (price === 'custom') return 'Contact Sales';
  if (typeof price === 'number') {
    if (price === 0) return 'Free';
    const formatted = price.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return `₹${formatted}/mo`;
  }
  return String(price);
}
