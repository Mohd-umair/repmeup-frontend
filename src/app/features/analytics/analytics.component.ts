import { Component, OnInit, OnDestroy, inject, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription, interval, Subject } from 'rxjs';
import { distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalyticsService } from '../../core/services/analytics.service';
import { NotificationService } from '../../core/services/notification.service';
import { EntitlementsStore, FEATURE_KEY } from '../../core/services/entitlements.store';
import { UpgradePromptComponent } from '../../shared/components/upgrade-prompt/upgrade-prompt.component';
import {
  IAnalyticsDashboard,
  IAnalyticsFilters,
  IAnalyticsDateRange,
  IMetricCard,
  IPlatformMetrics,
  IAgentAnalytics,
  IEngagementAnalytics,
  ExportFormat,
  ReportType
} from '../../core/models/analytics.model';
import { TimeSeriesChartComponent } from '../../shared/components/charts/time-series-chart.component';
import { SentimentDonutChartComponent } from '../../shared/components/charts/sentiment-donut-chart.component';
import { PlatformBarChartComponent } from '../../shared/components/charts/platform-bar-chart.component';
import { ResponseTimeHistogramComponent } from '../../shared/components/charts/response-time-histogram.component';
import { AgentPerformanceChartComponent } from '../../shared/components/charts/agent-performance-chart.component';
import { AiChatBubbleIconComponent } from '../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

