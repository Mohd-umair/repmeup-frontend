export interface IProduct {
  _id: string;
  organization: string;
  name: string;
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
}

export interface ICommentToDmSettings {
  enabled: boolean;
  triggerKeywords: string[];
  publicReplyTemplate: string;
  dmTemplate: string;
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
