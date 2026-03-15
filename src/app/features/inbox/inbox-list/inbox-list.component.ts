import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IInteraction, Platform } from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';

/**
 * Inbox List Component - Single Responsibility Principle
 * Displays list of interactions
 */
@Component({
  selector: 'app-inbox-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inbox-list.component.html',
  styleUrls: ['./inbox-list.component.scss']
})
export class InboxListComponent implements OnInit, OnDestroy {
  @Input() interactions: IInteraction[] = [];
  @Input() loading = false;
  @Input() selectedInteraction: IInteraction | null = null;
  @Input() selectedIds: Set<string> = new Set();
  @Output() interactionSelect = new EventEmitter<IInteraction>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<Set<string>>();

  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  /** Tracks avatar load errors so we can show initial fallback */
  avatarFallback: Record<string, boolean> = {};

  constructor(
    public themeService: ThemeService,
    private sanitizer: DomSanitizer
  ) {}

  onAvatarError(key: string): void {
    this.avatarFallback = { ...this.avatarFallback, [key]: true };
  }

  /** Profile picture URL for author. For Facebook, use proxy so image loads with token. */
  getAuthorAvatarUrl(author: IInteraction['author'], platform?: string): string | null {
    if (platform === 'facebook' && author?.platformId) {
      return `${environment.apiUrl}/inbox/avatar/facebook/${author.platformId}`;
    }
    return author?.avatarUrl || author?.profilePicture || null;
  }

  /** Display name with platform fallback when profile isn't available (e.g. Instagram without Advanced Access). */
  getAuthorDisplayName(interaction: IInteraction): string {
    const name = interaction?.author?.name || interaction?.author?.username;
    if (name) return name;
    if (interaction?.platform === 'instagram') return 'Instagram User';
    if (interaction?.platform === 'facebook') return 'Messenger User';
    return 'Unknown';
  }

  /** Safe URL for img [src] so external CDN avatars load. */
  getAuthorAvatarSafeUrl(author: IInteraction['author'], platform?: string): SafeUrl | null {
    const url = this.getAuthorAvatarUrl(author, platform);
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : null;
  }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchChange.emit(searchTerm);
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.searchSubject.complete();
  }

  selectInteraction(interaction: IInteraction): void {
    this.interactionSelect.emit(interaction);
  }

  isBulkSelected(interaction: IInteraction): boolean {
    return this.selectedIds.has(interaction._id);
  }

  toggleBulkSelection(interaction: IInteraction, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.selectedIds);
    if (next.has(interaction._id)) {
      next.delete(interaction._id);
    } else {
      next.add(interaction._id);
    }
    this.selectionChange.emit(next);
  }

  selectAllOnPage(): void {
    const next = new Set(this.interactions.map(i => i._id));
    this.selectionChange.emit(next);
  }

  clearSelection(): void {
    this.selectionChange.emit(new Set());
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

  /** Star rating for reviews (Google Business etc.); undefined if not a review or no rating */
  getReviewRating(interaction: IInteraction): number | undefined {
    const r = (interaction as any).rating ?? interaction.metadata?.starRating;
    if (r == null || typeof r !== 'number') return undefined;
    return Math.min(5, Math.max(1, Math.round(r)));
  }

  /** Default SLA: 24 hours. Show "Not Replied", "Overdue by Xh/Xd", or "Replied in Xm/Xd" */
  getSlaLabel(interaction: IInteraction): string | null {
    const SLA_MINUTES = 24 * 60;
    const MINS_PER_DAY = 24 * 60;
    const created = new Date(interaction.platformCreatedAt).getTime();
    const now = Date.now();
    const elapsedMs = now - created;
    const elapsedMins = Math.floor(elapsedMs / 60000);

    const formatDuration = (mins: number): string => {
      if (mins < 60) return `${mins}m`;
      if (mins < MINS_PER_DAY) return `${Math.floor(mins / 60)}h`;
      return `${Math.floor(mins / MINS_PER_DAY)}d`;
    };

    if (interaction.respondedAt) {
      const responseMins = Math.floor((new Date(interaction.respondedAt).getTime() - created) / 60000);
      if (responseMins < 0) return 'Replied'; // reply was before displayed thread time (e.g. new message updated thread)
      return `Replied in ${formatDuration(responseMins)}`;
    }

    if (elapsedMins >= SLA_MINUTES) {
      const overdueMins = elapsedMins - SLA_MINUTES;
      return `Overdue by ${formatDuration(overdueMins)}`;
    }

    return 'Not Replied';
  }

  /** True if interaction is overdue (unreplied, past SLA) */
  isOverdue(interaction: IInteraction): boolean {
    const SLA_MINUTES = 24 * 60;
    if (interaction.respondedAt) return false;
    const created = new Date(interaction.platformCreatedAt).getTime();
    const elapsedMins = (Date.now() - created) / 60000;
    return elapsedMins >= SLA_MINUTES;
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

  /**
   * Get platform-specific colors for each interaction
   */
  getPlatformColors(platform: string): any {
    const theme = this.themeService.getTheme(platform);
    return {
      primary: theme.primaryColor,
      secondary: theme.secondaryColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo,
      border: theme.borderColor,
      bg: theme.backgroundColor
    };
  }
}
