export type ProductCondition = 'new' | 'refurbished' | 'used';
export type ProductAvailability = 'in stock' | 'out of stock';
export type ProductGender = 'female' | 'male' | 'unisex';
export type ProductAgeGroup = 'adult' | 'all ages' | 'teen' | 'kids' | 'toddler' | 'infant' | 'newborn';
export type WaComplianceCategory = 'COUNTRY_ORIGIN_EXEMPT' | 'DEFAULT';
export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';

export const PRODUCT_CONDITIONS: ProductCondition[] = ['new', 'refurbished', 'used'];
export const PRODUCT_GENDERS: ProductGender[] = ['female', 'male', 'unisex'];
export const PRODUCT_AGE_GROUPS: ProductAgeGroup[] = ['adult', 'all ages', 'teen', 'kids', 'toddler', 'infant', 'newborn'];
export const WEIGHT_UNITS: WeightUnit[] = ['kg', 'g', 'lb', 'oz'];

export interface IProductImporterAddress {
  street1?: string;
  street2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Meta/WhatsApp Commerce catalog attributes (all optional).
 * Mirrors backend Product.commerce — see backend utils/productCommerceFields.js.
 */
export interface IProductCommerce {
  brand?: string;
  condition?: ProductCondition;
  /** Explicit override; unset = derived from stock on the backend */
  availability?: ProductAvailability;
  gtin?: string;
  mpn?: string;
  googleProductCategory?: string;
  fbProductCategory?: string;
  productType?: string;
  itemGroupId?: string;
  color?: string;
  size?: string;
  gender?: ProductGender;
  ageGroup?: ProductAgeGroup;
  material?: string;
  pattern?: string;
  originCountry?: string;
  importerName?: string;
  importerAddress?: IProductImporterAddress;
  manufacturerInfo?: string;
  waComplianceCategory?: WaComplianceCategory;
  salePriceStart?: string | null;
  salePriceEnd?: string | null;
  unitPrice?: { value: number; currency: string; unit: string };
  shippingWeight?: { value: number; unit: WeightUnit };
  videoUrls?: string[];
}

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
  /** Product page URL — sent to Meta as the catalog item link */
  websiteUrl?: string;
  /** Meta/WhatsApp commerce attributes */
  commerce?: IProductCommerce;
  sizes: string[];
  colors: string[];
  stock?: number | null;
  instagramPostIds: string[];
  /** Instagram story media IDs for Story-to-DM automation */
  instagramStoryIds?: string[];
  /** Per-post carousel slide / sort metadata (multi-product posts). */
  instagramPostLinks?: IInstagramPostLink[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Per-product DM configuration — overrides org-level salesFlowSettings when present */
  dmConfig?: IProductDmConfig;
  /** WhatsApp Commerce Catalog sync state */
  whatsapp?: IProductWhatsAppCatalog;
  /** Origin of the product — manual entry or platform sync */
  source?: 'manual' | 'shopify' | 'woocommerce' | 'custom_url';
  /** Shopify sync metadata */
  shopify?: { productId?: string; variantId?: string; syncedAt?: string };
}

export type WhatsAppSyncStatus = 'synced' | 'pending' | 'failed' | 'not_synced';

export interface IProductWhatsAppCatalog {
  catalogItemId?: string;
  syncStatus?: WhatsAppSyncStatus;
  syncedAt?: string;
  syncError?: string;
}

/** Returned on product create/update when WhatsApp auto-sync runs. */
export interface IProductWhatsAppSyncResult {
  attempted: boolean;
  synced: boolean;
  error?: string;
  skippedReason?: 'no_whatsapp_connection' | 'no_catalog_id';
}

export type WhatsAppCatalogLinkStatus =
  | 'linked'
  | 'saved'
  | 'mismatch'
  | 'not_linked'
  | 'meta_only';

export interface IWhatsAppCatalogSettings {
  connected: boolean;
  catalogId?: string | null;
  /** Catalog ID Meta reports on whatsapp_commerce_settings (source of truth) */
  metaCatalogId?: string | null;
  catalogLinkStatus?: WhatsAppCatalogLinkStatus;
  catalogLinkVerified?: boolean;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  isCatalogVisible?: boolean;
  isCartEnabled?: boolean;
  syncedCount?: number;
  failedCount?: number;
  notSyncedCount?: number;
}

export interface IWhatsAppCatalogSettingsUpdateResult {
  catalogId: string;
  metaCatalogId?: string;
  catalogLinkStatus?: WhatsAppCatalogLinkStatus;
  catalogLinkVerified?: boolean;
  isCatalogVisible?: boolean;
  isCartEnabled?: boolean;
  metaSynced: boolean;
}

export interface IWhatsAppSyncAllResult {
  synced: number;
  failed: number;
  total: number;
  /** First few per-product errors from bulk sync (when failed > 0). */
  errors?: Array<{ productId: string; productName?: string; error: string }>;
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

/** Instagram: story reply / @mention → automated product DM */
export interface IStoryToDmSettings {
  enabled: boolean;
  triggerOnReply: boolean;
  triggerOnMention: boolean;
  triggerKeywords: string[];
  defaultProductId?: string | null;
  deduplicateDms: boolean;
  maxDmsPerDay: number;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeImageUrl: string;
  dmsSentToday?: number;
  dmsSentResetDate?: string;
}

export interface IInstagramPostLink {
  postId: string;
  slideIndex?: number | null;
  sortOrder?: number | null;
}

export interface IInstagramCarouselSlide {
  id: string;
  slideIndex: number;
  mediaType: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
}

export interface IInstagramMediaItem {
  id: string;
  shortcode: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORIES';
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
