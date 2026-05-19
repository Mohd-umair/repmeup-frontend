import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface IWhatsAppFlowStep {
  order: number;
  label?: string;
  templateId?: string;
  messageText?: string;
  delaySec?: number;
  branchOn?: string | null;
  branches?: { match: string; nextStep: number }[];
}

export interface IWhatsAppFlow {
  _id?: string;
  name: string;
  description?: string;
  isBlueprint?: boolean;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: {
    type: string;
    value?: string;
  };
  steps: IWhatsAppFlowStep[];
  stats?: {
    triggered: number;
    completed: number;
    converted: number;
  };
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class WhatsAppFlowService {
  constructor(private api: ApiService) {}

  listFlows(): Observable<IApiResponse<IWhatsAppFlow[]>> {
    return this.api.get('/whatsapp-flows');
  }

  createFlow(data: Partial<IWhatsAppFlow>): Observable<IApiResponse<IWhatsAppFlow>> {
    return this.api.post('/whatsapp-flows', data);
  }

  getFlow(id: string): Observable<IApiResponse<IWhatsAppFlow>> {
    return this.api.get(`/whatsapp-flows/${id}`);
  }

  updateFlow(id: string, data: Partial<IWhatsAppFlow>): Observable<IApiResponse<IWhatsAppFlow>> {
    return this.api.put(`/whatsapp-flows/${id}`, data);
  }

  deleteFlow(id: string): Observable<IApiResponse<void>> {
    return this.api.delete(`/whatsapp-flows/${id}`);
  }

  activateFlow(id: string): Observable<IApiResponse<IWhatsAppFlow>> {
    return this.api.post(`/whatsapp-flows/${id}/activate`, {});
  }

  pauseFlow(id: string): Observable<IApiResponse<IWhatsAppFlow>> {
    return this.api.post(`/whatsapp-flows/${id}/pause`, {});
  }
}
