import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ICredentialSchemaField {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
}

export interface IProviderCapabilities {
  hostedCheckout: boolean;
  paymentLinks: boolean;
  webhooks: boolean;
  refunds: boolean;
  partialRefunds: boolean;
  statusPolling: boolean;
}

export interface IProviderCard {
  provider: string;
  capabilities: IProviderCapabilities;
  credentialSchema: ICredentialSchemaField[];
  connected: boolean;
}

export interface IPaymentIntegration {
  _id: string;
  provider: string;
  environment: 'test' | 'live';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  displayName?: string;
  safeMerchantIdentifier?: string;
  isDefault: boolean;
  capabilities: IProviderCapabilities;
  connectedAt?: string;
  lastHealthCheckAt?: string;
  lastHealthCheckStatus?: 'ok' | 'error' | null;
  lastErrorMessage?: string;
  lastWebhookReceivedAt?: string;
  webhookFailureCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IListGatewaysResponse {
  success: boolean;
  providers: IProviderCard[];
  integrations: IPaymentIntegration[];
}

export interface IConnectGatewayPayload {
  provider: string;
  environment: 'test' | 'live';
  credentials: Record<string, string>;
  displayName?: string;
}

export interface IConnectGatewayResponse {
  success: boolean;
  integration: IPaymentIntegration;
  webhookUrl: string;
}

export interface IPayment {
  _id: string;
  organization: string;
  contact?: string;
  order: string;
  integration: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  paymentUrl?: string;
  shortUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  failedAt?: string;
  refundedAmount?: number;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreatePaymentPayload {
  orderId: string;
  amount: number;
  currency?: string;
  provider?: string;
  integrationId?: string;
  contactId?: string;
  interactionId?: string;
  channel?: string;
  description?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentGatewayService {

  constructor(private api: ApiService) {}

  // ── Gateway Management ────────────────────────────────────────────────────

  listGateways(): Observable<IListGatewaysResponse> {
    return this.api.get<IListGatewaysResponse>('/payment-gateways');
  }

  getGateway(id: string): Observable<{ success: boolean; integration: IPaymentIntegration }> {
    return this.api.get(`/payment-gateways/${id}`);
  }

  connectGateway(payload: IConnectGatewayPayload): Observable<IConnectGatewayResponse> {
    return this.api.post<IConnectGatewayResponse>('/payment-gateways', payload);
  }

  updateGateway(id: string, credentials: Record<string, string>, displayName?: string): Observable<any> {
    return this.api.patch(`/payment-gateways/${id}`, { credentials, displayName });
  }

  setDefault(id: string): Observable<any> {
    return this.api.post(`/payment-gateways/${id}/default`, {});
  }

  healthCheck(id: string): Observable<{ success: boolean; healthy: boolean; error: string | null }> {
    return this.api.post(`/payment-gateways/${id}/health`, {});
  }

  disconnect(id: string): Observable<{ success: boolean }> {
    return this.api.delete(`/payment-gateways/${id}`);
  }

  // ── Payment Requests ──────────────────────────────────────────────────────

  createPayment(payload: ICreatePaymentPayload): Observable<{ success: boolean; payment: IPayment; created: boolean }> {
    return this.api.post('/payments', payload);
  }

  listPayments(filters?: any): Observable<{ success: boolean; payments: IPayment[]; total: number }> {
    return this.api.get('/payments', filters);
  }

  getPayment(id: string): Observable<{ success: boolean; payment: IPayment }> {
    return this.api.get(`/payments/${id}`);
  }

  cancelPayment(id: string, reason?: string): Observable<any> {
    return this.api.post(`/payments/${id}/cancel`, { reason });
  }

  reconcilePayment(id: string): Observable<any> {
    return this.api.post(`/payments/${id}/reconcile`, {});
  }

  refundPayment(id: string, amount: number, reason?: string, notes?: string): Observable<any> {
    return this.api.post(`/payments/${id}/refund`, { amount, reason, notes });
  }

  getPaymentAttempts(id: string): Observable<any> {
    return this.api.get(`/payments/${id}/attempts`);
  }

  getPaymentRefunds(id: string): Observable<any> {
    return this.api.get(`/payments/${id}/refunds`);
  }

  getPaymentEvents(id: string): Observable<any> {
    return this.api.get(`/payments/${id}/events`);
  }

  // ── Payment Analytics ─────────────────────────────────────────────────────

  getAnalyticsSummary(filters?: Record<string, string>): Observable<any> {
    return this.api.get('/payment-analytics/summary', filters);
  }

  getAnalyticsTimeSeries(filters?: Record<string, string>): Observable<any> {
    return this.api.get('/payment-analytics/time-series', filters);
  }

  getAnalyticsByProvider(filters?: Record<string, string>): Observable<any> {
    return this.api.get('/payment-analytics/by-provider', filters);
  }

  getAnalyticsByChannel(filters?: Record<string, string>): Observable<any> {
    return this.api.get('/payment-analytics/by-channel', filters);
  }

  getAnalyticsHealth(): Observable<any> {
    return this.api.get('/payment-analytics/health');
  }

  getAnalyticsByAgent(filters?: Record<string, string>): Observable<any> {
    return this.api.get('/payment-analytics/by-agent', filters);
  }
}
