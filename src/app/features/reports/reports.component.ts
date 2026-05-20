import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import {
  NumberReportService,
  NumberReport,
  VolumeDayPoint,
  TemplateStat,
  RecentCampaign
} from '../../core/services/number-report.service';
import { PlatformService, PlatformConnection } from '../../core/services/platform.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  connections: PlatformConnection[] = [];
  connectionsLoading = true;
  selectedConnectionId = '';

  days = 30;
  readonly dayOptions = [
    { value: 7,  label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 60, label: 'Last 60 days' },
    { value: 90, label: 'Last 90 days' }
  ];

  report: NumberReport | null = null;
  loading = false;
  error = '';

  constructor(
    private reportService: NumberReportService,
    private platformService: PlatformService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadConnections();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadConnections(): void {
    this.connectionsLoading = true;
    this.platformService.getPlatformConnections()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.connectionsLoading = false)))
      .subscribe({
        next: r => {
          this.connections = (r.data || []).filter(c => c.platform === 'whatsapp' && c.isActive);
          if (this.connections.length > 0) {
            this.selectedConnectionId = this.connections[0]._id;
            this.loadReport();
          }
        },
        error: () => this.notify.error('Failed to load WhatsApp numbers')
      });
  }

  loadReport(): void {
    if (!this.selectedConnectionId) return;
    this.loading = true;
    this.error = '';
    this.report = null;
    this.reportService.getReport(this.selectedConnectionId, this.days)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.loading = false)))
      .subscribe({
        next: r => { this.report = r.report; },
        error: err => {
          this.error = err?.error?.error || 'Failed to load report';
          this.notify.error(this.error);
        }
      });
  }

  onConnectionChange(): void { this.loadReport(); }
  onDaysChange(): void { this.loadReport(); }

  // ── Chart helpers ──────────────────────────────────────────────────────────

  get maxVolume(): number {
    if (!this.report) return 1;
    return Math.max(1, ...this.report.volumeTimeSeries.map(d => d.inbound + d.outbound));
  }

  barHeight(val: number): number {
    return Math.round((val / this.maxVolume) * 100);
  }

  get volumeLabels(): string[] {
    if (!this.report) return [];
    const pts = this.report.volumeTimeSeries;
    const step = Math.max(1, Math.floor(pts.length / 8));
    return pts.map((p, i) => (i % step === 0 ? p.date.slice(5) : ''));
  }

  get sentimentTotal(): number {
    const s = this.report?.sentimentBreakdown;
    if (!s) return 1;
    return Math.max(1, s.positive + s.neutral + s.negative);
  }

  sentimentPct(key: 'positive' | 'neutral' | 'negative'): number {
    const s = this.report?.sentimentBreakdown;
    if (!s) return 0;
    return Math.round((s[key] / this.sentimentTotal) * 100);
  }

  get campaignStatuses(): { key: string; label: string; color: string }[] {
    return [
      { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
      { key: 'running',   label: 'Running',   color: 'bg-green-400' },
      { key: 'failed',    label: 'Failed',    color: 'bg-red-500' },
      { key: 'paused',    label: 'Paused',    color: 'bg-yellow-500' },
      { key: 'draft',     label: 'Draft',     color: 'bg-gray-500' },
      { key: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
      { key: 'cancelled', label: 'Cancelled', color: 'bg-red-300' }
    ];
  }

  getCampaignCount(key: string): number {
    return this.report?.campaignBreakdown?.[key]?.count || 0;
  }

  funnelPct(val: number): number {
    const total = this.report?.conversationFunnel?.total || 1;
    return Math.round((val / total) * 100);
  }

  getConnectionDisplay(c: PlatformConnection): string {
    const phone = c.platformData?.displayPhoneNumber || c.platformData?.phoneNumber;
    const name = c.platformDisplayName || c.platformUsername;
    return phone ? `${name ? name + ' · ' : ''}${phone}` : (name || c._id);
  }

  campaignStatusBadge(status: string): string {
    const map: Record<string, string> = {
      draft:      'bg-gray-500/20 text-gray-400',
      scheduled:  'bg-blue-500/20 text-blue-400',
      running:    'bg-green-500/20 text-green-400',
      paused:     'bg-yellow-500/20 text-yellow-400',
      completed:  'bg-emerald-500/20 text-emerald-400',
      cancelled:  'bg-red-500/20 text-red-400',
      failed:     'bg-red-700/20 text-red-500'
    };
    return map[status] || 'bg-gray-500/20 text-gray-400';
  }

  deliveryRateColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-400';
    if (rate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  }
}
