import { ParameterFormat, WhatsAppTemplate } from '../models/whatsapp-template.model';

/** Matches backend `whatsappTemplatePreview` persisted on Interaction replies */
export interface WhatsAppTemplatePreviewDisplay {
  templateName: string;
  languageCode: string;
  category: string | null;
  headerImageUrl: string | null;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  buttons: Array<{ type: string; text: string; url: string | null; phone_number: string | null }>;
}

function normType(t: string | undefined): string {
  return String(t || '').toLowerCase();
}

function textParamsFromSent(comp?: { parameters?: Record<string, unknown>[] }): Record<string, unknown>[] {
  const ps = comp?.parameters;
  if (!Array.isArray(ps)) return [];
  return ps.filter((p) => normType(String(p?.['type'])) === 'text');
}

function interpolatePositional(templateText: string, values: string[]): string {
  if (!templateText) return '';
  let i = 0;
  return templateText.replace(/\{\{\s*(\d+)\s*\}\}/g, () => {
    const v = values[i++];
    return v != null ? String(v) : '';
  });
}

function interpolateNamed(templateText: string, paramMap: Record<string, string>): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, raw: string) => {
    const k = String(raw).toLowerCase();
    return Object.prototype.hasOwnProperty.call(paramMap, k) ? paramMap[k] : '';
  });
}

function interpolateComponent(
  templateText: string,
  sentComp: { parameters?: Record<string, unknown>[] } | undefined,
  parameterFormat: ParameterFormat
): string {
  if (!templateText) return '';
  const texts = textParamsFromSent(sentComp).map((p) => String((p as { text?: unknown }).text ?? ''));
  if (parameterFormat === 'NAMED' && /\{\{\s*\d+\s*\}\}/.test(templateText)) {
    return interpolatePositional(templateText, texts);
  }
  if (parameterFormat === 'NAMED') {
    const map: Record<string, string> = {};
    for (const p of textParamsFromSent(sentComp)) {
      const k = String((p as { parameter_name?: unknown }).parameter_name ?? '')
        .toLowerCase()
        .trim();
      if (k) map[k] = String((p as { text?: unknown }).text ?? '');
    }
    return interpolateNamed(templateText, map);
  }
  return interpolatePositional(templateText, texts);
}

function fallbackBodyFromSent(bodySent?: { parameters?: Record<string, unknown>[] }): string {
  return textParamsFromSent(bodySent)
    .map((p) => String((p as { text?: unknown }).text ?? ''))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function firstImageLinkFromSent(headerSent?: {
  parameters?: { type?: string; image?: { link?: string } }[];
}): string | null {
  const img = headerSent?.parameters?.find((p) => normType(p?.type) === 'image');
  const link = img?.image?.link;
  return link ? String(link).trim() : null;
}

function normalizeButtons(buttons?: Array<Record<string, unknown>>): WhatsAppTemplatePreviewDisplay['buttons'] {
  if (!Array.isArray(buttons)) return [];
  return buttons.map((b) => {
    const type = String(b['type'] ?? '').toUpperCase();
    const text = String(b['text'] ?? '').trim() || type;
    let url = b['url'] ? String(b['url']) : null;
    const example = Array.isArray(b['example']) ? (b['example'] as string[]) : [];
    if (url && example.length) {
      let idx = 0;
      url = url.replace(/\{\{\s*\d+\s*\}\}/g, () => String(example[idx++] ?? ''));
    }
    return {
      type,
      text,
      url,
      phone_number: b['phone_number'] ? String(b['phone_number']) : null
    };
  });
}

/**
 * Builds the same inbox preview payload as backend `whatsappTemplatePreview`
 * (template definition + outbound components Meta shape).
 */
export function buildWhatsAppTemplatePreviewDisplay(
  templateDef: WhatsAppTemplate,
  outboundComponents: { type: string; parameters: Record<string, unknown>[] }[]
): WhatsAppTemplatePreviewDisplay {
  const parameterFormat = (templateDef.parameter_format || 'POSITIONAL') as ParameterFormat;
  const sentComponents = Array.isArray(outboundComponents) ? outboundComponents : [];

  const headerSent = sentComponents.find((c) => normType(c.type) === 'header');
  const bodySent = sentComponents.find((c) => normType(c.type) === 'body');

  const comps = templateDef.components || [];
  const dbHeader = comps.find((c) => c.type === 'HEADER');
  const dbBody = comps.find((c) => c.type === 'BODY');
  const dbFooter = comps.find((c) => c.type === 'FOOTER');
  const dbButtons = comps.find((c) => c.type === 'BUTTONS');

  let headerImageUrl: string | null = null;
  let headerText: string | null = null;

  if (dbHeader?.format === 'IMAGE' || dbHeader?.format === 'VIDEO' || dbHeader?.format === 'DOCUMENT') {
    headerImageUrl = firstImageLinkFromSent(headerSent);
  } else if (dbHeader?.format === 'TEXT' && dbHeader.text) {
    const s = interpolateComponent(dbHeader.text, headerSent, parameterFormat).trim();
    headerText = s || null;
  } else {
    headerImageUrl = firstImageLinkFromSent(headerSent);
  }

  let bodyText = '';
  if (dbBody?.text) {
    bodyText = interpolateComponent(dbBody.text, bodySent, parameterFormat).trim();
  } else {
    bodyText = fallbackBodyFromSent(bodySent);
  }

  const templateName = String(templateDef.name || '').trim();
  const languageCode = String(templateDef.language || 'en_US').trim() || 'en_US';
  if (!bodyText && templateName) {
    bodyText = `«${templateName}»`;
  }

  const footerText = dbFooter?.text?.trim() ? String(dbFooter.text).trim() : null;

  return {
    templateName,
    languageCode,
    category: templateDef.category ?? null,
    headerImageUrl,
    headerText,
    bodyText,
    footerText,
    buttons: normalizeButtons(dbButtons?.buttons as Array<Record<string, unknown>> | undefined)
  };
}
