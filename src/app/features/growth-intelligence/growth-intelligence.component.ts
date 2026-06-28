import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { catchError, finalize, of } from 'rxjs';
import {
  GrowthIntelligenceService, GIDashboard, TrendPoint, Recommendation, PlatformMetric
} from '../../core/services/growth-intelligence.service';

type TrendPeriod = 30 | 60 | 90;

@Component({
  selector: 'app-growth-intelligence',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DecimalPipe],
  templateUrl: './growth-intelligence.component.html',
  styleUrls: ['./growth-intelligence.component.scss']
})
export class GrowthIntelligenceComponent implements OnInit, OnDestroy {
  dashboard: GIDashboard | null = null;
  trends: TrendPoint[] = [];
  loading = true;
  loadingTrends = false;
  error = '';
  trendPeriod: TrendPeriod = 30;
  selectedDays = 30;

  private destroy$ = new Subject<void>();

  // SVG ring constants
  readonly RING_RADIUS = 70;
  readonly RING_CIRCUMFERENCE = 2 * Math.PI * this.RING_RADIUS;

  constructor(private giService: GrowthIntelligenceService) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadTrends();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';
    this.giService.getDashboard({ days: this.selectedDays, withAI: false })
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.error = err?.error?.error || 'Failed to load Growth Intelligence data.';
          return of(null);
        }),
        finalize(() => { this.loading = false; })
      )
      .subscribe(data => { this.dashboard = data; });
  }

  loadTrends(): void {
    this.loadingTrends = true;
    this.giService.getTrends(this.trendPeriod)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([])),
        finalize(() => { this.loadingTrends = false; })
      )
      .subscribe(t => { this.trends = t; });
  }

  readonly trendPeriods: TrendPeriod[] = [30, 60, 90];

  onTrendPeriodChange(days: number): void {
    this.trendPeriod = days as TrendPeriod;
    this.loadTrends();
  }

  onDaysChange(): void {
    this.loadDashboard();
  }

  // ── Score ring helpers ─────────────────────────────────────────────────────

  get scoreOffset(): number {
    const score = this.dashboard?.conversationScore ?? 0;
    return this.RING_CIRCUMFERENCE - (score / 100) * this.RING_CIRCUMFERENCE;
  }

  get scoreColor(): string {
    const s = this.dashboard?.conversationScore ?? 0;
    if (s >= 85) return '#D8FF00';  // rep-lime — A
    if (s >= 70) return '#84cc16';  // lime — B
    if (s >= 55) return '#eab308';  // yellow — C
    if (s >= 40) return '#f97316';  // orange — D
    return '#ef4444';               // red — F
  }

  // ── Trend chart helpers ───────────────────────────────────────────────────

  get trendPoints(): { x: number; y: number; score: number; date: string }[] {
    if (!this.trends.length) return [];
    const w = 400, h = 120, pad = 12;
    const scores  = this.trends.map(t => t.score);
    const minS    = Math.min(...scores, 0);
    const maxS    = Math.max(...scores, 100);
    const range   = maxS - minS || 1;
    return this.trends.map((t, i) => ({
      x: pad + (i / (this.trends.length - 1 || 1)) * (w - pad * 2),
      y: h - pad - ((t.score - minS) / range) * (h - pad * 2),
      score: t.score,
      date:  new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }));
  }

  get trendPolyline(): string {
    return this.trendPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  formatCurrency(n: number): string {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
  }

  formatTime(mins: number): string {
    if (!mins || mins <= 0) return '—';
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  platformIcon(p: string): string {
    const icons: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook:  'fab fa-facebook-f',
      whatsapp:  'fab fa-whatsapp',
      youtube:   'fab fa-youtube',
      google:    'fab fa-google',
      linkedin:  'fab fa-linkedin-in',
      email:     'fas fa-envelope',
    };
    return icons[p] || 'fas fa-globe';
  }

  platformLabel(p: string): string {
    const labels: Record<string, string> = {
      instagram: 'Instagram',
      facebook:  'Facebook',
      whatsapp:  'WhatsApp',
      youtube:   'YouTube',
      google:    'Google',
      linkedin:  'LinkedIn',
      email:     'Email',
    };
    return labels[p] || p;
  }

  benchmarkDelta(actual: number, benchmark: number): string {
    const d = Math.round(actual - benchmark);
    return d >= 0 ? `+${d}%` : `${d}%`;
  }

  benchmarkClass(actual: number, benchmark: number, lowerIsBetter = false): string {
    const better = lowerIsBetter ? actual < benchmark : actual >= benchmark;
    return better ? 'text-green-400' : 'text-red-400';
  }

  platformRateClass(rate: number): string {
    if (rate >= 70) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-red-400';
  }

  platformBarClass(rate: number): string {
    if (rate >= 70) return 'bg-green-500';
    if (rate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  priorityDotClass(priority: string): string {
    return {
      high: 'bg-red-500',
      medium: 'bg-orange-400',
      low: 'bg-green-500'
    }[priority] || 'bg-gray-500';
  }

  priorityBadgeClass(priority: string): string {
    return {
      high: 'bg-red-500/15 text-red-400',
      medium: 'bg-orange-500/15 text-orange-400',
      low: 'bg-green-500/15 text-green-400'
    }[priority] || 'bg-gray-500/15 text-gray-400';
  }

  trackByPlatform(_: number, p: PlatformMetric): string { return p.platform; }
  trackByRec(_: number, r: Recommendation): string { return r.title; }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
