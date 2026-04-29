import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import {
  IAnalyticsDashboard,
  ITimeSeriesData,
  ISentimentBreakdown,
  IPlatformMetrics,
  IAiVsHuman,
  IIntentBreakdown,
  IIntentBucketMeta
} from '../../core/models/analytics.model';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { RaiseTicketModalComponent } from '../support/raise-ticket-modal/raise-ticket-modal.component';
import { NotificationService } from '../../core/services/notification.service';
import { TimeSeriesChartComponent } from '../../shared/components/charts/time-series-chart.component';
import { SentimentDonutChartComponent } from '../../shared/components/charts/sentiment-donut-chart.component';
import { SimpleDonutChartComponent, DonutSegment } from '../../shared/components/charts/simple-donut-chart.component';
import { PlatformBarChartComponent } from '../../shared/components/charts/platform-bar-chart.component';

export interface IntentBucket {
  key: string;
  label: string;
  icon: string;
  colorHex: string;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RaiseTicketModalComponent,
    TimeSeriesChartComponent,
    SentimentDonutChartComponent,
    SimpleDonutChartComponent,
    PlatformBarChartComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  showTicketModal = false;

  hasConnectedPlatforms = false;
  checkingPlatforms = true;

  // Impact analytics (only loaded when platforms are connected; stays false otherwise)
  loadingAnalytics = false;
  analyticsData: IAnalyticsDashboard | null = null;
  timeSeries: ITimeSeriesData[] = [];
  sentimentBreakdown: ISentimentBreakdown = { positive: 0, neutral: 0, negative: 0, total: 0 };
  platformMetrics: IPlatformMetrics[] = [];
  aiVsHuman: IAiVsHuman = { aiReplies: 0, humanReplies: 0, totalReplies: 0, aiPercent: 0 };
  intentBreakdown: IIntentBreakdown = { data: {}, total: 0 };

  aiHumanSegments: DonutSegment[] = [];
  intentBuckets: IntentBucket[] = [];

  private subscriptions: Subscription[] = [];

  readonly INTENT_CONFIG: Record<string, { label: string; icon: string; colorHex: string }> = {
    inquiry:   { label: 'Inquiry',   icon: 'fas fa-question-circle', colorHex: '#3B82F6' },
    complaint: { label: 'Complaint', icon: 'fas fa-exclamation-circle', colorHex: '#EF4444' },
    praise:    { label: 'Praise',    icon: 'fas fa-thumbs-up',       colorHex: '#22C55E' },
    feedback:  { label: 'Feedback',  icon: 'fas fa-comment-dots',    colorHex: '#F59E0B' },
    support:   { label: 'Support',   icon: 'fas fa-life-ring',       colorHex: '#8B5CF6' },
    other:     { label: 'Other',     icon: 'fas fa-ellipsis-h',      colorHex: '#6B7280' },
  };

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private router: Router,
    private http: HttpClient,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.checkPlatformConnections();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onTicketSubmitted(): void {
    this.showTicketModal = false;
    this.notify.success('Ticket submitted', 'Your support ticket has been raised successfully.');
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  navigateTo(route: string, queryParams?: Record<string, string>): void {
    if (queryParams) {
      this.router.navigate([route], { queryParams });
    } else {
      this.router.navigate([route]);
    }
  }

  private checkPlatformConnections(): void {
    this.checkingPlatforms = true;
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.hasConnectedPlatforms = response.data.some((p: any) => p.status === 'connected');
        }
        this.checkingPlatforms = false;
        if (this.hasConnectedPlatforms) {
          this.loadImpactData();
        } else {
          this.loadingAnalytics = false;
        }
      },
      error: () => {
        this.hasConnectedPlatforms = false;
        this.checkingPlatforms = false;
        this.loadingAnalytics = false;
      }
    });
  }

  private loadImpactData(): void {
    this.loadingAnalytics = true;
    // Backend invalidates Redis on interaction changes; clear client cache so counts/charts refresh on each visit.
    this.analyticsService.clearCache();
    const dateRange = this.analyticsService.getDateRangePreset('30days');

    const sub = this.analyticsService.getDashboard({ dateRange }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.analyticsData = response.data;
          this.timeSeries = response.data.timeSeries ?? [];
          this.sentimentBreakdown = response.data.sentimentBreakdown ?? this.sentimentBreakdown;
          this.platformMetrics = response.data.platformMetrics ?? [];
          this.aiVsHuman = response.data.aiVsHuman ?? this.aiVsHuman;
          this.intentBreakdown = response.data.intentBreakdown ?? this.intentBreakdown;
          this.buildChartSegments();
        }
        this.loadingAnalytics = false;
      },
      error: () => {
        this.loadingAnalytics = false;
      }
    });
    this.subscriptions.push(sub);
  }

  private buildChartSegments(): void {
    this.aiHumanSegments = [
      { label: 'AI Replies', value: this.aiVsHuman.aiReplies, color: '#8B5CF6' },
      { label: 'Human Replies', value: this.aiVsHuman.humanReplies, color: '#D8FF00' }
    ];

    const total = this.intentBreakdown.total || 1;
    const meta = this.intentBreakdown.meta ?? {};

    this.intentBuckets = Object.entries(this.intentBreakdown.data)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        // Prefer rich meta from backend (custom org buckets); fall back to client config for legacy intent strings
        const backendMeta: IIntentBucketMeta | undefined = meta[key];
        const clientCfg = this.INTENT_CONFIG[key.toLowerCase()];
        return {
          key,
          label:    backendMeta?.name     ?? clientCfg?.label    ?? (key.charAt(0).toUpperCase() + key.slice(1)),
          icon:     backendMeta?.icon     ?? clientCfg?.icon     ?? 'fas fa-tag',
          colorHex: backendMeta?.color    ?? clientCfg?.colorHex ?? '#6B7280',
          count,
          percent: Math.round((count / total) * 100)
        };
      });
  }

  formatResponseTime(minutes: number | undefined): string {
    if (minutes == null || minutes <= 0) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getChangeClass(change: number | undefined): string {
    if (!change) return '';
    return change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500';
  }

  getChangeIcon(change: number | undefined): string {
    if (!change) return '';
    return change > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
  }

  absValue(n: number | undefined): number {
    return Math.abs(n ?? 0);
  }
}
