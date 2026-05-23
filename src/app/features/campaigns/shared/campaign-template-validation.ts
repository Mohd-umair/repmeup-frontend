import {
  ICampaignUrlButtonParam,
  ITemplateSlot,
  ITemplateSlots
} from '../../../core/services/campaign.service';
import { TemplateParamFormState } from './template-param-form/template-param-form.component';

/** Read a filled value for a template slot from editor state. */
export function getTemplateSlotValue(
  state: TemplateParamFormState,
  slotKey: string
): string {
  const fromDefault = (state.defaultParams?.[slotKey] || '').trim();
  if (fromDefault) return fromDefault;

  const buttonMatch = /^button\.(?:url|copy_code)\.(\d+)\./.exec(slotKey);
  if (buttonMatch) {
    const buttonIndex = Number(buttonMatch[1]);
    const override = state.urlButtonParams?.find(p => p.index === buttonIndex);
    return (override?.value || '').trim();
  }

  return '';
}

export function collectTemplateTextSlots(slots: ITemplateSlots): ITemplateSlot[] {
  return [
    ...(slots.header?.textSlots || []),
    ...(slots.body?.slots || []),
    ...(slots.buttons || []).flatMap(b => b.urlVars || [])
  ];
}

export function getMissingTemplateSlots(
  slots: ITemplateSlots,
  state: TemplateParamFormState
): ITemplateSlot[] {
  const missing: ITemplateSlot[] = [];

  for (const slot of collectTemplateTextSlots(slots)) {
    if (state.varsFromCsv?.includes(slot.key)) continue;
    if (!getTemplateSlotValue(state, slot.key)) missing.push(slot);
  }

  return missing;
}

export function canProceedTemplateStep(
  slots: ITemplateSlots | null,
  state: TemplateParamFormState
): boolean {
  if (!slots || slots.isUnsupported || slots.isAuth) return false;

  if (slots.header?.requiresMedia && !state.headerMedia?.url?.trim()) {
    return false;
  }

  if (slots.header?.format === 'LOCATION') {
    const loc = state.headerLocation;
    if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) {
      return false;
    }
  }

  return getMissingTemplateSlots(slots, state).length === 0;
}
