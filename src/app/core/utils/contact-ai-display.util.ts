import { IContact } from '../models/contact.model';

const INTENT_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  complaint: 'Complaint',
  praise: 'Praise',
  feedback: 'Feedback',
  support: 'Support',
  other: 'Other'
};

export function isMongoObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value.trim());
}

/** Human-readable intent — returns null for bucket IDs and invalid values. */
export function formatAiIntentLabel(intent?: string | null): string | null {
  if (!intent?.trim()) return null;
  const raw = intent.trim();
  if (isMongoObjectId(raw)) return null;
  const key = raw.toLowerCase();
  if (INTENT_LABELS[key]) return INTENT_LABELS[key];
  if (key.length <= 32 && !/^[a-f0-9]+$/i.test(key)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
  }
  return null;
}

/** Single-line AI status for contacts list and summaries. */
export function getContactAiStatusLabel(contact: IContact): string {
  const sentiment = contact.aiInsights?.sentiment?.toLowerCase();
  if (sentiment === 'negative') return 'Negative sentiment';
  if (sentiment === 'positive') return 'Positive sentiment';

  if (contact.intelligence?.churnRisk === 'high') return 'At risk';
  if ((contact.intelligence?.leadScore || 0) >= 70) return 'Hot lead';
  if (contact.intelligence?.healthBand === 'at_risk') return 'Needs attention';

  const priority = contact.aiInsights?.priority?.toLowerCase();
  if (priority === 'high' || priority === 'urgent') return 'High priority';

  const intent = formatAiIntentLabel(contact.aiInsights?.intent);
  if (intent) return intent;

  if (sentiment === 'neutral') return 'Neutral sentiment';

  return '—';
}
