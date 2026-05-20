import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { WhatsAppTemplate } from '../models/whatsapp-template.model';

// ── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ICampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export interface ICampaignConnection {
  _id: string;
  platformDisplayName?: string;
  platformData?: {
    displayPhoneNumber?: string;
    phoneNumberId?: string;
  };
}

export interface ICampaign {
  _id: string;
  organization: string;
  connection: ICampaignConnection | string;
  name: string;
  templateRef?: WhatsAppTemplate | string;
  templateSnapshot?: {
    name: string;
    languageCode: string;
    components: unknown[];
  };
  status: CampaignStatus;
  scheduledAt?: string | null;
  startedAt?: string;
  finishedAt?: string;
  stats: ICampaignStats;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICampaignRecipient {
  _id: string;
  campaign: string;
  phone: string;
  recipientName?: string;
  status: 'pending' | 'sent' | 'failed';
  messageId?: string;
  errorMessage?: string;
  sentAt?: string;
}

export interface ICampaignListResponse {
  success: boolean;
  campaigns: ICampaign[];
  total: number;
  page: number;
  limit: number;
}

export interface ICampaignRecipientsResponse {
  success: boolean;
  recipients: ICampaignRecipient[];
  total: number;
  page: number;
  limit: number;
}

export interface IAddRecipientsResponse {
  success: boolean;
  inserted: number;
  duplicates: number;
  skipped: number;
  total: number;
}

/** Backend returns `{ success, campaign }` (not `data`) for single-campaign mutations */
export interface ICampaignSingleResponse {
  success: boolean;
  campaign?: ICampaign;
  error?: string;
}

export interface ICampaignDeleteResponse {
  success: boolean;
  deleted?: boolean;
  error?: string;
}

export interface ICampaignClearRecipientsResponse {
  success: boolean;
  cleared?: boolean;
  error?: string;
}

export interface ICampaignStatsResponse {
  success: boolean;
  stats?: ICampaignStats;
  error?: string;
}

export interface ICampaignTestMessageResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CampaignService {
  constructor(private api: ApiService) {}

  listCampaigns(params?: { page?: number; limit?: number; status?: string }): Observable<ICampaignListResponse> {
    return this.api.get<ICampaignListResponse>('/campaigns', params);
  }

  createCampaign(data: { name: string; connectionId: string; templateRefId?: string }): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>('/campaigns', data);
  }

  getCampaign(id: string): Observable<ICampaignSingleResponse> {
    return this.api.get<ICampaignSingleResponse>(`/campaigns/${id}`);
  }

  updateCampaign(id: string, data: Partial<ICampaign>): Observable<ICampaignSingleResponse> {
    return this.api.put<ICampaignSingleResponse>(`/campaigns/${id}`, data);
  }

  deleteCampaign(id: string): Observable<ICampaignDeleteResponse> {
    return this.api.delete<ICampaignDeleteResponse>(`/campaigns/${id}`);
  }

  addRecipients(id: string, rawText: string): Observable<IAddRecipientsResponse> {
    return this.api.post<IAddRecipientsResponse>(`/campaigns/${id}/recipients`, { rawText });
  }

  clearRecipients(id: string): Observable<ICampaignClearRecipientsResponse> {
    return this.api.delete<ICampaignClearRecipientsResponse>(`/campaigns/${id}/recipients`);
  }

  getRecipients(id: string, params?: { page?: number; limit?: number; status?: string }): Observable<ICampaignRecipientsResponse> {
    return this.api.get<ICampaignRecipientsResponse>(`/campaigns/${id}/recipients`, params);
  }

  launchCampaign(id: string, templateComponents: unknown[] = []): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>(`/campaigns/${id}/launch`, { templateComponents });
  }

  pauseCampaign(id: string): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>(`/campaigns/${id}/pause`, {});
  }

  resumeCampaign(id: string): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>(`/campaigns/${id}/resume`, {});
  }

  cancelCampaign(id: string): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>(`/campaigns/${id}/cancel`, {});
  }

  getCampaignStats(id: string): Observable<ICampaignStatsResponse> {
    return this.api.get<ICampaignStatsResponse>(`/campaigns/${id}/stats`);
  }

  sendTestMessage(id: string, testPhone: string, templateComponents: unknown[] = []): Observable<ICampaignTestMessageResponse> {
    return this.api.post<ICampaignTestMessageResponse>(`/campaigns/${id}/test`, { testPhone, templateComponents });
  }
}
