import { FlowChannel, IFlowEdge, IFlowNode } from '../../../../core/models/flow-builder.model';

/** Everyday blocks shown in the Simple palette. Search still finds every block. */
export const SIMPLE_PALETTE_TYPES = new Set([
  'trigger.first_message',
  'trigger.keyword',
  'trigger.ig_comment',
  'trigger.ig_dm',
  'action.send_text',
  'action.send_media',
  'action.send_buttons',
  'wait.user_reply',
  'action.escalate_human',
  'control.end'
]);

/** Shop-owner names for Simple palette / canvas. */
export const SIMPLE_NODE_LABELS: Record<string, string> = {
  'trigger.first_message': 'First WhatsApp message',
  'trigger.keyword': 'They type a word',
  'trigger.ig_comment': 'Someone comments',
  'trigger.ig_dm': 'Instagram message',
  'action.send_text': 'Send a message',
  'action.send_media': 'Send a photo',
  'action.send_buttons': 'Ask a question',
  'wait.user_reply': 'Wait for their answer',
  'action.escalate_human': 'Send to a person',
  'control.end': 'Stop'
};

export function simpleNodeLabel(type: string, fallback?: string): string {
  return SIMPLE_NODE_LABELS[type] || fallback || type;
}

const HUMAN_EDGE_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  reply: 'They replied',
  no_reply: "If they don't reply",
  timeout: "If they don't reply",
  offered: 'Offered',
  none: 'None',
  booked: 'Booked',
  failed: "Couldn't book",
  a: 'A',
  b: 'B'
};

export function humanEdgeLabel(label?: string | null): string {
  if (!label) return '';
  const key = String(label).trim().toLowerCase();
  return HUMAN_EDGE_LABELS[key] || String(label);
}

export function slugFromTitle(title: string): string {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || 'btn';
}

/** Sample values so {{username}} etc. look like a real chat in the phone preview. */
const PREVIEW_VARS: Record<string, string> = {
  username: 'Aisha',
  name: 'Aisha',
  product_name: 'Silk kurta',
  price: '1,299',
  currency: 'INR',
  payment_url: 'pay.example.com',
  appointment_ref: 'APT-102',
  service_name: 'Haircut',
  appointment_when: 'Tomorrow, 11:00 AM',
  order_ref: 'ORD-88',
  order_total: '₹1,299',
  order_summary_line: '1 × Silk kurta',
  saved_address: '12 MG Road, Bengaluru',
  sizes: 'S, M, L',
  message: 'price?'
};

export function fillPreviewVars(text: unknown): string {
  const raw = String(text ?? '');
  if (!raw) return '';
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => PREVIEW_VARS[key] || `{{${key}}}`);
}

export interface IStampedFlow {
  name: string;
  description: string;
  channels: FlowChannel[];
  entryNodeId: string;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
}

const COL_X = 320;
const STEP_Y = 130;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function node(
  id: string,
  type: string,
  label: string,
  row: number,
  config: Record<string, unknown> = {},
  x = COL_X
): IFlowNode {
  return { id, type, label, position: { x, y: 20 + row * STEP_Y }, config };
}

function edge(source: string, target: string, label?: string): IFlowEdge {
  return { id: `${source}-${target}`, source, target, ...(label ? { label } : {}) };
}

function stampWelcome(): IStampedFlow {
  return {
    name: 'Welcome message',
    description: 'First WhatsApp hello.',
    channels: ['whatsapp'],
    entryNodeId: 't1',
    nodes: [
      node('t1', 'trigger.first_message', 'First WhatsApp message', 0),
      node('a1', 'action.send_text', 'Say hello', 1, {
        text: 'Hi {{username}}! 👋 Thanks for messaging us. How can we help you today?'
      }),
      node('e1', 'control.end', 'Done', 2)
    ],
    edges: [edge('t1', 'a1'), edge('a1', 'e1')]
  };
}

