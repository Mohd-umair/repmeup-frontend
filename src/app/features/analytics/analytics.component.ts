import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { AnalyticsService } from '../../core/services/analytics.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  IAnalyticsDashboard,
  IAnalyticsFilters,
  IAnalyticsDateRange,
  IMetricCard,
  IPlatformMetrics
} from '../../core/models/analytics.model';

/**
 * Analytics Component - Scalable analytics dashboard
 * Follows component composition pattern for maintainability
 */
@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  // Data
  dashboard: IAnalyticsDashboard | null = null;
  loading = false;
  
  // Filters
  selectedDateRange: IAnalyticsDateRange;
  selectedPlatforms: string[] = [];
  dateRangePresets = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: '7days' },
    { label: 'Last 30 Days', value: '30days' },
    { label: 'Last 90 Days', value: '90days' }
  ];
  
  // UI State
  activeView: 'overview' | 'platforms' | 'trends' | 'performance' = 'overview';
  refreshInterval = 5 * 60 * 1000; // 5 minutes
  private refreshSubscription?: Subscription;
  
  // Chart configurations
  chartColors = {
    primary: '#D0FF00',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    gray: '#6B7280'
  };

  // Make Math available in template
  Math = Math;

  constructor(
    private analyticsService: AnalyticsService,
    private notificationService: NotificationService
  ) {
    // Default to last 30 days
    this.selectedDateRange = this.analyticsService.getDateRangePreset('30days');
  }

  ngOnInit(): void {
    this.loadDashboard();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  /**
   * Load dashboard data
   */
  loadDashboard(): void {
    this.loading = true;
    
    const filters: IAnalyticsFilters = {
      dateRange: this.selectedDateRange,
      platforms: this.selectedPlatforms.length > 0 ? this.selectedPlatforms : undefined
    };

    this.analyticsService.getDashboard(filters).subscribe({
      next: (response) => {
        if (response.success) {
          this.dashboard = response.data;
          console.log('📊 [Analytics] Dashboard loaded:', this.dashboard);
        } else {
          this.notificationService.error(
            'Failed to Load Analytics',
            response.error || 'Could not retrieve analytics data.'
          );
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading analytics:', error);
        this.notificationService.error(
          'Analytics Error',
          'Failed to load analytics data. Please try again.'
        );
        this.loading = false;
      }
    });
  }

  /**
   * Change date range
   */
  onDateRangeChange(preset: string): void {
    this.selectedDateRange = this.analyticsService.getDateRangePreset(preset);
    this.loadDashboard();
  }

  /**
   * Toggle platform filter
   */
  togglePlatform(platform: string): void {
    const index = this.selectedPlatforms.indexOf(platform);
    if (index > -1) {
      this.selectedPlatforms.splice(index, 1);
    } else {
      this.selectedPlatforms.push(platform);
    }
    this.loadDashboard();
  }

  /**
   * Change active view
   */
  setActiveView(view: 'overview' | 'platforms' | 'trends' | 'performance'): void {
    this.activeView = view;
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.analyticsService.clearCache();
    this.loadDashboard();
    this.notificationService.info('Refreshing Analytics', 'Loading latest data...');
  }

  /**
   * Export data
   */
  exportData(format: 'csv' | 'xlsx' | 'pdf'): void {
    const filters: IAnalyticsFilters = {
      dateRange: this.selectedDateRange,
      platforms: this.selectedPlatforms.length > 0 ? this.selectedPlatforms : undefined
    };

    this.analyticsService.exportData(filters, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-${Date.now()}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        this.notificationService.success(
          'Export Successful',
          `Analytics exported as ${format.toUpperCase()}`
        );
      },
      error: (error) => {
        console.error('Export error:', error);
        this.notificationService.error(
          'Export Failed',
          'Could not export analytics data.'
        );
      }
    });
  }

  /**
   * Setup auto-refresh (uses RxJS interval so it can be unsubscribed in ngOnDestroy - no memory leak)
   */
  private setupAutoRefresh(): void {
    this.refreshSubscription = interval(this.refreshInterval).subscribe(() => {
      if (!this.loading) {
        this.loadDashboard();
      }
    });
  }

  /**
   * Get metric card array for template
   */
  getMetricCards(): IMetricCard[] {
    if (!this.dashboard) return [];
    
    return [
      this.dashboard.overview.totalInteractions,
      this.dashboard.overview.responseRate,
      this.dashboard.overview.avgResponseTime,
      this.dashboard.overview.sentimentScore
    ];
  }

  /**
   * Get platform metrics
   */
  getPlatformMetrics(): IPlatformMetrics[] {
    return this.dashboard?.platformMetrics || [];
  }

  /**
   * Format number with commas
   */
  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  /**
   * Format percentage
   */
  formatPercentage(num: number): string {
    return `${num.toFixed(1)}%`;
  }

  /**
   * Format time (minutes to human readable)
   */
  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Get platform icon
   */
  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      youtube: 'fab fa-youtube',
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      google: 'fab fa-google',
      linkedin: 'fab fa-linkedin'
    };
    return icons[platform] || 'fas fa-globe';
  }

  /**
   * Get platform color
   */
  getPlatformColor(platform: string): string {
    const colors: { [key: string]: string } = {
      youtube: '#FF0000',
      instagram: '#E4405F',
      facebook: '#1877F2',
      google: '#4285F4',
      linkedin: '#0A66C2'
    };
    return colors[platform] || '#6B7280';
  }
}

