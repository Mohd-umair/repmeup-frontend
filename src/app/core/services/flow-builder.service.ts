import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import {
  IAutomationFlow,
  IFlowNodeCatalogItem,
  IFlowValidationResult,
  FlowChannel
} from '../models/flow-builder.model';

@Injectable({ providedIn: 'root' })
export class FlowBuilderService {
  private readonly base = '/automation/flows';

  constructor(private api: ApiService) {}

  listFlows(params?: { blueprints?: 'true' | 'false' | 'all'; page?: number; limit?: number }): Observable<IApiResponse<IAutomationFlow[]> & { total?: number; page?: number; limit?: number; pages?: number }> {
    return this.api.get(this.base, params);
  }

  getFlow(id: string): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.get(`${this.base}/${id}`);
  }

  createFlow(data: Partial<IAutomationFlow>): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.post(this.base, data);
  }

  updateFlow(id: string, data: Partial<IAutomationFlow>): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.put(`${this.base}/${id}`, data);
  }

  deleteFlow(id: string): Observable<IApiResponse<void>> {
    return this.api.delete(`${this.base}/${id}`);
  }

  publishFlow(id: string): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.post(`${this.base}/${id}/publish`, {});
  }

  pauseFlow(id: string): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.post(`${this.base}/${id}/pause`, {});
  }

  duplicateFlow(id: string): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.post(`${this.base}/${id}/duplicate`, {});
  }

  validateFlow(id: string): Observable<IApiResponse<IFlowValidationResult>> {
    return this.api.post(`${this.base}/${id}/validate`, {});
  }

  testFlow(id: string): Observable<IApiResponse<{ validation: IFlowValidationResult; startNodeId: string; stepPreview: unknown[] }>> {
    return this.api.post(`${this.base}/${id}/test`, {});
  }

  getNodeCatalog(channels?: FlowChannel[]): Observable<IApiResponse<IFlowNodeCatalogItem[]>> {
    const params = channels?.length ? { channels: channels.join(',') } : undefined;
    return this.api.get(`${this.base}/node-catalog`, params);
  }
}
