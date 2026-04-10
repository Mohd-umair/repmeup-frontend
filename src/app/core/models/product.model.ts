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
