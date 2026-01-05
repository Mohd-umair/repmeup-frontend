import { Component, EventEmitter, Output } from '@angular/core';
import { IInboxFilters, Platform, InteractionType, Sentiment, InteractionStatus } from '../../../core/models/interaction.model';

/**
 * Inbox Filters Component - Single Responsibility Principle
 * Handles filter selection for the inbox
 */
@Component({
  selector: 'app-inbox-filters',
  templateUrl: './inbox-filters.component.html',
  styleUrls: ['./inbox-filters.component.scss']
})
export class InboxFiltersComponent {
  @Output() filtersChange = new EventEmitter<IInboxFilters>();

  filters: IInboxFilters = {};

  platforms = [
    { value: Platform.INSTAGRAM, label: 'Instagram', icon: '📷' },
    { value: Platform.FACEBOOK, label: 'Facebook', icon: '👍' },
    { value: Platform.YOUTUBE, label: 'YouTube', icon: '🎥' },
    { value: Platform.GOOGLE, label: 'Google', icon: '🔍' },
    { value: Platform.WHATSAPP, label: 'WhatsApp', icon: '💬' }
  ];

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
        return 'bg-gradient-to-r from-green-50 to-blue-50 border-green-500 text-green-700 shadow-md';
      case Sentiment.NEGATIVE:
        return 'bg-gradient-to-r from-red-50 to-pink-50 border-red-500 text-red-700 shadow-md';
      default:
        return 'bg-gradient-to-r from-gray-50 to-blue-50 border-gray-500 text-gray-700 shadow-md';
    }
  }

  getStatusActiveClass(status: string): string {
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-500 text-yellow-700 shadow-md';
      case InteractionStatus.REPLIED:
        return 'bg-gradient-to-r from-green-50 to-blue-50 border-green-500 text-green-700 shadow-md';
      case InteractionStatus.RESOLVED:
        return 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-500 text-blue-700 shadow-md';
      default:
        return 'bg-gradient-to-r from-primary-50 to-purple-50 border-primary-500 text-primary-700 shadow-md';
    }
  }
}
