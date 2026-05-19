import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface IReviewPlatform {
  key: string;
  active: boolean;
  url?: string;
}

export interface IReviewCollectionSettings {
  enabled: boolean;
  platforms: IReviewPlatform[];
  trigger: 'after_purchase' | 'after_support_resolved' | 'manual';
  delayDays: number;
  channels: string[];
  language: string;
  message: string;
  sendReminders: boolean;
  reminderCount: number;
  reminderDelayDays?: number;
  ignoreNegativeRating: boolean;
  excludeRecentReviewers: boolean;
  recentReviewerDays?: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxDailyRequests?: number;
}

export interface IReviewStats {
  requestsSent?: number | { value: number; change: number };
  reviewsReceived?: number | { value: number; change: number };
  conversionRate?: number;
  avgRating?: number;
  totalReviews?: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewCollectionService {
  constructor(private api: ApiService) {}

  getSettings(): Observable<IApiResponse<IReviewCollectionSettings>> {
    return this.api.get('/automation/reviews/settings');
  }

  updateSettings(data: Partial<IReviewCollectionSettings>): Observable<IApiResponse<IReviewCollectionSettings>> {
    return this.api.put('/automation/reviews/settings', data);
  }

  getStats(): Observable<IApiResponse<IReviewStats>> {
    return this.api.get('/automation/reviews/stats');
  }
}
