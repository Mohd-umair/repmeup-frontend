import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface IEscalationSettings {
  enabled: boolean;
  maxAutoReplies: number;
  escalateOnNegative: boolean;
  negativeThreshold: number;
  escalationKeywords: string[];
  lowConfidenceThreshold: number;
  lowConfidenceCount: number;
  assignmentMethod: string;
  autoAssign: boolean;
  notifyAgents: boolean;
  notificationChannels: string[];
  handoffMessageTemplate: string;
  handoffMessage?: string;
  triggers?: {
    lowConfidence: boolean;
    negativeSentiment: boolean;
    complexRequests: boolean;
    repeatedMessages: boolean;
    keywords: string[];
    outsideBusinessHours: boolean;
  };
  routing?: {
    strategy: string;
    slaMinutes: number;
    fallbackOption: string;
  };
  notifications?: {
    notifyAgents: boolean;
    notifyCustomer: boolean;
    addInternalNote: boolean;
    slaBreachAlert: boolean;
  };
}

export interface IEscalationStats {
  totalEscalated?: { value: number; change: number };
  /** Plain count after normalize; API may send `{ value, change }` before normalization */
  resolved?: number | { value: number; change: number };
  avgResponseTime?: string;
  slaMet?: number;
  totalEscalations?: number;
  avgResolutionMinutes?: number;
}

export interface IEscalationBreakdown {
  total: number;
  items: { reason: string; label: string; count: number; pct: number }[];
}

@Injectable({ providedIn: 'root' })
export class EscalationService {
  constructor(private api: ApiService) {}

  getSettings(): Observable<IApiResponse<IEscalationSettings>> {
    return this.api.get('/automation/escalation/settings');
  }

  updateSettings(data: Partial<IEscalationSettings>): Observable<IApiResponse<IEscalationSettings>> {
    return this.api.put('/automation/escalation/settings', data);
  }

  getStats(): Observable<IApiResponse<IEscalationStats>> {
    return this.api.get('/automation/escalation/stats');
  }

  getBreakdown(): Observable<IApiResponse<IEscalationBreakdown>> {
    return this.api.get('/automation/escalation/breakdown');
  }

  getTopReasons(): Observable<IApiResponse<{ rank: number; label: string; count: number; pct: number }[]>> {
    return this.api.get('/automation/escalation/top-reasons');
  }
}