/**
 * Analytics Component - Scalable analytics dashboard
 * Follows component composition pattern for maintainability
 */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    TimeSeriesChartComponent, SentimentDonutChartComponent,
    PlatformBarChartComponent, ResponseTimeHistogramComponent,
    AgentPerformanceChartComponent,
    AiChatBubbleIconComponent,
    UpgradePromptComponent
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  readonly ent = inject(EntitlementsStore);
  readonly FEATURE_KEY = FEATURE_KEY;
  readonly planAllowed = computed(() => this.ent.can(FEATURE_KEY.ANALYTICS_ADVANCED));

  // Data
  dashboard: IAnalyticsDashboard | null = null;
  agentAnalytics: IAgentAnalytics | null = null;
  engagementAnalytics: IEngagementAnalytics | null = null;
  loading = false;
  agentLoading = false;
  engagementLoading = false;
  exportLoading = false;
  sentimentChartDays: '7days' | '30days' = '7days';

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
  activeView: 'overview' | 'platforms' | 'trends' | 'performance' | 'reports' = 'overview';
  refreshInterval = 5 * 60 * 1000;
  private refreshSubscription?: Subscription;
  private readonly destroyTab$ = new Subject<void>();

  // Reports state
  selectedReportType: ReportType = 'platform';
  selectedExportFormat: ExportFormat = 'xlsx';
  reportTypes = [
    { value: 'platform' as ReportType, label: 'Platform Comparison', icon: 'fas fa-layer-group' },
    { value: 'sentiment' as ReportType, label: 'Sentiment Analysis', icon: 'fas fa-heart' },
    { value: 'response' as ReportType, label: 'Response Performance', icon: 'fas fa-stopwatch' },
    { value: 'agent' as ReportType, label: 'Agent Performance', icon: 'fas fa-users' }
  ];
  exportFormats = [
    { value: 'xlsx' as ExportFormat, label: 'Excel (.xlsx)', icon: 'fas fa-file-excel' },
    { value: 'csv' as ExportFormat, label: 'CSV (.csv)', icon: 'fas fa-file-csv' },
    { value: 'pdf' as ExportFormat, label: 'PDF (.pdf)', icon: 'fas fa-file-pdf' }
  ];
  
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

  /** Tab bar element — scroll target when switching tabs via the sidebar. */
  @ViewChild('tabsAnchor') private tabsAnchor?: ElementRef<HTMLElement>;

  constructor(
    private analyticsService: AnalyticsService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {
    // Default to last 30 days
    this.selectedDateRange = this.analyticsService.getDateRangePreset('30days');
  }

  ngOnInit(): void {
    let tabEmitCount = 0;
    this.route.queryParamMap
      .pipe(
        map((p) => p.get('tab') || 'overview'),
        distinctUntilChanged(),
        takeUntil(this.destroyTab$)
      )
      .subscribe((tab) => {
        this.applyActiveTab(tab);
        // Skip the initial emission on mount — only scroll when the user
        // clicks a sidebar sub-link after the page is already loaded.
        if (tabEmitCount++ > 0) {
          this.scrollTabsIntoView();
        }
      });

    this.loadDashboard();
    this.loadAgentAnalytics();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroyTab$.next();
    this.destroyTab$.complete();
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private applyActiveTab(tab: string): void {
    const allowed: Array<'overview' | 'platforms' | 'trends' | 'performance' | 'reports'> = [
      'overview',
      'platforms',
      'trends',
      'performance',
      'reports'
    ];
    this.activeView = (allowed.includes(tab as typeof allowed[number]) ? tab : 'overview') as typeof this.activeView;
  }

  /**
   * Brings the tab bar (and the tab content below it) into view after the
   * sidebar switches tabs. Runs after the new tab content has rendered so the
   * scroll lands accurately. Smooth-scrolls down when the user was at the top,
   * and up when they were scrolled past — always anchoring on the tab bar.
   */
  private scrollTabsIntoView(): void {
    requestAnimationFrame(() => {
      this.tabsAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
    this.loadAgentAnalytics();
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
    this.loadAgentAnalytics();
  }

  /**
   * Switch tab in-place: update activeView immediately (no routing, no scroll jump).
   * URL is synced via Location.replaceState() which mutates history without
   * triggering any Angular Router navigation — so scrollPositionRestoration:'top'
   * never fires.
   */
  setActiveView(view: 'overview' | 'platforms' | 'trends' | 'performance' | 'reports'): void {
    this.activeView = view;
    this.location.replaceState('/app/analytics', `tab=${view}`);
  }

  /**
   * Load agent analytics
   */
  loadAgentAnalytics(): void {
    this.agentLoading = true;
    const filters: IAnalyticsFilters = {
      dateRange: this.selectedDateRange,
      platforms: this.selectedPlatforms.length > 0 ? this.selectedPlatforms : undefined
    };
    this.analyticsService.getAgentAnalytics(filters).subscribe({
      next: (res) => {
        if (res.success) this.agentAnalytics = res.data;
        this.agentLoading = false;
      },
      error: () => { this.agentLoading = false; }
    });
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.analyticsService.clearCache();
    this.agentAnalytics = null;
    this.loadDashboard();
    this.loadAgentAnalytics();
    this.notificationService.info('Refreshing Analytics', 'Loading latest data...');
  }

  /**
   * Export data (legacy quick export from toolbar)
   */
  exportData(format: ExportFormat): void {
    this.generateReport(format, 'platform');
  }

  /**
   * Generate and download report
   */
  generateReport(format?: ExportFormat, reportType?: ReportType): void {
    const fmt = format || this.selectedExportFormat;
    const type = reportType || this.selectedReportType;
    const filters: IAnalyticsFilters = {
      dateRange: this.selectedDateRange,
      platforms: this.selectedPlatforms.length > 0 ? this.selectedPlatforms : undefined
    };

    this.exportLoading = true;
    this.analyticsService.exportData(filters, fmt, type).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}-report-${Date.now()}.${fmt}`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.exportLoading = false;
        this.notificationService.success('Export Successful', `Report exported as ${fmt.toUpperCase()}`);
      },
      error: (error) => {
        console.error('Export error:', error);
        this.exportLoading = false;
        this.notificationService.error('Export Failed', 'Could not export report. Please try again.');
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
      linkedin: '#0A66C2',
      whatsapp: '#25D366'
    };
    return colors[platform] || '#6B7280';
  }

  getIntentEntries(): { key: string; label: string; value: number; percent: number; color: string; icon: string }[] {
    const ib = this.dashboard?.intentBreakdown;
    if (!ib || !ib.data || ib.total === 0) return [];

    const defaultMeta: { [key: string]: { color: string; icon: string; label: string } } = {
      inquiry: { color: '#3B82F6', icon: 'fas fa-question-circle', label: 'Inquiry' },
      complaint: { color: '#EF4444', icon: 'fas fa-exclamation-triangle', label: 'Complaint' },
      praise: { color: '#10B981', icon: 'fas fa-thumbs-up', label: 'Praise' },
      feedback: { color: '#F59E0B', icon: 'fas fa-comment-dots', label: 'Feedback' },
      support: { color: '#8B5CF6', icon: 'fas fa-headset', label: 'Support' },
      other: { color: '#6B7280', icon: 'fas fa-ellipsis-h', label: 'Other' }
    };

    return Object.entries(ib.data)
      .map(([key, value]) => {
        const customMeta = ib.meta?.[key];
        const label = customMeta?.name || customMeta?.label || defaultMeta[key]?.label || key.charAt(0).toUpperCase() + key.slice(1);
        const color = customMeta?.color || defaultMeta[key]?.color || '#6B7280';
        const icon = customMeta?.icon || defaultMeta[key]?.icon || 'fas fa-tag';

        return {
          key,
          label,
          value,
          percent: Math.round((value / ib.total) * 100),
          color,
          icon
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  getIntentIcon(intent: string): string {
    const icons: { [key: string]: string } = {
      inquiry: 'fas fa-question-circle',
      complaint: 'fas fa-exclamation-triangle',
      praise: 'fas fa-thumbs-up',
      feedback: 'fas fa-comment-dots',
      support: 'fas fa-headset',
      other: 'fas fa-ellipsis-h'
    };
    return icons[intent] || 'fas fa-tag';
  }

  getPositivePercent(): number {
    const sb = this.dashboard?.sentimentBreakdown;
    if (!sb || sb.total === 0) return 0;
    return Math.round((sb.positive / sb.total) * 100);
  }

  getNegativePercent(): number {
    const sb = this.dashboard?.sentimentBreakdown;
    if (!sb || sb.total === 0) return 0;
    return Math.round((sb.negative / sb.total) * 100);
  }

  getNeutralPercent(): number {
    const sb = this.dashboard?.sentimentBreakdown;
    if (!sb || sb.total === 0) return 0;
    return Math.round((sb.neutral / sb.total) * 100);
  }
}

