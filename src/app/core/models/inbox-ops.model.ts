export interface IOpsCustomer {
  name: string;
  handle: string;
  avatarUrl?: string | null;
}

export interface IOpsListResult<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IOpsOrderRow {
  id: string;
  displayRef: string;
  customerName: string;
  customerHandle: string;
  channel: string;
  channelLabel: string;
  itemsSummary: string;
  amountFormatted: string;
  paymentLabel: string;
  paymentTone: string;
  status: string;
  statusLabel: string;
  statusTone: string;
  createdAtLabel: string;
  sourceInteractionId?: string | null;
  chatDeepLink?: string | null;
}

export interface IOpsOrderStats {
  totalOrders: number;
  revenueClosed: number;
  pendingPayment: number;
  shippedToday: number;
  ordersToday?: number;
  deltaVsYesterdayPct?: number;
}

export interface IOpsOrderDetail extends IOpsOrderRow {
  customer: IOpsCustomer;
  shippingAddress: string;
  tracking: string;
  timeline: { event: string; at: string | null; atLabel: string; pending?: boolean }[];
  chatSnippet: { from: string; text: string }[];
  lineItems: { name: string; qty: number; unitPrice: string }[];
  actions: { canMarkShipped: boolean; canUpdateStatus: boolean; nextStatuses: string[] };
}

export interface IOpsComplaintRow {
  id: string;
  interactionId: string;
  displayRef: string;
  customerName: string;
  customerHandle: string;
  channel: string;
  channelLabel: string;
  issueSummary: string;
  priority: string;
  status: string;
  statusLabel: string;
  acknowledgedLabel: string;
  acknowledgedTone: string;
  assignedToName: string;
  createdAtLabel: string;
  chatDeepLink?: string | null;
}

export interface IOpsComplaintStats {
  open: number;
  acknowledged: number;
  resolvedThisMonth: number;
  highPriorityOpen: number;
  avgResolutionHours: number;
}

export interface IOpsComplaintDetail extends IOpsComplaintRow {
  customer: IOpsCustomer;
  priorityBanner?: string | null;
  resolutionNote?: string | null;
  linkedOrderRef?: string | null;
  timeline: { event: string; at?: string; atLabel: string; note?: string }[];
  chatSnippet: { from: string; text: string }[];
  actions: {
    canAcknowledge: boolean;
    canAssign: boolean;
    canResolve: boolean;
    canClose: boolean;
  };
}

export interface IOpsReviewRow {
  id: string;
  interactionId: string;
  displayRef: string;
  customerName: string;
  customerHandle: string;
  platform: string;
  platformLabel: string;
  rating: number | null;
  snippet: string;
  requestSentLabel: string;
  collectionStatus: string;
  collectionStatusLabel: string;
  replyStatus: string;
  replyStatusLabel: string;
  replyStatusTone: string;
  createdAtLabel: string;
  chatDeepLink?: string | null;
}

export interface IOpsReviewStats {
  avgRating: number;
  reviewsThisMonth: number;
  repliesSent: number;
  flaggedCount: number;
}

export interface IOpsReviewDetail extends IOpsReviewRow {
  customer: IOpsCustomer;
  reviewBody: string;
  aiDraft?: string | null;
  aiDraftConfidence?: number | null;
  actions: {
    canSuggestReply: boolean;
    canPublishReply: boolean;
    canEditReply: boolean;
  };
}

export interface IOpsTableColumn {
  key: string;
  label: string;
  cellClass?: string;
}

export interface IOpsFilterTab {
  value: string;
  label: string;
}

export interface IOpsStatCard {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'lime' | 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}
