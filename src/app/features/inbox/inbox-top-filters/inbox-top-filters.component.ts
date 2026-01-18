import { Component, EventEmitter, Output } from '@angular/core';
import { IInboxFilters, InteractionType, Sentiment, InteractionStatus } from '../../../core/models/interaction.model';

/**
 * Inbox Top Filters Component
 * Handles Type, Sentiment, and Status filters in the top bar
 */
@Component({
  selector: 'app-inbox-top-filters',
  templateUrl: './inbox-top-filters.component.html',
  styleUrls: ['./inbox-top-filters.component.scss']
})
export class InboxTopFiltersComponent {
  @Output() filtersChange = new EventEmitter<IInboxFilters>();

  filters: IInboxFilters = {};

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

  getSentimentActiveClass(sentiment: string): string {
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return 'bg-rep-lime/20 border-rep-lime text-rep-black shadow-md';
      case Sentiment.NEGATIVE:
        return 'bg-gray-100 border-gray-400 text-gray-800 shadow-md';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-800 shadow-md';
    }
  }

  getStatusActiveClass(status: string): string {
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'bg-gray-100 border-gray-400 text-gray-800 shadow-md';
      case InteractionStatus.REPLIED:
        return 'bg-rep-lime/20 border-rep-lime text-rep-black shadow-md';
      case InteractionStatus.RESOLVED:
        return 'bg-rep-lime/20 border-rep-lime text-rep-black shadow-md';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-800 shadow-md';
    }
  }
}

