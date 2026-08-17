import { FEATURE_KEY, FeatureKey } from '../services/entitlements.store';

/** Fallback plan feature keys for routes when menu DB row lacks requiresFeature. */
export const ROUTE_PLAN_FEATURES: Record<string, FeatureKey> = {
  '/app/campaigns': FEATURE_KEY.CAMPAIGNS_ENABLED,
  '/app/catalog': FEATURE_KEY.COMMERCE_WA_CATALOG_ENABLED,
  '/app/whatsapp-templates': FEATURE_KEY.WHATSAPP_TEMPLATES_MAX,
  '/app/whatsapp-form-flows': FEATURE_KEY.WHATSAPP_FLOWS_ENABLED,
  '/app/agents': FEATURE_KEY.AGENTS_ENABLED,
  '/app/reports': FEATURE_KEY.ANALYTICS_ADVANCED,
  '/app/analytics': FEATURE_KEY.ANALYTICS_ADVANCED,
  '/app/automation': FEATURE_KEY.AUTO_REPLY_ENABLED,
  '/app/automation/ai-replies': FEATURE_KEY.AUTO_REPLY_ENABLED,
  '/app/automation/growth': FEATURE_KEY.AUTO_REPLY_ENABLED,
  '/app/automation/flows': FEATURE_KEY.AUTO_REPLY_ENABLED,
  '/app/automation/whatsapp-flows': FEATURE_KEY.AUTO_REPLY_ENABLED,
  '/app/voice-ivr': FEATURE_KEY.VOICE_IVR_ENABLED
};

export function resolvePlanFeatureForRoute(path: string): FeatureKey | undefined {
  const normalized = path.split('?')[0].replace(/\/+$/, '') || '/app';
  if (ROUTE_PLAN_FEATURES[normalized]) return ROUTE_PLAN_FEATURES[normalized];
  const match = Object.keys(ROUTE_PLAN_FEATURES)
    .filter((p) => normalized.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_PLAN_FEATURES[match] : undefined;
}
