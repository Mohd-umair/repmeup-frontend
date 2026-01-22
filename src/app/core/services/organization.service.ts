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
}

