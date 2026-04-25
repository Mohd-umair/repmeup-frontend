import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { IInboxFilters, Platform, InteractionType, Sentiment, InteractionStatus, ILabel } from '../../../core/models/interaction.model';

/**
 * Inbox Filters Component - Single Responsibility Principle
 * Handles filter selection for the inbox
 */
@Component({
  selector: 'app-inbox-filters',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inbox-filters.component.html',
  styleUrls: ['./inbox-filters.component.scss']
})
export class InboxFiltersComponent {
  @Output() filtersChange = new EventEmitter<IInboxFilters>();
  @Input() inline = false;
  @Input() showLabel = true;
  @Input() labels: ILabel[] = []; // Organization labels for filtering
  @Input() platformOnly = false; // When true, only show platform buttons (no More Filters)

  filters: IInboxFilters = {};
  showMoreFilters = false; // Toggle for more filters section
  
  constructor(public themeService: ThemeService) {}

  toggleMoreFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
  }

  hasActiveAdvancedFilters(): boolean {
    return !!(this.filters.label || this.filters.type || this.filters.sentiment || this.filters.status);
  }

  platforms = [
    { value: Platform.INSTAGRAM, label: 'Instagram', icon: 'fab fa-instagram', color: 'text-pink-600', bgColor: '#E4405F', gradientFrom: '#833AB4', gradientTo: '#FD1D1D' },
    { value: Platform.FACEBOOK, label: 'Facebook', icon: 'fab fa-facebook-f', color: 'text-blue-600', bgColor: '#1877F2', gradientFrom: '#1877F2', gradientTo: '#0C63D4' },
    { value: Platform.YOUTUBE, label: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', bgColor: '#FF0000', gradientFrom: '#FF0000', gradientTo: '#CC0000' },
    { value: Platform.GOOGLE, label: 'Google', icon: 'fab fa-google', color: 'text-blue-500', bgColor: '#4285F4', gradientFrom: '#4285F4', gradientTo: '#34A853' },
    { value: Platform.LINKEDIN, label: 'LinkedIn', icon: 'fab fa-linkedin', color: 'text-blue-700', bgColor: '#0A66C2', gradientFrom: '#0A66C2', gradientTo: '#004182' },
    { value: Platform.WHATSAPP, label: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-green-500', bgColor: '#25D366', gradientFrom: '#25D366', gradientTo: '#128C7E' }
    // { value: Platform.EMAIL, ... } — re-enable when email integration is turned on in Settings
  ];

  types = [
    { value: InteractionType.COMMENT, label: 'Comments', icon: '💬' },
    { value: InteractionType.DM, label: 'Direct Messages', icon: '📧' },
    { value: InteractionType.REVIEW, label: 'Reviews', icon: '⭐' },
    { value: InteractionType.MENTION, label: 'Mentions', icon: '@' }
    // { value: InteractionType.EMAIL, label: 'Emails', icon: '✉️' } — re-enable with email integration
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

  clearPlatformFilters(): void {
    delete this.filters.platform;
    this.emitFilters();
  }

  clearLabelFilters(): void {
    delete this.filters.label;
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