function stampKeyword(): IStampedFlow {
  return {
    name: 'Keyword reply',
    description: 'Reply to words like “price”.',
    channels: ['whatsapp'],
    entryNodeId: 't1',
    nodes: [
      node('t1', 'trigger.keyword', 'They type a word', 0, {
        keywords: ['price', 'cost', 'how much']
      }),
      node('a1', 'action.send_text', 'Send reply', 1, {
        text: 'Hi {{username}}! Thanks for asking. We’ll share the details here shortly. 🙌'
      }),
      node('e1', 'control.end', 'Done', 2)
    ],
    edges: [edge('t1', 'a1'), edge('a1', 'e1')]
  };
}

/** Matches the seeded Comment-to-DM blueprint so the recipe is a working Instagram path. */
function stampCommentDm(): IStampedFlow {
  return {
    name: 'Comment to message',
    description: 'Instagram comment → DM.',
    channels: ['instagram'],
    entryNodeId: 't1',
    nodes: [
      node('t1', 'trigger.ig_comment', 'On post comment', 0, { keywords: [] }),
      node('r1', 'action.reply_public_comment', 'Public reply', 1, {
        text: 'Thanks {{username}}! 🙌 Just sent you a DM with the details 📩'
      }),
      node('p1', 'action.send_post_products', "DM post's products", 2, {}),
      node('e1', 'control.end', 'Done', 3)
    ],
    edges: [edge('t1', 'r1'), edge('r1', 'p1'), edge('p1', 'e1')]
  };
}

/**
 * Linear booking path used only when the seeded appointment blueprint is missing.
 * Happy path: keyword → greet → pick service → offer slots → book → confirm.
 */
function stampBookAppointment(): IStampedFlow {
  return {
    name: 'Book appointment',
    description: 'Offer times and book.',
    channels: ['whatsapp'],
    entryNodeId: 't1',
    nodes: [
      node('t1', 'trigger.keyword', 'On “book”', 0, {
        keywords: ['book', 'appointment', 'booking', 'slot', 'schedule', 'appt']
      }),
      node('a0', 'action.send_text', 'Greet', 1, {
        text: 'Happy to help you book! 📅'
      }),
      node('s1', 'action.offer_services', 'Ask which service', 2, {
        bodyText: 'Which service would you like to book?',
        noServicesText: 'Sorry, no services are available to book right now. Please try again later. 🙏'
      }),
      node('ws', 'wait.user_reply', 'Wait for service', 3, { timeoutSec: 3600 }),
      node('o1', 'action.offer_slots', 'Offer slots', 4, {
        serviceId: '',
        providerId: '',
        maxSlots: 6,
        days: 7,
        bodyText: 'Here are the next available times — reply with the number you’d like:',
        noSlotsText: 'Sorry, we’re fully booked for that service right now. Please check back soon! 🙏'
      }),
      node('w1', 'wait.user_reply', 'Wait for slot', 5, { timeoutSec: 3600 }),
      node('b1', 'action.book_appointment', 'Book', 6, { confirmMode: 'auto' }),
      node('c1', 'action.send_text', 'Confirm', 7, {
        text: '✅ You’re booked! {{appointment_ref}}\n\n🗓️ {{service_name}} on {{appointment_when}}\nWe’ll send you a reminder. See you then! 🙌'
      }),
      node('e1', 'control.end', 'Done', 8)
    ],
    edges: [
      edge('t1', 'a0'),
      edge('a0', 's1'),
      edge('s1', 'ws', 'offered'),
      edge('ws', 'o1', 'reply'),
      edge('o1', 'w1', 'offered'),
      edge('w1', 'b1', 'reply'),
      edge('b1', 'c1', 'booked'),
      edge('c1', 'e1')
    ]
  };
}

const STAMPS: Record<string, () => IStampedFlow> = {
  welcome: stampWelcome,
  comment_dm: stampCommentDm,
  keyword: stampKeyword,
  book: stampBookAppointment
};

const STAMPS_BY_TRIGGER: Record<string, () => IStampedFlow> = {
  'trigger.first_message': stampWelcome,
  'trigger.ig_comment': stampCommentDm,
  'trigger.keyword': stampKeyword
};

export function stampRecipeGraph(recipeId: string): IStampedFlow | null {
  const build = STAMPS[recipeId];
  return build ? clone(build()) : null;
}

export function stampByTriggerType(triggerType: string): IStampedFlow | null {
  const build = STAMPS_BY_TRIGGER[triggerType];
  return build ? clone(build()) : null;
}
