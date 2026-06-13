import { FEATURE_KEY } from '../services/entitlements.store';

export interface IPlanHighlight {
  key: string;
  label: string;
  value: string;
  raw?: number;
  unit?: string | null;
  resetPeriod?: string | null;
}

export interface IPlanFeatureBullet {
  key: string;
  label: string;
}

export interface IPlanCardData {
  name: string;
  tier: number;
  price: number | string;
  description?: string | null;
  limits: {
    maxAccounts: number;
    maxUsers: number;
    maxPostsPerMonth: number;
    maxAutoRepliesPerMonth: number;
    maxAICreditsPerMonth: number;
  };
  highlights?: IPlanHighlight[];
  features?: IPlanFeatureBullet[];
  legacyFeatures?: string[];
  badge?: string | null;
  badgeColor?: string | null;
  billingCycle?: string;
}

const HIGHLIGHT_ICON_MAP: Record<string, string> = {
  [FEATURE_KEY.ACCOUNTS_MAX]: 'fas fa-plug',
  [FEATURE_KEY.USERS_MAX]: 'fas fa-users',
  [FEATURE_KEY.POSTS_PER_MONTH]: 'fas fa-paper-plane',
  [FEATURE_KEY.CREDITS_AUTO_REPLY]: 'fas fa-robot',
  [FEATURE_KEY.CREDITS_AI_GENERAL]: 'fas fa-bolt',
  [FEATURE_KEY.STORAGE_GB]: 'fas fa-database',
  [FEATURE_KEY.INBOX_UNIQUE_CONTACTS]: 'fas fa-inbox',
  [FEATURE_KEY.CAMPAIGNS_RECIPIENTS_MONTHLY]: 'fas fa-bullhorn',
  [FEATURE_KEY.COMMERCE_PRODUCTS_MAX]: 'fas fa-store',
  [FEATURE_KEY.WHATSAPP_TEMPLATES_MAX]: 'fab fa-whatsapp'
};

export function planHighlightIcon(key: string): string {
  return HIGHLIGHT_ICON_MAP[key] || 'fas fa-circle-check';
}

export function legacyHighlightsFromLimits(limits: IPlanCardData['limits']): IPlanHighlight[] {
  const rows: Array<{ key: string; label: string; raw: number }> = [
    { key: FEATURE_KEY.ACCOUNTS_MAX, label: 'Connected accounts', raw: limits.maxAccounts },
    { key: FEATURE_KEY.USERS_MAX, label: 'Team members', raw: limits.maxUsers },
    { key: FEATURE_KEY.POSTS_PER_MONTH, label: 'Posts per month', raw: limits.maxPostsPerMonth },
    { key: FEATURE_KEY.CREDITS_AUTO_REPLY, label: 'Auto-replies per month', raw: limits.maxAutoRepliesPerMonth },
    { key: FEATURE_KEY.CREDITS_AI_GENERAL, label: 'Reppy credits per month', raw: limits.maxAICreditsPerMonth }
  ];
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: formatPlanLimit(r.raw),
    raw: r.raw
  }));
}

export function formatPlanLimit(value: number | undefined | null): string {
  if (value === -1) return 'Unlimited';
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('en-IN');
}

export function resolvePlanHighlights(plan: IPlanCardData): IPlanHighlight[] {
  if (plan.highlights?.length) return plan.highlights;
  return legacyHighlightsFromLimits(plan.limits);
}

export function resolvePlanFeatures(plan: IPlanCardData): IPlanFeatureBullet[] {
  if (plan.features?.length) return plan.features;
  return (plan.legacyFeatures || []).map((code) => ({
    key: code,
    label: formatLegacyFeatureName(code)
  }));
}

export function formatLegacyFeatureName(feature: string): string {
  return feature
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function sortPlanKeys(plans: Record<string, IPlanCardData> | null): string[] {
  if (!plans) return [];
  return Object.keys(plans).sort((a, b) => (plans[a].tier ?? 0) - (plans[b].tier ?? 0));
}
