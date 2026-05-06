import type { ParameterFormat, WhatsAppTemplate } from '../models/whatsapp-template.model';

export interface WaParamSlot {
  component: 'header' | 'body';
  /** Variable key (positional "1" or named param). */
  key: string;
  /** Stable key for form model */
  storageKey: string;
  label: string;
  paramKind: 'text' | 'image';
}

/**
 * Keys for {{1}} or {{name}} in HEADER (TEXT) / BODY.
 */
function extractKeysFromText(text: string, pf: ParameterFormat): string[] {
  if (!text || !text.includes('{{')) return [];
  if (pf === 'NAMED') {
    const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
    const seen = new Set<string>();
    const keys: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const k = m[1].toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
    return keys;
  }
  const reNum = /\{\{\s*(\d+)\s*\}\}/g;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(text)) !== null) {
    nums.push(Number(m[1]));
  }
  return [...new Set(nums)].sort((a, b) => a - b).map(String);
}

/** Slots required to send this template (HEADER image / TEXT vars + BODY vars). */
export function listWhatsAppTemplateParamSlots(template: WhatsAppTemplate): WaParamSlot[] {
  const slots: WaParamSlot[] = [];
  const pf = (template.parameter_format || 'POSITIONAL') as ParameterFormat;

  const header = template.components?.find((c) => c.type === 'HEADER');
  if (header?.format === 'IMAGE') {
    slots.push({
      component: 'header',
      key: 'image',
      storageKey: 'header__image',
      label: 'Header image (public HTTPS URL)',
      paramKind: 'image'
    });
  } else if (header?.format === 'TEXT' && header.text?.includes('{{')) {
    for (const key of extractKeysFromText(header.text, pf)) {
      slots.push({
        component: 'header',
        key,
        storageKey: `header__${key}`,
        label: `Header · ${key}`,
        paramKind: 'text'
      });
    }
  }

  const body = template.components?.find((c) => c.type === 'BODY');
  if (body?.text?.includes('{{')) {
    for (const key of extractKeysFromText(body.text, pf)) {
      slots.push({
        component: 'body',
        key,
        storageKey: `body__${key}`,
        label: `Body · ${key}`,
        paramKind: 'text'
      });
    }
  }

  return slots;
}

/**
 * Build Meta Cloud API `template.components` from slot values.
 */
export function buildWhatsAppOutboundTemplateComponents(
  template: WhatsAppTemplate,
  slots: WaParamSlot[],
  values: Record<string, string>
): { type: string; parameters: Record<string, unknown>[] }[] {
  const pf = (template.parameter_format || 'POSITIONAL') as ParameterFormat;
  const components: { type: string; parameters: Record<string, unknown>[] }[] = [];

  const headerSlots = slots.filter((s) => s.component === 'header');
  if (headerSlots.length) {
    const parameters = headerSlots.map((s) => {
      const raw = (values[s.storageKey] ?? '').trim();
      if (s.paramKind === 'image') {
        return { type: 'image', image: { link: raw } };
      }
      if (pf === 'NAMED') {
        return { type: 'text', parameter_name: s.key, text: raw };
      }
      return { type: 'text', text: raw };
    });
    components.push({ type: 'header', parameters });
  }

  const bodySlots = slots.filter((s) => s.component === 'body');
  if (bodySlots.length) {
    const parameters = bodySlots.map((s) => {
      const raw = (values[s.storageKey] ?? '').trim();
      if (pf === 'NAMED') {
        return { type: 'text', parameter_name: s.key, text: raw };
      }
      return { type: 'text', text: raw };
    });
    components.push({ type: 'body', parameters });
  }

  return components;
}
