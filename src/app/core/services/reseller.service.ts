import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface ResellerSubOrg {
  _id: string;
  name: string;
  slug?: string;
  isActive: boolean;
  isReseller?: boolean;
  resellerLevel?: number;
  userCount?: number;
  createdAt?: string;
  subscription?: {
    planId?: string;
    planName?: string;
    tier?: number;
    status?: string;
  } | null;
}

export interface ResellerDashboard {
  capabilities: {
    maxSubOrgs: number;
    allowSubResellers: boolean;
    maxDepth: number;
    commissionPercent: number;
    defaultSubOrgPlanId: string;
  };
  counts: {
    directSubOrgs: number;
    totalDescendants: number;
    activeSubOrgs: number;
    suspendedSubOrgs: number;
    remainingSlots: number | null;
  };
  commission: {
    pendingInr: number;
    paidInr: number;
  };
}

export interface CreateSubOrgPayload {
  name: string;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  planId?: string;
  isSubReseller?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ResellerService {
  constructor(private api: ApiService) {}

  getDashboard(): Observable<IApiResponse<ResellerDashboard>> {
    return this.api.get<IApiResponse<ResellerDashboard>>('/reseller/dashboard');
  }

  listSubOrgs(params?: { depth?: 'direct' | 'all'; status?: string; page?: number; limit?: number }) {
    return this.api.get<IApiResponse<{ items: ResellerSubOrg[]; pagination: any }>>('/reseller/sub-orgs', params);
  }

  createSubOrg(body: CreateSubOrgPayload) {
    return this.api.post<IApiResponse<any>>('/reseller/sub-orgs', body);
  }

  getSubOrg(id: string) {
    return this.api.get<IApiResponse<any>>(`/reseller/sub-orgs/${id}`);
  }

  updateSubOrg(id: string, body: { name?: string }) {
    return this.api.put<IApiResponse<any>>(`/reseller/sub-orgs/${id}`, body);
  }

  assignPlan(id: string, planId: string) {
    return this.api.post<IApiResponse<any>>(`/reseller/sub-orgs/${id}/assign-plan`, { planId });
  }

  suspendSubOrg(id: string) {
    return this.api.post<IApiResponse<any>>(`/reseller/sub-orgs/${id}/suspend`, {});
  }

  activateSubOrg(id: string) {
    return this.api.post<IApiResponse<any>>(`/reseller/sub-orgs/${id}/activate`, {});
  }

  getAnalytics() {
    return this.api.get<IApiResponse<any>>('/reseller/analytics');
  }

  getBilling() {
    return this.api.get<IApiResponse<any>>('/reseller/billing');
  }
}
