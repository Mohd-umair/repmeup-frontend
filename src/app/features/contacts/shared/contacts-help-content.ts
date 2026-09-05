import { ContactsHelpScenario, ContactsHelpSection } from './contacts-help.model';

export const CUSTOM_FIELDS_HELP: { title: string; subtitle: string; sections: ContactsHelpSection[]; scenarios: ContactsHelpScenario[] } = {
  title: 'How custom fields work',
  subtitle: 'Define extra data you want to store on each contact — visible in Customer 360 and usable in filters.',
  sections: [
    {
      title: 'What are custom fields?',
      icon: 'fa-sliders',
      summary: 'Standard contacts have name, phone, email, tags, etc. Custom fields let you track business-specific data like tier, birthday, or account manager.',
      examples: [
        'Dropdown "Customer tier" → Bronze, Silver, Gold',
        'Number "Store credit balance" → used in filters with ≥ / ≤',
        'Date "Renewal date" → track subscription renewals'
      ]
    },
    {
      title: 'Where they appear',
      icon: 'fa-user-circle',
      summary: 'After you create a field, it shows on Customer 360 (when you open a contact) and in Contacts → Filters → Advanced rules as custom.field_key.',
      examples: [
        'Field key customer_tier → filter as custom.customer_tier',
        'Agents fill values while viewing a contact profile'
      ]
    },
    {
      title: 'Field types',
      icon: 'fa-list',
      summary: 'Pick the type that matches how you will store and filter the data.',
      examples: [
        'Text — free text (e.g. "Referral source")',
        'Dropdown / Multi-select — fixed options (comma-separated list)',
        'Number / Currency — amounts for scoring or filters',
        'Yes / No — boolean flags',
        'Date — birthdays, renewals, follow-up dates'
      ]
    }
  ],
  scenarios: [
    {
      title: 'Create a "Customer tier" dropdown (prefilled example)',
      steps: [
        'Label: Customer tier · Key: customer_tier (auto-generated if blank)',
        'Type: Dropdown · Options: Bronze, Silver, Gold, Platinum',
        'Click Add field — then open any contact in Customer 360 to set the tier'
      ]
    }
  ]
};

export const SEGMENTS_HELP = {
  title: 'How segments work',
  subtitle: 'Segments are saved groups of contacts defined by rules. Use them for campaigns, tags, and bulk assign.',
  sections: [
    {
      title: 'Live vs static',
      icon: 'fa-layer-group',
      summary: 'A segment uses filter rules (platform, lifecycle, scores, etc.). The member count updates when you click Refresh — contacts enter or leave as they match.',
      examples: [
        'Rule: Platform is WhatsApp → all WhatsApp contacts',
        'Combine rules with AND: WhatsApp + VIP → high-value WhatsApp customers'
      ]
    },
    {
      title: 'Actions on a segment',
      icon: 'fa-bolt',
      summary: 'Each segment card lets you run bulk actions on everyone who currently matches the rules.',
      examples: [
        'Campaign — open WhatsApp campaign builder',
        'Add tag — tag all matching contacts (e.g. "vip-whatsapp")',
        'Assign owner — assign a sales rep to the whole group',
        'Export CSV — download matching contacts'
      ]
    },
    {
      title: 'Segments vs saved views',
      icon: 'fa-bookmark',
      summary: 'Saved views on the main Contacts page are personal shortcuts. Segments are named groups you reuse for marketing and ops workflows.',
      examples: [
        'Segment "At-risk WhatsApp" → rules + bulk tag + campaign',
        'Saved view "My Leads" → quick filter on Contacts list only'
      ]
    }
  ],
  scenarios: [
    {
      title: 'Build "WhatsApp VIP customers" (prefilled example)',
      steps: [
        'Name: WhatsApp VIP customers',
        'Rule 1: Platform is whatsapp',
        'Rule 2: Lifecycle is vip · Logic: AND',
        'Create segment → Refresh count → Send campaign or export'
      ]
    }
  ]
};

export const DUPLICATES_HELP = {
  title: 'How duplicate review works',
  subtitle: 'Find contacts with the same phone or email and merge them into one profile.',
  sections: [
    {
      title: 'Why duplicates happen',
      icon: 'fa-clone',
      summary: 'Duplicates appear after CSV imports, multi-channel messaging (same person on WhatsApp and Instagram), or typos creating a second record.',
      examples: [
        'Same phone +97150… imported twice',
        'Instagram DM and WhatsApp message from the same customer as two contacts'
      ]
    },
    {
      title: 'Scan now',
      icon: 'fa-magnifying-glass',
      summary: 'Runs a background scan of your org. Matches on phone (8+ digits) and email. Results appear as pairs with a match score.',
      examples: [
        'Phone match → typically 70–90% score',
        'Phone + email + similar name → higher score',
        'Scan is queued — refresh after a few seconds'
      ]
    },
    {
      title: 'Review actions',
      icon: 'fa-code-merge',
      summary: 'For each pair you decide whether they are the same person or not.',
      examples: [
        'Keep left / Keep right — merge into one contact; the other is archived',
        'Not a duplicate — dismiss the pair; both contacts stay separate',
        'Merge combines tags, channels, notes, orders, and conversation history'
      ]
    }
  ],
  scenarios: [
    {
      title: 'After a CSV import',
      steps: [
        'Click Scan now and wait for the queue to finish',
        'Review pairs sorted by match score',
        'Keep the record with the better name/phone · Dismiss false positives'
      ]
    }
  ]
};
