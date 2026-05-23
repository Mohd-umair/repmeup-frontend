import {
  canProceedTemplateStep,
  getTemplateSlotValue
} from './campaign-template-validation';
import { ITemplateSlots } from '../../../core/services/campaign.service';
import { TemplateParamFormState } from './template-param-form/template-param-form.component';

describe('campaign-template-validation', () => {
  const imageBodyTemplate: ITemplateSlots = {
    header: { format: 'IMAGE', requiresMedia: true, textSlots: [] },
    body: {
      format: 'POSITIONAL',
      slots: [{ key: 'body.1', position: 1, label: '{{1}}' }]
    },
    buttons: [
      {
        index: 0,
        sub_type: 'url',
        text: 'Visit',
        urlVars: [{ key: 'button.url.0.1', position: 1, label: 'Button "Visit" {{1}}' }]
      }
    ],
    isAuth: false,
    isUnsupported: null
  };

  it('reads URL button values from urlButtonParams when defaultParams is empty', () => {
    const state: TemplateParamFormState = {
      defaultParams: { 'body.1': 'Alice' },
      varsFromCsv: [],
      headerMedia: { kind: 'IMAGE', url: 'https://cdn.example/a.jpg' },
      urlButtonParams: [{ index: 0, value: 'promo123' }]
    };

    expect(getTemplateSlotValue(state, 'button.url.0.1')).toBe('promo123');
    expect(canProceedTemplateStep(imageBodyTemplate, state)).toBeTrue();
  });

  it('blocks step 2 when header media is missing', () => {
    const state: TemplateParamFormState = {
      defaultParams: { 'body.1': 'Alice', 'button.url.0.1': 'promo123' },
      varsFromCsv: [],
      urlButtonParams: [{ index: 0, value: 'promo123' }]
    };

    expect(canProceedTemplateStep(imageBodyTemplate, state)).toBeFalse();
  });

  it('allows CSV-mapped body slots without fixed defaults', () => {
    const state: TemplateParamFormState = {
      defaultParams: { 'button.url.0.1': 'promo123' },
      varsFromCsv: ['body.1'],
      headerMedia: { kind: 'IMAGE', url: 'https://cdn.example/a.jpg' },
      urlButtonParams: [{ index: 0, value: 'promo123' }]
    };

    expect(canProceedTemplateStep(imageBodyTemplate, state)).toBeTrue();
  });
});
