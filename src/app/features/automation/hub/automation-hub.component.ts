import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AutomationHubService, IHubOverview } from '../../../core/services/automation-hub.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';

import { formatInrCompact } from '../../../core/utils/currency-format';

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  instagram: { icon: 'fab fa-instagram', color: 'text-pink-500' },
  facebook:  { icon: 'fab fa-facebook',  color: 'text-blue-600' },
  whatsapp:  { icon: 'fab fa-whatsapp',  color: 'text-emerald-500' },
  google:    { icon: 'fab fa-google',    color: 'text-red-500' },
  youtube:   { icon: 'fab fa-youtube',   color: 'text-red-600' },
  email:     { icon: 'fas fa-envelope',  color: 'text-blue-500' },
};

const MODULE_STYLES: Record<string, { iconBg: string; iconClass: string }> = {
  'ai-replies':      { iconBg: 'rgba(59,130,246,0.12)',  iconClass: 'text-blue-500' },
  'growth':          { iconBg: '#d8ff00',               iconClass: 'text-[#0b0b0b]' },
  'whatsapp-flows':  { iconBg: 'rgba(16,185,129,0.12)', iconClass: 'text-emerald-500' },
  'reviews':         { iconBg: 'rgba(245,158,11,0.12)', iconClass: 'text-amber-500' },
  'retargeting':     { iconBg: 'rgba(168,85,247,0.12)', iconClass: 'text-purple-500' },
  'escalation':      { iconBg: 'rgba(239,68,68,0.12)',  iconClass: 'text-red-500' },
};

const DEFAULT_MODULE_STYLE = { iconBg: 'var(--surface-primary)', iconClass: 'text-gray-500' };

@Component({
  selector: 'app-automation-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, AutomationPageShellComponent],
  templateUrl: './automation-hub.component.html',
  styleUrls: ['./automation-hub.component.scss']
})
export class AutomationHubComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  overview: IHubOverview | null = null;
  error = '';

  constructor(private hubService: AutomationHubService) {}

  ngOnInit(): void {
    this.hubService.getHubOverview()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: r => { this.overview = r.data ?? null; },
        error: () => { this.error = 'Failed to load Automation Hub data.'; }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  platformIcon(platform: string): string {
    return PLATFORM_ICONS[platform]?.icon ?? 'fas fa-circle';
  }

  platformColor(platform: string): string {
    return PLATFORM_ICONS[platform]?.color ?? 'text-gray-400';
  }

  relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  formatRevenue(value: number | null | undefined): string {
    return formatInrCompact(value ?? 0);
  }

  moduleStyle(id: string): { iconBg: string; iconClass: string } {
    return MODULE_STYLES[id] ?? DEFAULT_MODULE_STYLE;
  }

  formatKpiChange(change: number | null | undefined): string {
    const n = change ?? 0;
    const prefix = n > 0 ? '+' : '';
    return `${prefix}${n}%`;
  }

  /** invertGood: lower change is better (escalations). */
  kpiChangeColor(change: number | null | undefined, invertGood: boolean): string {
    const n = change ?? 0;
    const positive = invertGood ? n <= 0 : n >= 0;
    return positive ? '#16a34a' : '#dc2626';
  }

  trackByModule(i: number, m: { id: string }): string { return m.id; }
  trackByActivity(i: number, a: { updatedAt: string }): string { return a.updatedAt; }
}
