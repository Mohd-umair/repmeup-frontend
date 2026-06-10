import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface IResellerClient {
  organizationId: string;
  name: string;
  prospect: { name?: string; email?: string; company?: string; phone?: string } | null;
  planId: string | null;
  planName: string | null;
  status: string | null;
  demoStatus: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  aiCreditsCap: number | null;
  brandedLogo: string | null;
  createdAt: string;
}

export interface IResellerClientPage {
  items: IResellerClient[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ICreatedResellerClient {
  organizationId: string;
  organizationName: string;
  loginEmail: string;
  provisionalPassword: string;
  magicLink: string;
  trialEndsAt: string;
  planId: string;
  planName: string;
}

export interface IResellerBranding {
  applyToChildren?: boolean;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
}

// ── Billing (Phase 3, reporting-only; all amounts in INR paise) ──────────────
export interface IPriceBookRow {
  planId: string;
  planName: string;
  tier: number;
  platformCostInr: number;
  clientPriceInr: number | null;
}

export interface IBillingDashboard {
  summary: {
    clientCount: number;
    totalBillableInr: number;
    totalPlatformCostInr: number;
    totalMarginInr: number;
    marginPercent: number;
    totalRealizedSpendInr: number;
    currency: string;
  };
  clients: Array<{
    organizationId: string;
    name: string;
    clientEmail: string | null;
    planId: string | null;
    planName: string | null;
    status: string | null;
    platformCostInr: number;
    resellerPriceInr: number;
    marginInr: number;
    realizedSpendInr: number;
  }>;
}

/** API client for the reseller control plane (/api/reseller/*). */
@Injectable({ providedIn: 'root' })
export class ResellerService {
  constructor(private api: ApiService) {}

  listClients(params?: { page?: number; limit?: number }): Observable<IApiResponse<IResellerClientPage>> {
    return this.api.get<IApiResponse<IResellerClientPage>>('/reseller/clients', params);
  }

  createClient(body: {
    prospect: { name?: string; email: string; company?: string; phone?: string };
    planId?: string;
    trialDays?: number;
    aiCreditsCap?: number | null;
  }): Observable<IApiResponse<ICreatedResellerClient>> {
    return this.api.post<IApiResponse<ICreatedResellerClient>>('/reseller/clients', body);
  }

  updateClient(organizationId: string, body: { planId?: string; aiCreditsCap?: number | '' | null }):
    Observable<IApiResponse<{ organizationId: string; planId: string | null }>> {
    return this.api.patch<IApiResponse<{ organizationId: string; planId: string | null }>>(
      `/reseller/clients/${organizationId}`, body
    );
  }

  getBranding(): Observable<IApiResponse<IResellerBranding>> {
    return this.api.get<IApiResponse<IResellerBranding>>('/reseller/branding');
  }

  updateBranding(body: IResellerBranding & { applyToExisting?: boolean }): Observable<IApiResponse<IResellerBranding>> {
    return this.api.put<IApiResponse<IResellerBranding>>('/reseller/branding', body);
  }

  // ── Billing ────────────────────────────────────────────────────────────────
  getBillingDashboard(): Observable<IApiResponse<IBillingDashboard>> {
    return this.api.get<IApiResponse<IBillingDashboard>>('/reseller/billing/dashboard');
  }

  getPriceBook(): Observable<IApiResponse<IPriceBookRow[]>> {
    return this.api.get<IApiResponse<IPriceBookRow[]>>('/reseller/billing/price-book');
  }

  setPriceBook(entries: Array<{ planId: string; clientPriceInr: number }>): Observable<IApiResponse<unknown>> {
    return this.api.put<IApiResponse<unknown>>('/reseller/billing/price-book', { entries });
  }
}
