import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeStatus = 'active' | 'inactive' | 'draft' | 'paused' | 'archived' | string;

@Component({
  selector: 'app-automation-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" [ngClass]="classes">
      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="dotClass"></span>
      {{ label || status | titlecase }}
    </span>
  `
})
export class AutomationStatusBadgeComponent {
  @Input() status: BadgeStatus = 'inactive';
  @Input() label = '';

  get classes(): string {
    switch (this.status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'paused': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'draft':  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      case 'archived': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
      default:       return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
    }
  }

  get dotClass(): string {
    switch (this.status) {
      case 'active': return 'bg-emerald-500';
      case 'paused': return 'bg-yellow-500';
      default:       return 'bg-gray-400';
    }
  }
}
