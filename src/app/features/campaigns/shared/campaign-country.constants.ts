/** ISO region → display label for campaign audience default country picker. */
export const CAMPAIGN_COUNTRY_LABELS: Record<string, string> = {
  IN: 'India (+91)',
  AE: 'United Arab Emirates (+971)',
  US: 'United States (+1)',
  GB: 'United Kingdom (+44)',
  SA: 'Saudi Arabia (+966)',
  QA: 'Qatar (+974)',
  KW: 'Kuwait (+965)',
  BH: 'Bahrain (+973)',
  OM: 'Oman (+968)',
  SG: 'Singapore (+65)',
  MY: 'Malaysia (+60)',
  AU: 'Australia (+61)',
  CA: 'Canada (+1)',
  DE: 'Germany (+49)',
  FR: 'France (+33)'
};

export function campaignCountryLabel(code: string): string {
  const c = String(code || '').trim().toUpperCase();
  return CAMPAIGN_COUNTRY_LABELS[c] || c;
}

export function formatE164Display(digits: string | null | undefined): string {
  if (!digits) return '—';
  return `+${digits}`;
}
