export interface IContactChannel {
  platform: string;
  platformUserId: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
  addedAt?: Date;
}

export interface IContactAIInsights {
  intent?: string | null;
  sentiment?: string | null;
  priority?: string | null;
  updatedAt?: Date | null;
}

export interface IContactIntelligence {
  healthScore?: number | null;
  healthBand?: 'healthy' | 'needs_attention' | 'at_risk' | null;
  leadScore?: number | null;
  churnRisk?: 'low' | 'medium' | 'high' | null;
  engagementScore?: number | null;
  aiSummary?: string | null;
  aiConfidence?: number | null;
  computedAt?: Date | null;
}

export interface ICommerceMetrics {
  totalOrders?: number;
  totalSpent?: number;
  avgOrderValue?: number;
  lastOrderAt?: Date | null;
}

export interface ICommunicationPreferences {
  whatsapp?: boolean;
  sms?: boolean;
  email?: boolean;
  instagram?: boolean;
  facebook?: boolean;
  marketingConsent?: boolean;
  doNotContact?: boolean;
}

export interface INextBestAction {
  action?: string | null;
  reason?: string | null;
  computedAt?: Date | null;
}

export type ContactLifecycle =
  | 'lead' | 'engaged' | 'qualified' | 'customer'
  | 'repeat_customer' | 'vip' | 'at_risk' | 'churned';

export interface IFilterCondition {
  field?: string;
  operator?: string;
  value?: unknown;
  logic?: 'AND' | 'OR';
  conditions?: IFilterCondition[];
}

export interface IFilterQuery {
  logic: 'AND' | 'OR';
  conditions: IFilterCondition[];
}

export interface IContact {
  _id: string;
  organization: string;
  primaryName: string;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  company?: string | null;
  channels: IContactChannel[];
  tags?: string[];
  notes?: string | null;
  aiInsights?: IContactAIInsights;
  intelligence?: IContactIntelligence;
  commerceMetrics?: ICommerceMetrics;
  communicationPreferences?: ICommunicationPreferences;
  nextBestAction?: INextBestAction;
  lifecycleStage?: ContactLifecycle;
  owner?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  lastInteractionAt?: Date | null;
  lastActivityChannel?: string | null;
  lastActivityType?: string | null;
  customFields?: Record<string, unknown>;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  interactions?: IContactInteractionPreview[];
}

export interface IContactInteractionPreview {
  _id: string;
  platform: string;
  type: string;
  content: string;
  status: string;
  platformCreatedAt: Date;
  respondedAt?: Date;
  chatRef?: string;
  chatNumber?: number;
}

export interface IContactListParams {
  search?: string;
  platform?: string;
  tag?: string;
  lifecycleStage?: string;
  owner?: string;
  page?: number;
  limit?: number;
  sortField?: string;
  sortDir?: string;
  filterQuery?: IFilterQuery;
}

export interface IContactFilterPreset {
  _id: string;
  kind: 'saved_view' | 'segment';
  name: string;
  description?: string;
  filterQuery: IFilterQuery;
  memberCountCached?: number;
  isSystem?: boolean;
}

export interface ICustomFieldDefinition {
  _id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'boolean' | 'currency';
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface IAudienceSnapshot {
  _id: string;
  sourceType: string;
  totalMatched: number;
  filterQuery?: IFilterQuery;
  channelEligibility?: Record<string, { eligible: number; ineligible: number }>;
  materializationStatus?: string;
}

export interface ICampaignStats {
  matched?: number;
  eligible?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  failed?: number;
  pending?: number;
  positive?: number;
  negative?: number;
  revenue?: number;
  attributedOrders?: number;
  intents?: Record<string, number>;
}

export interface IActivationCampaign {
  _id: string;
  name: string;
  channel: 'whatsapp' | 'instagram' | 'facebook';
  status: string;
  audienceSnapshot?: string | { _id: string };
  content?: Record<string, unknown>;
  connection?: string | null;
  schedule?: { sendAt?: string | null; timezone?: string };
  stats?: ICampaignStats;
  parentCampaignId?: string | null;
  followUpCondition?: string | null;
}
