import {
  CreateTemplatePayload,
  ParameterFormat,
  TemplateCategory,
  TemplateComponent,
  TemplateButton
} from '../models/whatsapp-template.model';

/** Curated Meta-compliant blueprint — still requires your WABA approval after submit. */
export interface WhatsAppTemplateStarter {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  language: string;
  parameter_format: ParameterFormat;
  /** Suggested template name (lowercase, underscores). User may edit before submit. */
  suggestedName: string;
  components: TemplateComponent[];
  tags?: string[];
}

export const WHATSAPP_TEMPLATE_STARTERS: WhatsAppTemplateStarter[] = [
  {
    id: 'order_shipped',
    title: 'Order shipped',
    description: 'Notify customers when an order leaves your warehouse.',
    category: 'UTILITY',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'order_shipped_update',
    tags: ['ecommerce', 'shipping'],
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, your order {{2}} has shipped and is on its way. Track your package for delivery updates.',
        example: { body_text: [['John', 'ORD-12345']] }
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to opt out'
      }
    ]
  },
  {
    id: 'order_delivered',
    title: 'Order delivered',
    description: 'Confirm successful delivery and invite feedback.',
    category: 'UTILITY',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'order_delivered_confirm',
    tags: ['ecommerce', 'shipping'],
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, your order {{2}} was delivered. We hope you enjoy it! Need help? Reply to this message.',
        example: { body_text: [['John', 'ORD-12345']] }
      }
    ]
  },
  {
    id: 'appointment_reminder',
    title: 'Appointment reminder',
    description: 'Remind customers about an upcoming booking.',
    category: 'UTILITY',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'appointment_reminder',
    tags: ['booking', 'calendar'],
    components: [
      {
        type: 'BODY',
        text: 'Reminder: Hi {{1}}, you have an appointment on {{2}} at {{3}}. Reply YES to confirm or RESCHEDULE to change.',
        example: { body_text: [['Sarah', 'Monday 12 May', '2:30 PM']] }
      }
    ]
  },
  {
    id: 'payment_received',
    title: 'Payment received',
    description: 'Transactional receipt after a successful payment.',
    category: 'UTILITY',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'payment_received_receipt',
    tags: ['billing', 'finance'],
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, we received your payment of {{2}} for invoice {{3}}. Thank you!',
        example: { body_text: [['Alex', '$49.00', 'INV-9001']] }
      }
    ]
  },
  {
    id: 'support_ticket_update',
    title: 'Support ticket update',
    description: 'Let customers know their support case progressed.',
    category: 'UTILITY',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'support_ticket_update',
    tags: ['support', 'helpdesk'],
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, update on ticket {{2}}: {{3}}. Reply here if you need anything else.',
        example: { body_text: [['Maria', '#1042', 'Our team is reviewing your request']] }
      }
    ]
  },
  {
    id: 'welcome_message',
    title: 'Welcome message',
    description: 'Greet new subscribers who opted in to WhatsApp updates.',
    category: 'MARKETING',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'welcome_subscriber',
    tags: ['onboarding', 'marketing'],
    components: [
      {
        type: 'BODY',
        text: 'Welcome {{1}}! Thanks for connecting with us on WhatsApp. You will receive offers and updates here. Reply STOP anytime to unsubscribe.',
        example: { body_text: [['there']] }
      },
      {
        type: 'FOOTER',
        text: 'Sent by RepMeUp'
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'QUICK_REPLY', text: 'View offers' }]
      }
    ]
  },
  {
    id: 'promo_offer',
    title: 'Promotional offer',
    description: 'Share a limited-time discount (marketing — opt-in required).',
    category: 'MARKETING',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'promo_limited_offer',
    tags: ['marketing', 'sales'],
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Special offer for you'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, enjoy {{2}} off your next order with code {{3}}. Valid until {{4}}.',
        example: { body_text: [['John', '20%', 'SAVE20', '31 Dec']] }
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to opt out'
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'QUICK_REPLY', text: 'Shop now' }]
      }
    ]
  },
  {
    id: 'account_verification',
    title: 'OTP verification',
    description: 'Authentication template for one-time codes (Meta-generated body).',
    category: 'AUTHENTICATION',
    language: 'en_US',
    parameter_format: 'POSITIONAL',
    suggestedName: 'account_verification_code',
    tags: ['auth', 'otp'],
    components: [
      {
        type: 'BODY',
        add_security_recommendation: true,
        code_expiration_minutes: 10
      },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'COPY_CODE', text: 'Copy code' }]
      }
    ]
  }
];

export function starterBodyPreview(starter: WhatsAppTemplateStarter): string {
  const body = starter.components.find(c => c.type === 'BODY');
  if (starter.category === 'AUTHENTICATION') {
    return '*123456* is your verification code.';
  }
  return body?.text || starter.description;
}

export function starterToCreatePayload(
  starter: WhatsAppTemplateStarter,
  connectionId?: string
): CreateTemplatePayload {
  return {
    connectionId,
    name: starter.suggestedName,
    category: starter.category,
    language: starter.language,
    parameter_format: starter.parameter_format,
    components: starter.components
  };
}

export function filterStarters(query: string, category: TemplateCategory | ''): WhatsAppTemplateStarter[] {
  let list = [...WHATSAPP_TEMPLATE_STARTERS];
  if (category) list = list.filter(s => s.category === category);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.suggestedName.includes(q) ||
    (s.tags || []).some(t => t.includes(q))
  );
}
