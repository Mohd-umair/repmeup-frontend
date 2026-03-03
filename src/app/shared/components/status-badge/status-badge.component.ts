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
      approved: 'bg-green-500/20 text-green-400 border border-green-500/30',
      pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
      scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      ai_generated: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      draft: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
      published: 'bg-green-500/20 text-green-400 border border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border border-red-500/30'
    };
    return `${base} ${variants[this.status] ?? 'bg-gray-500/20 text-gray-400'}`;
  }
}
