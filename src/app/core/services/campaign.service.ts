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

export type CampaignHeaderMediaKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface ICampaignHeaderMedia {
  kind: CampaignHeaderMediaKind;
  url: string;
  filename?: string;
  mediaLibraryId?: string;
}

export interface ICampaignHeaderLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ICampaignUrlButtonParam {
  index: number;
  value: string;
}

export interface ICampaignVariableMapping {
  phoneColumn?: string;
  nameColumn?: string;
  countryCodeColumn?: string;
  slots?: Record<string, string>;
}

export interface ICampaignAudienceSettings {
  defaultCountry?: string;
  countryCodeColumn?: string;
}

export interface IPhonePreviewRow {
  row: number;
  raw: string;
  normalized: string | null;
  status: 'valid' | 'prefixed' | 'invalid';
  reason?: string;
}

export interface IPhonePreviewStats {
  valid: number;
  prefixed: number;
  invalid: number;
}

export interface IAudienceDefaultsResponse {
  success: boolean;
  suggestedDefaultCountry?: string;
  defaultCountry?: string;
  countryCodeColumn?: string | null;
  supportedRegions?: string[];
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
    definition?: unknown;
    parameterFormat?: 'POSITIONAL' | 'NAMED';
  };
  headerMedia?: ICampaignHeaderMedia;
  headerLocation?: ICampaignHeaderLocation;
  urlButtonParams?: ICampaignUrlButtonParam[];
  variableMapping?: ICampaignVariableMapping;
  audienceSettings?: ICampaignAudienceSettings;
  status: CampaignStatus;
  scheduledAt?: string | null;
  startedAt?: string;
  finishedAt?: string;
  stats: ICampaignStats;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignRecipientSendStatus = 'pending' | 'sent' | 'failed';

export type CampaignRecipientDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/** Unified status for campaign recipient report UI */
export type CampaignRecipientReportStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'replied';

export interface ICampaignRecipient {
  _id: string;
  campaign: string;
  phone: string;
  recipientName?: string;
  status: CampaignRecipientSendStatus;
  deliveryStatus?: CampaignRecipientDeliveryStatus;
  deliveryStatusAt?: string;
  deliveryError?: string;
  messageId?: string;
  errorMessage?: string;
  sentAt?: string;
  repliedAt?: string;
  reportStatus?: CampaignRecipientReportStatus;
  createdAt?: string;
}

export interface ICampaignRecipientSummary {
  total: number;
  pending: number;
  failed: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
}

export interface ICampaignRecipientsReportResponse {
  success: boolean;
  campaign?: { _id: string; name: string; stats: ICampaignStats };
  summary?: ICampaignRecipientSummary;
  recipients: ICampaignRecipient[];
  total: number;
  page: number;
  limit: number;
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

// ── Template slot descriptor (mirrors backend whatsappTemplateSlots.js) ──────

export type TemplateHeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | null;

export interface ITemplateSlot {
  key: string;
  name?: string;
  position?: number;
  label: string;
  exampleValue?: string;
}

export interface ITemplateButtonSlot {
  index: number;
  sub_type: 'url' | 'copy_code';
  urlVars: ITemplateSlot[];
  text?: string;
}

export interface ITemplateSlots {
  header: {
    format: TemplateHeaderFormat;
    requiresMedia: boolean;
    textSlots: ITemplateSlot[];
  };
  body: {
    format: 'POSITIONAL' | 'NAMED';
    slots: ITemplateSlot[];
  };
  buttons: ITemplateButtonSlot[];
  isAuth: boolean;
  isUnsupported: { reason: string } | null;
}

export interface ITemplateSlotsResponse {
  success: boolean;
  slots: ITemplateSlots | null;
  hasTemplate: boolean;
  template?: {
    _id: string;
    name: string;
    language: string;
    category: string;
    parameter_format?: 'POSITIONAL' | 'NAMED';
    components: unknown[];
  };
}

export interface ICsvPreviewSuggestion {
  phoneColumn: string | null;
  nameColumn: string | null;
  countryCodeColumn?: string | null;
  slots: Record<string, string | null>;
}

export interface ICsvPreviewResponse {
  success: boolean;
  hasHeader: boolean;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  suggestedMapping: ICsvPreviewSuggestion;
  slots: ITemplateSlots | null;
  phonePreview?: IPhonePreviewRow[];
  phoneStats?: IPhonePreviewStats;
  suggestedDefaultCountry?: string;
  defaultCountry?: string;
}

export interface ICsvUploadMapping {
  phoneColumn: string;
  nameColumn?: string;
  countryCodeColumn?: string;
  slots?: Record<string, string>;
}

export interface ICampaignAudienceOptions {
  defaultCountry?: string;
  countryCodeColumn?: string;
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

  addRecipients(
    id: string,
    rawText: string,
    options?: ICampaignAudienceOptions
  ): Observable<IAddRecipientsResponse> {
    return this.api.post<IAddRecipientsResponse>(`/campaigns/${id}/recipients`, {
      rawText,
      ...options
    });
  }

  /** Inserts recipients with a CSV-column → template-slot mapping (per-recipient template params). */
  addRecipientsWithMapping(
    id: string,
    rawText: string,
    mapping: ICsvUploadMapping,
    defaultParams?: Record<string, string>,
    options?: ICampaignAudienceOptions
  ): Observable<IAddRecipientsResponse> {
    return this.api.post<IAddRecipientsResponse>(
      `/campaigns/${id}/recipients`,
      { rawText, mapping, defaultParams, ...options }
    );
  }

  /** Returns headers + sample rows + suggested mapping + phone validation preview. */
  previewRecipientCsv(
    id: string,
    rawText: string,
    options?: ICampaignAudienceOptions
  ): Observable<ICsvPreviewResponse> {
    return this.api.post<ICsvPreviewResponse>(
      `/campaigns/${id}/recipients/csv/preview`,
      { rawText, ...options }
    );
  }

  getAudienceDefaults(id: string): Observable<IAudienceDefaultsResponse> {
    return this.api.get<IAudienceDefaultsResponse>(`/campaigns/${id}/audience-defaults`);
  }

  /** Returns the slot descriptor for this campaign's currently-selected template. */
  getTemplateSlots(id: string): Observable<ITemplateSlotsResponse> {
    return this.api.get<ITemplateSlotsResponse>(`/campaigns/${id}/template-slots`);
  }

  clearRecipients(id: string): Observable<ICampaignClearRecipientsResponse> {
    return this.api.delete<ICampaignClearRecipientsResponse>(`/campaigns/${id}/recipients`);
  }

  getRecipients(id: string, params?: { page?: number; limit?: number; status?: string }): Observable<ICampaignRecipientsResponse> {
    return this.api.get<ICampaignRecipientsResponse>(`/campaigns/${id}/recipients`, params);
  }

  getRecipientsReport(
    id: string,
    params?: { page?: number; limit?: number; reportStatus?: string; search?: string }
  ): Observable<ICampaignRecipientsReportResponse> {
    return this.api.get<ICampaignRecipientsReportResponse>(`/campaigns/${id}/recipients/report`, params);
  }

  launchCampaign(id: string): Observable<ICampaignSingleResponse> {
    return this.api.post<ICampaignSingleResponse>(`/campaigns/${id}/launch`, {});
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

  sendTestMessage(
    id: string,
    testPhone: string,
    testParams?: Record<string, string>,
    defaultCountry?: string
  ): Observable<ICampaignTestMessageResponse> {
    return this.api.post<ICampaignTestMessageResponse>(`/campaigns/${id}/test`, {
      testPhone,
      testParams,
      defaultCountry
    });
  }
}
