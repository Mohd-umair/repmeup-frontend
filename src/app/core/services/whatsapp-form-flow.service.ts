import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  IWhatsAppFormFlow,
  ICreateFlowRequest,
  IUpdateFlowRequest,
  IListFlowsResponse,
  IFlowResponse,
  IFlowTemplatesResponse
} from '../models/whatsapp-form-flow.model';

@Injectable({
  providedIn: 'root'
})
export class WhatsAppFormFlowService {
  private apiUrl = `${environment.apiUrl}/whatsapp-form-flows`;

  constructor(private http: HttpClient) {}

  /**
   * Get available templates
   */
  getTemplates(): Observable<IFlowTemplatesResponse> {
    return this.http.get<IFlowTemplatesResponse>(`${this.apiUrl}/templates`);
  }

  /**
   * List flows for the organization
   */
  listFlows(page: number = 1, limit: number = 12, status?: string): Observable<IListFlowsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<IListFlowsResponse>(this.apiUrl, { params });
  }

  /**
   * Create a new flow draft
   */
  createFlow(request: ICreateFlowRequest): Observable<IFlowResponse> {
    return this.http.post<IFlowResponse>(this.apiUrl, request);
  }

  /**
   * Get a specific flow
   */
  getFlow(flowId: string): Observable<IFlowResponse> {
    return this.http.get<IFlowResponse>(`${this.apiUrl}/${flowId}`);
  }

  /**
   * Update a draft flow
   */
  updateFlow(flowId: string, request: IUpdateFlowRequest): Observable<IFlowResponse> {
    return this.http.put<IFlowResponse>(`${this.apiUrl}/${flowId}`, request);
  }

  /**
   * Delete a draft or deprecated flow
   */
  deleteFlow(flowId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${flowId}`);
  }

  /**
   * Publish a draft flow to Meta
   */
  publishFlow(flowId: string): Observable<IFlowResponse> {
    return this.http.post<IFlowResponse>(`${this.apiUrl}/${flowId}/publish`, {});
  }

  /**
   * Deprecate a published flow
   */
  deprecateFlow(flowId: string): Observable<IFlowResponse> {
    return this.http.post<IFlowResponse>(`${this.apiUrl}/${flowId}/deprecate`, {});
  }
}
