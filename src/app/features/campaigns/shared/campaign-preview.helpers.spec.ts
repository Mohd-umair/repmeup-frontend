import { buildCampaignMessagePreview } from './campaign-preview.helpers';
import { ITemplateSlots } from '../../../core/services/campaign.service';
import { WhatsAppTemplate } from '../../../core/models/whatsapp-template.model';
import { TemplateParamFormState } from './template-param-form/template-param-form.component';

describe('campaign-preview.helpers', () => {
  const template: WhatsAppTemplate = {
    name: 'summer_sale',
    category: 'MARKETING',
    language: 'en',
    parameter_format: 'POSITIONAL',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      {
        type: 'BODY',
        text: 'Hi {{1}}, check out our offer!'
      },
      { type: 'FOOTER', text: 'Reply STOP to unsubscribe' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Shop now', url: 'https://shop.example/{{1}}', example: ['sale'] }
        ]
      }
    ]
  };

  const slots: ITemplateSlots = {
    header: { format: 'IMAGE', requiresMedia: true, textSlots: [] },
    body: {
      format: 'POSITIONAL',
      slots: [{ key: 'body.1', position: 1, label: '{{1}}', exampleValue: 'Customer' }]
    },
    buttons: [
      {
        index: 0,
        sub_type: 'url',
        text: 'Shop now',
        urlVars: [{ key: 'button.url.0.1', position: 1, label: 'Button "Shop now" {{1}}' }]
      }
    ],
    isAuth: false,
    isUnsupported: null
  };

  it('interpolates body, header image, and dynamic button URL', () => {
    const state: TemplateParamFormState = {
      defaultParams: {
        'body.1': 'Alice',
        'button.url.0.1': 'winter'
      },
      varsFromCsv: [],
      headerMedia: {
        kind: 'IMAGE',
        url: 'https://cdn.example/promo.jpg',
        filename: 'promo.jpg'
      },
      urlButtonParams: [{ index: 0, value: 'winter' }]
    };

    const preview = buildCampaignMessagePreview(template, slots, state);

    expect(preview.bodyText).toBe('Hi Alice, check out our offer!');
    expect(preview.headerImageUrl).toBe('https://cdn.example/promo.jpg');
    expect(preview.footerText).toBe('Reply STOP to unsubscribe');
    expect(preview.buttons[0].url).toBe('https://shop.example/winter');
  });
});
