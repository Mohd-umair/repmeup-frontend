import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-automation-kpi-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 flex flex-col gap-2 hover:border-[var(--accent)] transition-colors">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{{ label }}</span>
        <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" [ngClass]="iconBg">
          <i [class]="icon" [ngClass]="iconColor"></i>
        </span>
      </div>
      <div class="text-2xl font-bold text-[var(--text-primary)]">
        <span *ngIf="prefix">{{ prefix }}</span>{{ loading ? '—' : value }}
        <span *ngIf="suffix" class="text-sm font-normal text-[var(--text-muted)]">{{ suffix }}</span>
      </div>
      <div *ngIf="!loading" class="flex items-center gap-1 text-xs">
        <span [class]="change >= 0 ? 'text-emerald-500' : 'text-red-500'">
          <i [class]="change >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
          {{ change | number:'1.0-0' }}%
        </span>
        <span class="text-[var(--text-muted)]">vs last week</span>
      </div>
      <div *ngIf="loading" class="h-4 rounded bg-[var(--border-color)] animate-pulse w-1/2"></div>
    </div>
  `
})
export class AutomationKpiTileComponent {
  @Input() label = '';
  @Input() value: number | string = 0;
  @Input() change = 0;
  @Input() icon = 'fas fa-chart-bar';
  @Input() iconBg = 'bg-blue-100 dark:bg-blue-900/30';
  @Input() iconColor = 'text-blue-600';
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() loading = false;
}
