import { WhatsAppTemplate } from '../../../core/models/whatsapp-template.model';
import {
  buildWhatsAppTemplatePreviewDisplay,
  WhatsAppTemplatePreviewDisplay
} from '../../../core/utils/whatsapp-template-preview.helpers';
import { ITemplateSlot, ITemplateSlots } from '../../../core/services/campaign.service';
import { TemplateParamFormState } from './template-param-form/template-param-form.component';
import { getTemplateSlotValue } from './campaign-template-validation';

type OutboundComponent = { type: string; parameters: Record<string, unknown>[] };

function slotPreviewText(
  slot: ITemplateSlot,
  state: TemplateParamFormState
): string {
  if (state.varsFromCsv?.includes(slot.key)) {
    return slot.exampleValue?.trim() || `[${slot.label}]`;
  }
  return getTemplateSlotValue(state, slot.key) || slot.exampleValue?.trim() || '…';
}

function resolveDynamicUrl(
  url: string,
  urlVars: ITemplateSlot[],
  state: TemplateParamFormState
): string {
  return url.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, raw: string) => {
    const n = parseInt(raw, 10);
    const slot = urlVars.find(v => v.position === n);
    if (!slot) return '';
    if (state.varsFromCsv?.includes(slot.key)) {
      return slot.exampleValue?.trim() || `[${slot.label}]`;
    }
    return getTemplateSlotValue(state, slot.key) || slot.exampleValue?.trim() || '…';
  });
}

/** Build Meta-shaped outbound components for preview (mirrors backend campaign builder). */
export function buildCampaignPreviewComponents(
  slots: ITemplateSlots,
  state: TemplateParamFormState
): OutboundComponent[] {
  const out: OutboundComponent[] = [];

  const headerFormat = slots.header?.format;
  if (headerFormat === 'IMAGE' && state.headerMedia?.url) {
    out.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: state.headerMedia.url } }]
    });
  } else if (headerFormat === 'VIDEO' && state.headerMedia?.url) {
    out.push({
      type: 'header',
      parameters: [{ type: 'video', video: { link: state.headerMedia.url } }]
    });
  } else if (headerFormat === 'DOCUMENT' && state.headerMedia?.url) {
    const doc: Record<string, unknown> = { link: state.headerMedia.url };
    if (state.headerMedia.filename) doc['filename'] = state.headerMedia.filename;
    out.push({
      type: 'header',
      parameters: [{ type: 'document', document: doc }]
    });
  } else if (headerFormat === 'TEXT' && slots.header.textSlots?.length) {
    out.push({
      type: 'header',
      parameters: slots.header.textSlots.map(slot => {
        const p: Record<string, unknown> = {
          type: 'text',
          text: slotPreviewText(slot, state)
        };
        if (slot.name) p['parameter_name'] = slot.name;
        return p;
      })
    });
  }

  if (slots.body?.slots?.length) {
    out.push({
      type: 'body',
      parameters: slots.body.slots.map(slot => {
        const p: Record<string, unknown> = {
          type: 'text',
          text: slotPreviewText(slot, state)
        };
        if (slot.name) p['parameter_name'] = slot.name;
        return p;
      })
    });
  }

  return out;
}

function buildPreviewButtons(
  template: WhatsAppTemplate,
  slots: ITemplateSlots,
  state: TemplateParamFormState
): WhatsAppTemplatePreviewDisplay['buttons'] {
  const buttonsComp = template.components?.find(c => c.type === 'BUTTONS');
  const defs = buttonsComp?.buttons;
  if (!Array.isArray(defs) || !defs.length) return [];

  return defs.map((btn, i) => {
    const type = String(btn.type || '').toUpperCase();
    const text = String(btn.text || '').trim() || type;
    let url = btn.url ? String(btn.url) : null;

    if (url && type === 'URL') {
      const slotGroup = (slots.buttons || []).find(b => b.index === i);
      if (slotGroup?.urlVars?.length) {
        url = resolveDynamicUrl(url, slotGroup.urlVars, state);
      } else if (Array.isArray(btn.example) && btn.example.length) {
        let idx = 0;
        url = url.replace(/\{\{\s*\d+\s*\}\}/g, () => String(btn.example![idx++] ?? ''));
      }
    }

    return {
      type,
      text,
      url,
      phone_number: btn.phone_number ? String(btn.phone_number) : null
    };
  });
}

/** Full WhatsApp message preview for the campaign editor. */
export function buildCampaignMessagePreview(
  template: WhatsAppTemplate,
  slots: ITemplateSlots,
  state: TemplateParamFormState
): WhatsAppTemplatePreviewDisplay {
  const components = buildCampaignPreviewComponents(slots, state);
  const display = buildWhatsAppTemplatePreviewDisplay(template, components);
  display.buttons = buildPreviewButtons(template, slots, state);
  return display;
}

export function campaignPreviewUsesCsvVars(state: TemplateParamFormState): boolean {
  return (state.varsFromCsv?.length || 0) > 0;
}
