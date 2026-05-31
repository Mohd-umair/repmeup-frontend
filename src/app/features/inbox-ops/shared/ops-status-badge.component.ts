import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ops-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" [ngClass]="classes">
      {{ label }}
    </span>
  `
})
export class OpsStatusBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() tone: string = 'neutral';

  get classes(): string {
    switch (this.tone) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
      case 'danger':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case 'info':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }
}
