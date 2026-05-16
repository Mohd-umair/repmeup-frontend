import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  IVoiceAgent,
  IVoiceAgentTemplate,
  IPhoneNumber,
  IAvailableTwilioNumber,
  ICallSession,
  IVoiceCredentialSummary,
  IVoiceCredentialPayload,
  IVoiceAnalyticsSummary,
  IVoiceAnalyticsTrendRow,
  IPagedResponse,
  ICallsListFilter,
  IOutboundCallPayload,
  ISearchNumbersPayload
} from '../models/voice-ivr.model';

interface SuccessEnvelope<T> { success: boolean; data: T; }

/**
 * Voice IVR Service — typed wrappers around `/api/voice/*` endpoints.
 * Single responsibility: HTTP only. Components handle UI state.
 */
@Injectable({ providedIn: 'root' })
export class VoiceIvrService {
  private readonly base = '/voice';

  constructor(private api: ApiService) {}

  // ── Credentials ───────────────────────────────────────────────────────────
  getCredentials(): Observable<SuccessEnvelope<IVoiceCredentialSummary | null>> {
    return this.api.get(`${this.base}/credentials`);
  }
  updateCredentials(payload: IVoiceCredentialPayload): Observable<SuccessEnvelope<IVoiceCredentialSummary>> {
    return this.api.put(`${this.base}/credentials`, payload);
  }
  deleteCredentials(): Observable<SuccessEnvelope<null>> {
    return this.api.delete(`${this.base}/credentials`);
  }

  // ── Phone numbers ─────────────────────────────────────────────────────────
  listPhoneNumbers(): Observable<SuccessEnvelope<IPhoneNumber[]>> {
    return this.api.get(`${this.base}/phone-numbers`);
  }
  searchAvailableNumbers(payload: ISearchNumbersPayload): Observable<SuccessEnvelope<IAvailableTwilioNumber[]>> {
    return this.api.post(`${this.base}/phone-numbers/search`, payload);
  }
  purchaseNumber(payload: {
    phoneNumber: string;
    friendlyName?: string;
    assignedAgent?: string;
  }): Observable<SuccessEnvelope<IPhoneNumber>> {
    return this.api.post(`${this.base}/phone-numbers/purchase`, payload);
  }
  registerExistingNumber(payload: {
    twilioSid: string;
    friendlyName?: string;
    assignedAgent?: string;
  }): Observable<SuccessEnvelope<IPhoneNumber>> {
    return this.api.post(`${this.base}/phone-numbers/register-existing`, payload);
  }
  updatePhoneNumber(id: string, payload: Partial<IPhoneNumber>): Observable<SuccessEnvelope<IPhoneNumber>> {
    return this.api.put(`${this.base}/phone-numbers/${id}`, payload);
  }
  releasePhoneNumber(id: string): Observable<SuccessEnvelope<null>> {
    return this.api.delete(`${this.base}/phone-numbers/${id}`);
  }

  // ── Agents ────────────────────────────────────────────────────────────────
  listAgents(): Observable<SuccessEnvelope<IVoiceAgent[]>> {
    return this.api.get(`${this.base}/agents`);
  }
  getAgentTemplates(): Observable<SuccessEnvelope<IVoiceAgentTemplate[]>> {
    return this.api.get(`${this.base}/agents/templates`);
  }
  getAgent(id: string): Observable<SuccessEnvelope<IVoiceAgent>> {
    return this.api.get(`${this.base}/agents/${id}`);
  }
  createAgent(payload: Partial<IVoiceAgent>): Observable<SuccessEnvelope<IVoiceAgent>> {
    return this.api.post(`${this.base}/agents`, payload);
  }
  updateAgent(id: string, payload: Partial<IVoiceAgent>): Observable<SuccessEnvelope<IVoiceAgent>> {
    return this.api.put(`${this.base}/agents/${id}`, payload);
  }
  deleteAgent(id: string): Observable<SuccessEnvelope<null>> {
    return this.api.delete(`${this.base}/agents/${id}`);
  }

  // ── Calls ─────────────────────────────────────────────────────────────────
  listCalls(filter: ICallsListFilter = {}): Observable<SuccessEnvelope<IPagedResponse<ICallSession>>> {
    return this.api.get(`${this.base}/calls`, filter);
  }
  getCall(id: string): Observable<SuccessEnvelope<ICallSession>> {
    return this.api.get(`${this.base}/calls/${id}`);
  }
  createOutboundCall(payload: IOutboundCallPayload): Observable<SuccessEnvelope<{ sid: string; status: string }>> {
    return this.api.post(`${this.base}/calls/outbound`, payload);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  getAnalyticsSummary(): Observable<SuccessEnvelope<IVoiceAnalyticsSummary>> {
    return this.api.get(`${this.base}/analytics/summary`);
  }
  getAnalyticsTrends(days = 30): Observable<SuccessEnvelope<IVoiceAnalyticsTrendRow[]>> {
    return this.api.get(`${this.base}/analytics/trends`, { days });
  }
}
