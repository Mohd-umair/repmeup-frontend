import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import {
  IAutomationFlow,
  IFlowNodeCatalogItem,
  IFlowValidationResult,
  IFlowKeywordConflict,
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

  publishFlow(id: string, acknowledgeOverlap = false): Observable<IApiResponse<IAutomationFlow>> {
    return this.api.post(`${this.base}/${id}/publish`, { acknowledgeOverlap });
  }

  /**
   * Design-time check: does this keyword set overlap with another already-active flow on
   * the same channel(s)? Called (debounced) while editing a trigger.keyword node, and again
   * server-side on publish so the check can't be skipped by bypassing the UI.
   */
  checkKeywordOverlap(params: { keywords: string[]; channels: FlowChannel[]; flowId?: string }): Observable<IApiResponse<void> & { conflicts: IFlowKeywordConflict[] }> {
    return this.api.post(`${this.base}/check-keyword-overlap`, params);
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

  listEnrollments(flowId: string, params?: { page?: number; limit?: number; status?: string }): Observable<IApiResponse<{
    flow: { _id: string; name: string };
    enrollments: IFlowEnrollment[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>> {
    return this.api.get(`${this.base}/${flowId}/enrollments`, params);
  }

  getEnrollment(flowId: string, enrollmentId: string): Observable<IApiResponse<IFlowEnrollment>> {
    return this.api.get(`${this.base}/${flowId}/enrollments/${enrollmentId}`);
  }
}

export interface IFlowEnrollment {
  _id: string;
  platform: string;
  platformUserId: string;
  contact?: { _id: string; name?: string; phone?: string; email?: string; flowsOptedOut?: boolean } | null;
  status: 'active' | 'waiting' | 'completed' | 'failed' | 'dropped';
  currentNodeId: string;
  lastError?: string;
  flowVersion?: number;
  createdAt: string;
  updatedAt: string;
  history?: Array<{ nodeId: string; event: string; at: string; nodeLabel?: string; nodeType?: string }>;
  flow?: { _id: string; name: string };
}
