import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IInboxFilters, InteractionType, Sentiment, InteractionStatus, ILabel } from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Inbox Top Filters Component
 * Handles Type, Sentiment, Status, and Labels filters in the top bar
 */
@Component({
  selector: 'app-inbox-top-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inbox-top-filters.component.html',
  styleUrls: ['./inbox-top-filters.component.scss']
})
export class InboxTopFiltersComponent implements OnChanges {
  @Output() filtersChange = new EventEmitter<IInboxFilters>();
  @Input() initialFilters: IInboxFilters = {};
  @Input() labels: ILabel[] = [];

  filters: IInboxFilters = {};
  expanded = false;

  constructor(public themeService: ThemeService) {}

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilters'] && this.initialFilters && Object.keys(this.initialFilters).length > 0) {
      this.filters = { ...this.initialFilters };
    }
  }

  types = [
    { value: InteractionType.COMMENT, label: 'Comments', icon: '💬' },
    { value: InteractionType.DM, label: 'Direct Messages', icon: '📧' },
    { value: InteractionType.REVIEW, label: 'Reviews', icon: '⭐' },
    { value: InteractionType.MENTION, label: 'Mentions', icon: '@' }
  ];

  sentiments = [
    { value: Sentiment.POSITIVE, label: 'Positive', color: 'bg-green-100 text-green-800', icon: '😊' },
    { value: Sentiment.NEUTRAL, label: 'Neutral', color: 'bg-gray-100 text-gray-800', icon: '😐' },
    { value: Sentiment.NEGATIVE, label: 'Negative', color: 'bg-red-100 text-red-800', icon: '😟' }
  ];

  statuses = [
    { value: InteractionStatus.UNREAD, label: 'Unread', icon: '📩' },
    { value: InteractionStatus.READ, label: 'Read', icon: '📖' },
    { value: InteractionStatus.REPLIED, label: 'Replied', icon: '✅' },
    { value: InteractionStatus.ASSIGNED, label: 'Assigned', icon: '👤' },
    { value: InteractionStatus.RESOLVED, label: 'Resolved', icon: '✔️' }
  ];

  toggleFilter(filterType: keyof IInboxFilters, value: any): void {
    if (this.filters[filterType] === value) {
      delete this.filters[filterType];
    } else {
      this.filters[filterType] = value;
    }
    this.emitFilters();
  }

  isFilterActive(filterType: keyof IInboxFilters, value: any): boolean {
    return this.filters[filterType] === value;
  }

  clearFilters(): void {
    this.filters = {};
    this.emitFilters();
  }

  private emitFilters(): void {
    this.filtersChange.emit({ ...this.filters });
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return Object.keys(this.filters).length > 0;
  }

  /**
   * Get count of active filters (for collapsed badge)
   */
  getActiveFilterCount(): number {
    return Object.keys(this.filters).length;
  }

  /**
   * Get sentiment background gradient
   */
  getSentimentBackground(sentiment: string, isActive: boolean): string {
    if (!isActive) return 'white';
    
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return 'linear-gradient(135deg, #10B981, #059669)'; // Green
      case Sentiment.NEGATIVE:
        return 'linear-gradient(135deg, #EF4444, #DC2626)'; // Red
      default:
        return 'linear-gradient(135deg, #6B7280, #4B5563)'; // Gray
    }
  }

  /**
   * Get sentiment hover background
   */
  getSentimentHoverBackground(sentiment: string): string {
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return 'linear-gradient(to right, #D1FAE5, #A7F3D0)';
      case Sentiment.NEGATIVE:
        return 'linear-gradient(to right, #FEE2E2, #FECACA)';
      default:
        return 'linear-gradient(to right, #F3F4F6, #E5E7EB)';
    }
  }

  /**
   * Get sentiment shadow
   */
  getSentimentShadow(sentiment: string, isActive: boolean): string {
    if (!isActive) return '0 1px 3px rgba(0,0,0,0.1)';
    
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return '0 4px 12px rgba(16, 185, 129, 0.4)';
      case Sentiment.NEGATIVE:
        return '0 4px 12px rgba(239, 68, 68, 0.4)';
      default:
        return '0 4px 12px rgba(107, 114, 128, 0.4)';
    }
  }

  /**
   * Get status background gradient
   */
  getStatusBackground(status: string, isActive: boolean): string {
    if (!isActive) return 'white';
    
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'linear-gradient(135deg, #F59E0B, #D97706)'; // Amber
      case InteractionStatus.READ:
        return 'linear-gradient(135deg, #3B82F6, #2563EB)'; // Blue
      case InteractionStatus.REPLIED:
        return 'linear-gradient(135deg, #10B981, #059669)'; // Green
      case InteractionStatus.ASSIGNED:
        return 'linear-gradient(135deg, #8B5CF6, #7C3AED)'; // Purple
      case InteractionStatus.RESOLVED:
        return 'linear-gradient(135deg, #14B8A6, #0D9488)'; // Teal
      default:
        return 'linear-gradient(135deg, #6B7280, #4B5563)'; // Gray
    }
  }

  /**
   * Get status hover background
   */
  getStatusHoverBackground(status: string): string {
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'linear-gradient(to right, #FEF3C7, #FDE68A)';
      case InteractionStatus.READ:
        return 'linear-gradient(to right, #DBEAFE, #BFDBFE)';
      case InteractionStatus.REPLIED:
        return 'linear-gradient(to right, #D1FAE5, #A7F3D0)';
      case InteractionStatus.ASSIGNED:
        return 'linear-gradient(to right, #EDE9FE, #DDD6FE)';
      case InteractionStatus.RESOLVED:
        return 'linear-gradient(to right, #CCFBF1, #99F6E4)';
      default:
        return 'linear-gradient(to right, #F3F4F6, #E5E7EB)';
    }
  }

  /**
   * Get status shadow
   */
  getStatusShadow(status: string, isActive: boolean): string {
    if (!isActive) return '0 1px 3px rgba(0,0,0,0.1)';
    
    switch (status) {
      case InteractionStatus.UNREAD:
        return '0 4px 12px rgba(245, 158, 11, 0.4)';
      case InteractionStatus.READ:
        return '0 4px 12px rgba(59, 130, 246, 0.4)';
      case InteractionStatus.REPLIED:
        return '0 4px 12px rgba(16, 185, 129, 0.4)';
      case InteractionStatus.ASSIGNED:
        return '0 4px 12px rgba(139, 92, 246, 0.4)';
      case InteractionStatus.RESOLVED:
        return '0 4px 12px rgba(20, 184, 166, 0.4)';
      default:
        return '0 4px 12px rgba(107, 114, 128, 0.4)';
    }
  }
}

