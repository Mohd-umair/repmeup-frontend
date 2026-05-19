export interface IProduct {
  _id: string;
  organization: string;
  name: string;
  sku?: string;
  description?: string;
  price: number;
  currency: string;
  discountPercent: number;
  images: string[];
  paymentUrl?: string;
  sizes: string[];
  colors: string[];
  stock?: number | null;
  instagramPostIds: string[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Per-product DM configuration — overrides org-level salesFlowSettings when present */
  dmConfig?: IProductDmConfig;
  /** WhatsApp Commerce Catalog sync state */
  whatsapp?: IProductWhatsAppCatalog;
}

export type WhatsAppSyncStatus = 'synced' | 'pending' | 'failed' | 'not_synced';

export interface IProductWhatsAppCatalog {
  catalogItemId?: string;
  syncStatus?: WhatsAppSyncStatus;
  syncedAt?: string;
  syncError?: string;
}

export interface IWhatsAppCatalogSettings {
  connected: boolean;
  catalogId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  isCatalogVisible?: boolean;
  isCartEnabled?: boolean;
  syncedCount?: number;
  failedCount?: number;
  notSyncedCount?: number;
}

export interface IWhatsAppSyncAllResult {
  synced: number;
  failed: number;
  total: number;
}

export interface IWhatsAppCsvImportResult {
  created: number;
  updated: number;
  failed: Array<{ row: number; error: string }>;
  totalRows: number;
  sync?: { synced: number; failed: number } | null;
}

/** Per-product DM configuration. Every field is optional; omitted fields inherit
 *  from the org-level salesFlowSettings (global defaults). */
export interface IProductDmConfig {
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaImageUrl?: string;
  /** Overrides org ctaButtons entirely when provided (all-or-nothing) */
  ctaButtons?: ISalesFlowCtaButton[];
  /** Overrides org triggerKeywords for this product */
  triggerKeywords?: string[];
  /** Override the public-comment reply stub */
  publicReplyTemplate?: string;
  /** Override org hesitancyKeywords for WhatsApp-capture flow */
  hesitancyKeywords?: string[];
  /** Override WhatsApp-capture request message */
  whatsappCaptureMessage?: string;
  /** Override WhatsApp-capture confirmation message */
  whatsappCaptureConfirmation?: string;
}

export interface ICommentToDmSettings {
  enabled: boolean;
  triggerKeywords: string[];
  publicReplyTemplate: string;
  /** @deprecated Legacy plain-text template — no longer sent. CTA buttons in
   *  salesFlowSettings.ctaButtons replace this. Kept here so existing API
   *  responses still type-check. */
  dmTemplate?: string;
  confirmationTemplate: string;
  deduplicateDms: boolean;
  maxDmsPerDay: number;
  defaultProductId?: string | null;
}

/** Instagram: top-level comment → private DM with Follow (generic template). */
export interface ICommentFollowInviteSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonTitle: string;
  /** Empty = use https://www.instagram.com/{connected handle}/ on send */
  buttonUrl: string;
  publicReplyTemplate: string;
  postPublicReply: boolean;
  deduplicateDms: boolean;
  maxDmsPerDay: number;
  skipIfProductDmSent: boolean;
  filterNegativeSentiment: boolean;
  filterSalesIntent: boolean;
  dmsSentToday?: number;
  dmsSentResetDate?: string;
}

export type SalesFlowCtaButtonType = 'postback' | 'web_url';

export interface ISalesFlowCtaButton {
  label: string;
  /** Defaults to 'postback' if omitted */
  type?: SalesFlowCtaButtonType;
  /** Required when type === 'postback'. Recognized: 'details' | 'payment' | 'hesitant' */
  payload?: string;
  /** Required when type === 'web_url'. Must be https:// */
  url?: string;
}

export interface ISalesFlowSettings {
  enabled: boolean;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaImageUrl: string;
  /** Dynamic array of CTA buttons (max 3 per Instagram Generic Template limit) */
  ctaButtons: ISalesFlowCtaButton[];
  hesitancyKeywords: string[];
  whatsappCaptureMessage: string;
  whatsappCaptureConfirmation: string;
}

export interface IInstagramMediaItem {
  id: string;
  shortcode: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  caption: string;
  timestamp: string;
}

export interface IProductOrder {
  _id: string;
  organization: string;
  product: string | IProduct;
  instagramUserId: string;
  instagramPostId?: string;
  orderToken?: string;
  status: 'dm_sent' | 'payment_initiated' | 'paid' | 'cancelled';
  paymentRef?: string;
  paidAt?: string;
  createdAt: string;
}
