import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { 
  IAnalyticsDashboard, 
  IAnalyticsFilters, 
  IAnalyticsResponse,
  IAnalyticsDateRange,
  IAgentAnalytics,
  IEngagementAnalytics,
  ExportFormat,
  ReportType
} from '../models/analytics.model';
import { saveAs } from 'file-saver';

/**
 * Analytics Service - Scalable analytics data management
 * Handles all analytics-related API calls with caching and optimization
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private apiService: ApiService,
    private http: HttpClient
  ) {}

  /**
   * Get analytics dashboard data
   */
  getDashboard(filters?: IAnalyticsFilters): Observable<IAnalyticsResponse> {
    const cacheKey = this.getCacheKey('dashboard', filters);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return this.apiService.post<IAnalyticsResponse>('/analytics/dashboard', filters);
  }

  /**
   * Get platform-specific analytics
   */
  getPlatformAnalytics(platform: string, dateRange: IAnalyticsDateRange): Observable<any> {
    return this.apiService.post<any>(`/analytics/platform/${platform}`, { dateRange });
  }

  /**
   * Get time-series data for charts
   */
  getTimeSeriesData(filters: IAnalyticsFilters, metric: string): Observable<any> {
    return this.apiService.post<any>('/analytics/timeseries', { ...filters, metric });
  }

  /**
   * Get sentiment analysis data
   */
  getSentimentAnalysis(filters: IAnalyticsFilters): Observable<any> {
    return this.apiService.post<any>('/analytics/sentiment', filters);
  }

  /**
   * Get auto-reply performance metrics
   */
  getAutoReplyMetrics(filters: IAnalyticsFilters): Observable<any> {
    return this.apiService.post<any>('/analytics/auto-reply', filters);
  }

  /**
   * Get response time analytics
   */
  getResponseTimeAnalytics(filters: IAnalyticsFilters): Observable<any> {
    return this.apiService.post<any>('/analytics/response-time', filters);
  }

  /**
   * Export analytics data and trigger browser download
   */
  exportData(filters: IAnalyticsFilters, format: ExportFormat, reportType: ReportType = 'platform'): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/analytics/export`,
      { ...filters, format, reportType },
      { responseType: 'blob' }
    );
  }

  /**
   * Trigger export + auto-download
   */
  downloadReport(filters: IAnalyticsFilters, format: ExportFormat, reportType: ReportType): void {
    this.exportData(filters, format, reportType).subscribe({
      next: (blob) => {
        const filename = `${reportType}-report-${Date.now()}.${format}`;
        saveAs(blob, filename);
      },
      error: (err) => console.error('Export error:', err)
    });
  }

  /**
   * Get agent analytics
   */
  getAgentAnalytics(filters: IAnalyticsFilters, agentId?: string): Observable<{ success: boolean; data: IAgentAnalytics }> {
    return this.apiService.post<{ success: boolean; data: IAgentAnalytics }>('/analytics/agents', { ...filters, agentId });
  }

  /**
   * Get engagement analytics
   */
  getEngagementAnalytics(filters: IAnalyticsFilters): Observable<{ success: boolean; data: IEngagementAnalytics }> {
    return this.apiService.post<{ success: boolean; data: IEngagementAnalytics }>('/analytics/engagement', filters);
  }

  /**
   * Get comparison data (current vs previous period)
   */
  getComparisonData(currentRange: IAnalyticsDateRange): Observable<any> {
    return this.apiService.post<any>('/analytics/comparison', { dateRange: currentRange });
  }

  /**
   * Cache management
   */
  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Helper: Generate date range presets
   */
  getDateRangePreset(preset: string): IAnalyticsDateRange {
    const endDate = new Date();
    const startDate = new Date();

    switch (preset) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return { startDate, endDate, preset: preset as any };
  }
}

