export type VoiceAgentIndustry =
  | 'real_estate'
  | 'clinic'
  | 'restaurant'
  | 'education'
  | 'ecommerce'
  | 'finance'
  | 'custom';

export type VoiceToolAction =
  | 'create_contact'
  | 'log_call_interaction'
  | 'send_whatsapp_followup'
  | 'lookup_appointment'
  | 'book_appointment'
  | 'check_product_availability'
  | 'transfer_to_human'
  | 'custom_webhook';

export interface IVoiceAgentTool {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  action: VoiceToolAction;
  webhookUrl?: string;
  enabled?: boolean;
}

export interface IVoiceAgentWorkflow {
  sendWhatsappFollowUp?: boolean;
  whatsappTemplateId?: string | null;
  createContact?: boolean;
  createInboxInteraction?: boolean;
  humanHandoffKeywords?: string[];
  maxCallDurationSeconds?: number;
}

export interface IVoiceAgent {
  _id?: string;
  organization?: string;
  name: string;
  industry: VoiceAgentIndustry;
  systemPrompt: string;
  greetingMessage: string;
  language: string;
  voiceId: string;
  tools: IVoiceAgentTool[];
  workflow: IVoiceAgentWorkflow;
  isActive: boolean;
  linkedPhoneNumbers?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IVoiceAgentTemplate {
  id: string;
  industry: VoiceAgentIndustry;
  name: string;
  description: string;
  icon: string;
  greetingMessage: string;
  systemPrompt: string;
  tools: VoiceToolAction[];
  workflow: IVoiceAgentWorkflow;
}

export interface IPhoneNumber {
  _id: string;
  organization: string;
  twilioSid: string;
  number: string;
  friendlyName: string;
  assignedAgent?: { _id: string; name: string; industry: VoiceAgentIndustry } | string | null;
  capabilities: { voice: boolean; sms: boolean };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IAvailableTwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  isoCountry?: string;
  /** Present when API returns inventory type (local | mobile | tollFree) */
  numberType?: 'local' | 'national' | 'mobile' | 'tollFree';
  capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
}

export interface ICallSessionTranscriptTurn {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  languageDetected?: string | null;
}

export interface ICallSession {
  _id: string;
  organization: string;
  agent?: { _id: string; name: string; industry: VoiceAgentIndustry } | string | null;
  phoneNumber?: { _id: string; number: string } | string | null;
  twilioCallSid: string;
  direction: 'inbound' | 'outbound';
  callerNumber: string;
  calledNumber: string;
  status:
    | 'queued'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'no-answer'
    | 'busy'
    | 'canceled';
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number;
  transcript?: ICallSessionTranscriptTurn[];
  summary?: string;
  intent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | '';
  toolCallsUsed?: string[];
  followUpSent?: boolean;
  humanHandoffTriggered?: boolean;
  linkedContact?: { _id: string; primaryName?: string; primaryPhone?: string; primaryEmail?: string } | null;
  linkedInteraction?: { _id: string; chatRef?: string } | null;
  recordingUrl?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface IVoiceCredentialSummary {
  _id?: string;
  /** RepMeUp-provisioned subaccount vs customer-supplied telephony */
  telephonyMode?: 'byow' | 'managed';
  managedTelephonyReady?: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  publicBaseUrl: string;
  isActive: boolean;
  /** Server has platform voice AI keys configured */
  voiceAiEnabled?: boolean;
  updatedAt?: string;
}

export interface IVoiceCredentialPayload {
  telephonyMode?: 'byow' | 'managed';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  publicBaseUrl?: string;
  isActive?: boolean;
}

export interface IVoiceAnalyticsSummary {
  today: {
    totalCalls: number;
    answeredCalls: number;
    avgDurationSeconds: number;
    humanHandoffs: number;
  };
  last7Days: {
    totalCalls: number;
    answerRatePct: number;
    avgDurationSeconds: number;
    humanHandoffs: number;
    followUpsSent: number;
  };
  activeCalls: number;
  topIntents: Array<{ intent: string; count: number }>;
  topSentiments: Array<{ sentiment: string; count: number }>;
}

export interface IVoiceAnalyticsTrendRow {
  _id: string;
  organization: string;
  date: string;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  avgDurationSeconds: number;
  humanHandoffs: number;
  followUpsSent: number;
  byIntent?: Array<{ intent: string; count: number }>;
  bySentiment?: Array<{ sentiment: string; count: number }>;
}

export interface IPagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ICallsListFilter {
  agentId?: string;
  status?: ICallSession['status'];
  direction?: 'inbound' | 'outbound';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface IOutboundCallPayload {
  to: string;
  fromNumberId: string;
  agentId: string;
}

export interface ISearchNumbersPayload {
  country?: string;
  areaCode?: string;
  contains?: string;
  limit?: number;
}
