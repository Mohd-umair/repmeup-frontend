import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface AutoReplySettings {
  enabled: boolean;
  enabledPlatforms: string[];
  enabledTypes: string[];
  sentimentFilter?: 'all' | 'negative_only' | 'positive_only' | 'neutral_only' | 'positive_neutral';
  replyToNegative: boolean;
  replyToComplaints: boolean;
  minConfidence: number;
  autoSend: boolean;
  requireApproval: boolean;
  maxRepliesPerDay: number;
  repliesCountToday?: number;
  lastReplyResetDate?: Date;
  // Scheduling settings
  triggerMode?: 'webhook' | 'scheduled' | 'manual' | 'hybrid';
  webhookImmediate?: boolean;
  webhookDelay?: number;
  scheduleInterval?: '15min' | '30min' | '1hour' | '6hours' | '12hours' | '24hours';
  scheduleEnabled?: boolean;
  lastScheduledRun?: Date;
}

export interface InboxSettings {
  autoSyncEnabled: boolean;
}

export interface EscalationSettings {
  autoAssign?: boolean;
  /** Explicit auto-assignment pool; empty/omitted = all admins, managers, agents. */
  availableAgents?: string[];
}

export interface IOrganization {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  subscription?: any;
  limits?: any;
  usage?: any;
  whiteLabel?: any;
  autoReplySettings?: AutoReplySettings;
  inboxSettings?: InboxSettings;
  escalationSettings?: EscalationSettings;
  owner: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization Service
 * Handles organization-related API operations
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  constructor(private apiService: ApiService) {}

  /**
   * Get organization details
   */
  getOrganization(id: string): Observable<IApiResponse<IOrganization>> {
    return this.apiService.get<IApiResponse<IOrganization>>(`/organizations/${id}`);
  }

  /**
   * Update organization settings
   */
  updateOrganization(id: string, data: Partial<IOrganization>): Observable<IApiResponse<IOrganization>> {
    return this.apiService.put<IApiResponse<IOrganization>>(`/organizations/${id}`, data);
  }

  /**
   * Update auto-reply settings
   */
  updateAutoReplySettings(id: string, settings: Partial<AutoReplySettings>): Observable<IApiResponse<IOrganization>> {
    return this.updateOrganization(id, { autoReplySettings: settings as any });
  }

  /**
   * Get auto-reply settings
   */
  getAutoReplySettings(id: string): Observable<IApiResponse<AutoReplySettings>> {
    return this.apiService.get<IApiResponse<AutoReplySettings>>(`/organizations/${id}/auto-reply-settings`);
  }

  /**
   * Update inbox UI settings (autoSyncEnabled, etc.)
   */
  updateInboxSettings(id: string, settings: Partial<InboxSettings>): Observable<IApiResponse<IOrganization>> {
    return this.updateOrganization(id, { inboxSettings: settings as any });
  }

  /**
   * Upload organization logo (multipart/form-data)
   */
  uploadLogo(id: string, file: File): Observable<IApiResponse<{ logo: string }>> {
    const form = new FormData();
    form.append('logo', file);
    return this.apiService.postForm<IApiResponse<{ logo: string }>>(`/organizations/${id}/logo`, form);
  }

  /**
   * Remove organization logo
   */
  deleteLogo(id: string): Observable<IApiResponse<any>> {
    return this.apiService.delete<IApiResponse<any>>(`/organizations/${id}/logo`);
  }
}

