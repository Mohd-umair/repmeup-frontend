import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import {
  IActivationCampaign,
  IAudienceSnapshot,
  ICampaignStats,
  IContact,
  IContactFilterPreset,
  IContactListParams,
  ICustomFieldDefinition,
  IFilterQuery
} from '../models/contact.model';

export interface IContactListResponse {
  data: IContact[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly base = '/contacts';
  private readonly activation = '/activation';

  constructor(private apiService: ApiService) {}

  getContacts(params: IContactListParams = {}): Observable<IContactListResponse & { success: boolean }> {
    const query: Record<string, string> = {};
    if (params.search) query['search'] = params.search;
    if (params.platform) query['platform'] = params.platform;
    if (params.tag) query['tag'] = params.tag;
    if (params.lifecycleStage) query['lifecycleStage'] = params.lifecycleStage;
    if (params.owner) query['owner'] = params.owner;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    if (params.sortField) query['sortField'] = params.sortField;
    if (params.sortDir) query['sortDir'] = params.sortDir;
    if (params.filterQuery) query['filterQuery'] = JSON.stringify(params.filterQuery);

    const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
    return this.apiService.get<IContactListResponse & { success: boolean }>(`${this.base}${qs}`);
  }

  filterPreview(filterQuery: IFilterQuery, search?: string) {
    return this.apiService.post<IApiResponse<{ total: number }>>(`${this.base}/filter-preview`, { filterQuery, search });
  }

  getContact(id: string): Observable<IApiResponse<IContact>> {
    return this.apiService.get<IApiResponse<IContact>>(`${this.base}/${id}`);
  }

  updateContact(id: string, data: Partial<IContact>): Observable<IApiResponse<IContact>> {
    return this.apiService.put<IApiResponse<IContact>>(`${this.base}/${id}`, data);
  }

  deleteContact(id: string): Observable<IApiResponse<void>> {
    return this.apiService.delete<IApiResponse<void>>(`${this.base}/${id}`);
  }

  mergeContact(
    primaryId: string,
    lookup: {
      phone?: string;
      email?: string;
      secondaryId?: string;
      fieldResolutions?: Record<string, 'primary' | 'secondary'>;
    }
  ): Observable<IApiResponse<IContact>> {
    if (lookup.secondaryId) {
      return this.apiService.post<IApiResponse<IContact>>(`${this.base}/${primaryId}/merge-id`, lookup);
    }
    return this.apiService.post<IApiResponse<IContact>>(`${this.base}/${primaryId}/merge`, lookup);
  }

  listTags() {
    return this.apiService.get<IApiResponse<{ tag: string; count: number }[]>>(`${this.base}/tags`);
  }

  listPresets(kind?: 'saved_view' | 'segment') {
    const qs = kind ? `?kind=${kind}` : '';
    return this.apiService.get<IApiResponse<IContactFilterPreset[]>>(`${this.base}/saved-views${qs}`);
  }

  createPreset(body: Partial<IContactFilterPreset>) {
    return this.apiService.post<IApiResponse<IContactFilterPreset>>(`${this.base}/saved-views`, body);
  }

  deletePreset(id: string) {
    return this.apiService.delete<IApiResponse<void>>(`${this.base}/saved-views/${id}`);
  }

  seedViews() {
    return this.apiService.post<IApiResponse<void>>(`${this.base}/saved-views/seed`, {});
  }

  bulk(body: { action: string; params?: Record<string, unknown>; contactIds?: string[]; filterQuery?: IFilterQuery }) {
    return this.apiService.post<IApiResponse<{ updated: number }>>(`${this.base}/bulk`, body);
  }

  /** Resolve CRM contacts to phone lines for WhatsApp campaign audience prefill. */
  resolveCampaignAudience(body: {
    contactIds?: string[];
    filterQuery?: IFilterQuery;
    search?: string;
    platform?: string;
    tag?: string;
  }) {
    return this.apiService.post<
      IApiResponse<{
        lines: { phone: string; name: string }[];
        total: number;
        skippedNoPhone: number;
        requested: number;
      }>
    >(`${this.base}/campaign-audience`, body);
  }

  importRows(rows: Record<string, string>[], mapping: Record<string, string>) {
    return this.apiService.post<IApiResponse<{ imported: number; updated: number; failed: number }>>(`${this.base}/import`, { rows, mapping });
  }

  importCsv(csvText: string, mapping: { name?: string; phone?: string; email?: string }) {
    return this.apiService.post<IApiResponse<{ imported: number; updated: number; failed: number; mapping?: Record<string, string | null> }>>(
      `${this.base}/import`,
      { csvText, mapping }
    );
  }

  notes(id: string) {
    return this.apiService.get<IApiResponse<unknown[]>>(`${this.base}/${id}/notes`);
  }

  addNote(id: string, body: string) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.base}/${id}/notes`, { body });
  }

  tasks(id: string) {
    return this.apiService.get<IApiResponse<unknown[]>>(`${this.base}/${id}/tasks`);
  }

  addTask(id: string, payload: Record<string, unknown>) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.base}/${id}/tasks`, payload);
  }

  updateTask(id: string, taskId: string, payload: Record<string, unknown>) {
    return this.apiService.put<IApiResponse<unknown>>(`${this.base}/${id}/tasks/${taskId}`, payload);
  }

  activity(id: string, page = 1) {
    return this.apiService.get<IApiResponse<unknown[]> & { pagination?: { total: number } }>(`${this.base}/${id}/activity?page=${page}`);
  }

  orders(id: string) {
    return this.apiService.get<IApiResponse<unknown[]>>(`${this.base}/${id}/orders`);
  }

  customFields() {
    return this.apiService.get<IApiResponse<ICustomFieldDefinition[]>>(`${this.base}/custom-fields`);
  }

  createCustomField(body: Partial<ICustomFieldDefinition>) {
    return this.apiService.post<IApiResponse<ICustomFieldDefinition>>(`${this.base}/custom-fields`, body);
  }

  deleteCustomField(id: string) {
    return this.apiService.delete<IApiResponse<void>>(`${this.base}/custom-fields/${id}`);
  }

  owners() {
    return this.apiService.get<IApiResponse<{ _id: string; firstName?: string; lastName?: string }[]>>(`${this.base}/owners`);
  }

  duplicates() {
    return this.apiService.get<IApiResponse<unknown[]>>(`${this.base}/duplicates`);
  }

  scanDuplicates() {
    return this.apiService.post<IApiResponse<{ queued: boolean }>>(`${this.base}/duplicates/scan`, {});
  }

  dismissDuplicate(id: string) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.base}/duplicates/${id}/dismiss`, {});
  }

  recompute(id: string) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.base}/${id}/intelligence`, {});
  }

  generateSummary(id: string) {
    return this.apiService.post<IApiResponse<{ summary: string }>>(`${this.base}/${id}/summary`, {});
  }

  createAudience(body: { sourceType: string; sourceRef?: string; filterQuery?: IFilterQuery }) {
    return this.apiService.post<IApiResponse<IAudienceSnapshot>>(`${this.activation}/audiences`, body);
  }

  getAudience(id: string) {
    return this.apiService.get<IApiResponse<IAudienceSnapshot>>(`${this.activation}/audiences/${id}`);
  }

  createCampaign(body: Partial<IActivationCampaign> & { audienceSnapshotId?: string; connectionId?: string }) {
    return this.apiService.post<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns`, body);
  }

  listCampaigns() {
    return this.apiService.get<IApiResponse<IActivationCampaign[]>>(`${this.activation}/campaigns`);
  }

  getCampaign(id: string) {
    return this.apiService.get<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}`);
  }

  updateCampaign(id: string, body: Partial<IActivationCampaign>) {
    return this.apiService.put<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}`, body);
  }

  validateCampaign(id: string) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.activation}/campaigns/${id}/validate`, {});
  }

  previewCampaign(id: string, offset = 0) {
    return this.apiService.get<IApiResponse<unknown>>(`${this.activation}/campaigns/${id}/preview?offset=${offset}`);
  }

  generateCampaignContent(body: Record<string, string>) {
    return this.apiService.post<IApiResponse<{ text: string }>>(`${this.activation}/campaigns/ai-generate`, body);
  }

  exportCsv(params: IContactListParams = {}) {
    const query: Record<string, string> = {};
    if (params.search) query['search'] = params.search;
    if (params.platform) query['platform'] = params.platform;
    if (params.tag) query['tag'] = params.tag;
    if (params.filterQuery) query['filterQuery'] = JSON.stringify(params.filterQuery);
    const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
    return this.apiService.getBlob(`${this.base}/export${qs}`);
  }

  pauseCampaign(id: string) {
    return this.apiService.post<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}/pause`, {});
  }

  resumeCampaign(id: string) {
    return this.apiService.post<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}/resume`, {});
  }

  launchCampaign(id: string, sendNow = true) {
    return this.apiService.post<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}/launch`, { sendNow });
  }

  campaignStats(id: string) {
    return this.apiService.get<IApiResponse<ICampaignStats>>(`${this.activation}/campaigns/${id}/stats`);
  }

  followUp(id: string, condition = 'did_not_reply') {
    return this.apiService.post<IApiResponse<IActivationCampaign>>(`${this.activation}/campaigns/${id}/follow-up`, { condition });
  }

  analyzeCampaign(id: string) {
    return this.apiService.post<IApiResponse<unknown>>(`${this.activation}/campaigns/${id}/analyze`, {});
  }
}
