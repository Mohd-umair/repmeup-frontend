import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreateTemplatePayload,
  TemplateListResponse,
  TemplateSingleResponse,
  TemplateCreateResponse,
  TemplateHeaderUploadResponse
} from '../models/whatsapp-template.model';

/**
 * WhatsApp Template Service
 * Single responsibility: all HTTP calls to /api/whatsapp-templates
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppTemplateService {
  private readonly base = '/whatsapp-templates';

  constructor(private api: ApiService) {}

  /**
   * Create a new template on Meta.
   */
  createTemplate(payload: CreateTemplatePayload): Observable<TemplateCreateResponse> {
    return this.api.post<TemplateCreateResponse>(this.base, payload);
  }

  /**
   * List all templates for the connected WABA.
   */
  listTemplates(connectionId?: string, category?: string): Observable<TemplateListResponse> {
    const params: Record<string, string> = {};
    if (connectionId) params['connectionId'] = connectionId;
    if (category) params['category'] = category;
    return this.api.get<TemplateListResponse>(this.base, params);
  }

  /**
   * Get a single template by Meta template ID.
   */
  getTemplate(metaTemplateId: string, connectionId?: string): Observable<TemplateSingleResponse> {
    const params: Record<string, string> = {};
    if (connectionId) params['connectionId'] = connectionId;
    return this.api.get<TemplateSingleResponse>(`${this.base}/${metaTemplateId}`, params);
  }

  /**
   * Upload example media for a template HEADER (Meta resumable upload → handle).
   */
  uploadHeaderExample(
    connectionId: string,
    file: File
  ): Observable<TemplateHeaderUploadResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (connectionId) fd.append('connectionId', connectionId);
    return this.api.postForm<TemplateHeaderUploadResponse>(
      `${this.base}/upload-header-example`,
      fd
    );
  }

  /**
   * Delete a template.
   */
  deleteTemplate(
    metaTemplateId: string,
    name: string,
    connectionId?: string
  ): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(
      `${this.base}/${metaTemplateId}?name=${encodeURIComponent(name)}${connectionId ? '&connectionId=' + connectionId : ''}`
    );
  }
}
