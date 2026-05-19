import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface IRetargetingStep {
  order: number;
  type: 'message' | 'wait' | 'condition' | 'action';
  channel?: string;
  content?: string;
  templateId?: string;
  delaySec?: number;
}

export interface IRetargetingFlow {
  _id?: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  audience: {
    type: string;
    filters?: Record<string, unknown>;
    audienceWindowDays?: number;
  };
  channels: string[];
  steps: IRetargetingStep[];
  settings: {
    frequencyCap?: number;
    frequencyCapWindowDays?: number;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
  stats?: {
    enrolled: number;
    completed: number;
    converted: number;
    lastRunAt?: string;
  };
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class RetargetingService {
  constructor(private api: ApiService) {}

  listFlows(): Observable<IApiResponse<IRetargetingFlow[]>> {
    return this.api.get('/retargeting/flows');
  }

  createFlow(data: Partial<IRetargetingFlow>): Observable<IApiResponse<IRetargetingFlow>> {
    return this.api.post('/retargeting/flows', data);
  }

  getFlow(id: string): Observable<IApiResponse<IRetargetingFlow>> {
    return this.api.get(`/retargeting/flows/${id}`);
  }

  updateFlow(id: string, data: Partial<IRetargetingFlow>): Observable<IApiResponse<IRetargetingFlow>> {
    return this.api.put(`/retargeting/flows/${id}`, data);
  }

  deleteFlow(id: string): Observable<IApiResponse<void>> {
    return this.api.delete(`/retargeting/flows/${id}`);
  }

  previewAudience(audienceType: string, filters?: Record<string, unknown>): Observable<IApiResponse<{ estimatedSize: number }>> {
    return this.api.post('/retargeting/audiences/preview', { audienceType, filters });
  }
}
