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
  deliveredCount?: number;
  ordersToday?: number;
  deltaVsYesterdayPct?: number;
  statusCounts?: Record<string, number>;
}

export interface IOpsShipping {
  name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}

export interface IOpsTracking {
  courier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export interface IOpsOrderDetail extends IOpsOrderRow {
  customer: IOpsCustomer;
  paymentMethod?: string | null;
  shippingAddress: string;
  shipping?: IOpsShipping | null;
  tracking?: IOpsTracking | null;
  cancellationReason?: string | null;
  returnReason?: string | null;
  refund?: { amount: string; reference: string | null; atLabel: string } | null;
  timeline: { event: string; at: string | null; atLabel: string; pending?: boolean }[];
  chatSnippet: { from: string; text: string }[];
  lineItems: { name: string; sku: string | null; image: string | null; qty: number; unitPrice: string; lineTotal: string }[];
  actions: { canMarkShipped: boolean; canUpdateStatus: boolean; nextStatuses: string[] };
}

/** Extra payload sent with a status transition. */
export interface IOrderStatusExtra {
  note?: string;
  reason?: string;
  paymentMethod?: string;
  paymentRef?: string;
  tracking?: IOpsTracking;
  refund?: { amount?: number | string; reference?: string };
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

export interface ICreateReviewPayload {
  platform: 'google' | 'facebook' | 'instagram' | 'website';
  customerName?: string;
  customerHandle?: string;
  rating?: number | null;
  reviewBody: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  /** Link this review back to the originating inbox chat interaction */
  sourceInteractionId?: string;
}

export interface ICreateOrderLineItem {
  productId: string;
  qty: number;
}

export interface ICreateOrderPayload {
  channel: 'whatsapp' | 'instagram' | 'voice' | 'manual';
  lineItems: ICreateOrderLineItem[];
  buyerName?: string;
  buyerPhone?: string;
  shippingAddress?: string;
  notes?: string;
  /** Link this order back to the originating inbox chat interaction */
  sourceInteraction?: string;
}

export interface ICreateComplaintPayload {
  issueSummary?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/** Lightweight ref returned by by-interaction lookup endpoints */
export interface ILinkedOrderRef {
  id: string;
  displayRef: string | null;
  status: string;
}

export interface ILinkedReviewRef {
  id: string;
  displayRef: string;
  sentiment: string | null;
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
