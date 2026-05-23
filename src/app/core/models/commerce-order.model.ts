import { IProduct } from './product.model';

export type CommerceChannel = 'instagram' | 'whatsapp' | 'voice' | 'manual';

export type CommerceOrderStatus =
  | 'intent'
  | 'product_sent'
  | 'cart_started'
  | 'payment_pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ICommerceLineItem {
  product?: IProduct | string;
  retailerId?: string;
  name?: string;
  qty: number;
  unitPrice?: number;
  currency?: string;
}

export interface ICommerceOrderContact {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ICommerceOrder {
  _id: string;
  organization: string;
  channel: CommerceChannel;
  status: CommerceOrderStatus;
  lineItems: ICommerceLineItem[];
  contact?: ICommerceOrderContact | string;
  sourceInteraction?: string;
  sourcePostId?: string;
  whatsappMessageId?: string;
  metaOrderId?: string;
  instagramUserId?: string;
  orderToken?: string;
  paymentRef?: string;
  totalAmount?: number;
  currency?: string;
  buyerName?: string;
  buyerPhone?: string;
  shippingAddress?: string;
  notes?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICommerceOrderStats {
  byStatus: Partial<Record<CommerceOrderStatus, number>>;
  byChannel: Partial<Record<CommerceChannel, number>>;
  totalRevenue: number;
  totalOrders: number;
}

export const ORDER_STATUS_LABELS: Record<CommerceOrderStatus, string> = {
  intent: 'Intent',
  product_sent: 'Product Sent',
  cart_started: 'Cart Started',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

export const ORDER_STATUS_COLORS: Record<CommerceOrderStatus, string> = {
  intent: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  product_sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cart_started: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  payment_pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  shipped: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};

export const CHANNEL_LABELS: Record<CommerceChannel, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  voice: 'Voice',
  manual: 'Manual'
};
