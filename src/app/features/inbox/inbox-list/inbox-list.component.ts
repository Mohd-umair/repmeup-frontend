import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IInteraction, Platform } from '../../../core/models/interaction.model';

/**
 * Inbox List Component - Single Responsibility Principle
 * Displays list of interactions
 */
@Component({
  selector: 'app-inbox-list',
  templateUrl: './inbox-list.component.html',
  styleUrls: ['./inbox-list.component.scss']
})
export class InboxListComponent {
  @Input() interactions: IInteraction[] = [];
  @Input() loading = false;
  @Input() selectedInteraction: IInteraction | null = null;
  @Output() interactionSelect = new EventEmitter<IInteraction>();

  selectInteraction(interaction: IInteraction): void {
    this.interactionSelect.emit(interaction);
  }

  isSelected(interaction: IInteraction): boolean {
    return this.selectedInteraction?._id === interaction._id;
  }

  getSentimentClass(sentiment?: string): string {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getSentimentIcon(sentiment?: string): string {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😟';
      default:
        return '😐';
    }
  }

  getPlatformIcon(platform: Platform): string {
    const icons: { [key in Platform]: string } = {
      [Platform.INSTAGRAM]: '📷',
      [Platform.FACEBOOK]: '👍',
      [Platform.YOUTUBE]: '🎥',
      [Platform.GOOGLE]: '🔍',
      [Platform.WHATSAPP]: '💬',
      [Platform.WEBSITE]: '🌐'
    };
    return icons[platform] || '📱';
  }

  getTypeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }
}
