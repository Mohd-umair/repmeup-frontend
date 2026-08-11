/**
 * Shapes returned by GET /api/plans/pricing-page.
 *
 * Everything here is already display-ready — prices are formatted strings, savings
 * percentages are computed, and every cell carries an explicit `included` flag.
 * The pricing page renders these values; it must not recompute them.
 */

export type BillingCycleChoice = 'monthly' | 'annual';

export interface PricingAmount {
  amount: number | string;
  display: string;
  suffix: string | null;
  priceInr: number | null;
}

export interface PricingAnnualAmount extends PricingAmount {
  perMonthEquivalent: number;
  perMonthEquivalentDisplay: string;
  /** The monthly price shown struck through beside the annual offer. */
  strikeThrough: string | null;
  savingsPercent: number | null;
  savingsLabel: string | null;
}

export interface PricingBlock {
  monthly: PricingAmount;
  annual: PricingAnnualAmount | null;
}

export interface PricingHeadlineMetric {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  resetPeriod: string | null;
  note: string | null;
}

export interface PricingBullet {
  label: string;
  /** false renders greyed out — the sheet advertises what a tier lacks. */
  included: boolean;
  note: string | null;
  featureKey: string | null;
}

export interface PricingLimitedOffer {
  badge: string | null;
  endsAt: string | null;
}

export interface PricingPlanCard {
  planId: string;
  name: string;
  tier: number;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  cardStyle: 'light' | 'dark';
  /** Resolved plan NAME, so the card prints "Everything in Starter" with no lookup. */
  inheritsFrom: string | null;
  limitedOffer: PricingLimitedOffer | null;
  headline: PricingHeadlineMetric[];
  bullets: PricingBullet[];
  pricing: PricingBlock;
  isCustomPrice: boolean;
}

export interface PricingComparisonCell {
  display: string;
  included: boolean;
  note: string | null;
  highlighted: boolean;
  isAddOn?: boolean;
}

export interface PricingComparisonRow {
  label: string;
  metering: 'AC' | 'NAC';
  spansAllColumns: boolean;
  cells: PricingComparisonCell[];
}

export interface PricingComparisonSection {
  id: string;
  title: string;
  rows: PricingComparisonRow[];
}

export interface PricingComparison {
  planColumns: { planId: string; name: string; highlighted: boolean }[];
  sections: PricingComparisonSection[];
}

export interface PricingLegendEntry {
  code: 'AC' | 'NAC';
  description: string;
}

export interface WhatsAppRate {
  category: string;
  label: string;
  display: string;
}

export interface WhatsAppRatesPanel {
  note: string;
  rates: WhatsAppRate[];
}

export interface PricingPageData {
  plans: PricingPlanCard[];
  enterprise: PricingPlanCard | null;
  comparison: PricingComparison;
  legend: PricingLegendEntry[];
  whatsappRates: WhatsAppRatesPanel;
}

export interface PricingPageResponse {
  success: boolean;
  data?: PricingPageData;
  error?: string;
}
