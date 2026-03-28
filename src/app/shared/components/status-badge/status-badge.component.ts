import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusBadgeType = 'approved' | 'pending' | 'rejected' | 'scheduled' | 'ai_generated' | 'draft' | 'published' | 'failed';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status!: StatusBadgeType;
  @Input() label?: string;

  get displayLabel(): string {
    if (this.label != null) return this.label;
    const map: Record<StatusBadgeType, string> = {
      approved: 'Approved',
      pending: 'Pending',
      rejected: 'Rejected',
      scheduled: 'Scheduled',
      ai_generated: 'AI Generated',
      draft: 'Draft',
      published: 'Published',
      failed: 'Failed'
    };
    return map[this.status] ?? this.status;
  }

  get badgeClasses(): string {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
    const variants: Record<StatusBadgeType, string> = {
      approved:
        'bg-green-100 text-green-800 border border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
      pending:
        'bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
      rejected:
        'bg-red-100 text-red-800 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
      scheduled:
        'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
      ai_generated:
        'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
      draft:
        'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30',
      published:
        'bg-green-100 text-green-800 border border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
      failed:
        'bg-red-100 text-red-800 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
    };
    return `${base} ${variants[this.status] ?? 'bg-gray-500/20 text-gray-400'}`;
  }
}
