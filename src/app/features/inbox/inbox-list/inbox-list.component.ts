import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
export class InboxListComponent implements OnInit, OnDestroy {
  @Input() interactions: IInteraction[] = [];
  @Input() loading = false;
  @Input() selectedInteraction: IInteraction | null = null;
  @Output() interactionSelect = new EventEmitter<IInteraction>();
  @Output() searchChange = new EventEmitter<string>();

  searchTerm = '';
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Set up debounced search
    this.searchSubject.pipe(
      debounceTime(400), // Wait 400ms after user stops typing
      distinctUntilChanged() // Only emit if value has changed
    ).subscribe(searchTerm => {
      this.searchChange.emit(searchTerm);
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  selectInteraction(interaction: IInteraction): void {
    this.interactionSelect.emit(interaction);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    // Push to subject for debounced search
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
  }

  isSelected(interaction: IInteraction): boolean {
    return this.selectedInteraction?._id === interaction._id;
  }

  getSentimentClass(sentiment?: string): string {
    switch (sentiment) {
      case 'positive':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      case 'negative':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
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
      [Platform.LINKEDIN]: '💼',
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
