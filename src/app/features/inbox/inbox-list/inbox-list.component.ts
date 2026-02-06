import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IInteraction, Platform } from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';
import { AvatarService } from '../../../core/services/avatar.service';

/**
 * Inbox List Component - Single Responsibility Principle
 * Displays list of interactions
 */
@Component({
  selector: 'app-inbox-list',
  templateUrl: './inbox-list.component.html',
  styleUrls: ['./inbox-list.component.scss']
})
export class InboxListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() interactions: IInteraction[] = [];
  @Input() loading = false;
  @Input() selectedInteraction: IInteraction | null = null;
  @Output() interactionSelect = new EventEmitter<IInteraction>();
  @Output() searchChange = new EventEmitter<string>();

  searchTerm = '';
  private searchSubject = new Subject<string>();
  /** Tracks avatar load errors so we can show initial fallback */
  avatarFallback: Record<string, boolean> = {};
  /** Resolved avatar blob URLs from proxy (Instagram/Facebook), keyed by interaction.platformId */
  avatarUrls: Record<string, string> = {};
  private avatarCacheKeys = new Set<string>();

  constructor(
    public themeService: ThemeService,
    private avatarService: AvatarService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interactions'] && this.interactions?.length) {
      this.loadAvatars();
    }
  }

  private loadAvatars(): void {
    for (const i of this.interactions) {
      if ((i.platform === 'instagram' || i.platform === 'facebook') && i.author?.platformId && !this.avatarUrls[i.platformId]) {
        const cacheKey = this.avatarService.getCacheKey(i.platform, i.author.platformId);
        const interactionPlatformId = i.platformId;
        this.avatarCacheKeys.add(cacheKey);
        this.avatarService.getAvatarUrl(i.platform, i.author.platformId).subscribe(url => {
          if (url) this.avatarUrls = { ...this.avatarUrls, [interactionPlatformId]: url };
        });
      }
    }
  }

  onAvatarError(key: string): void {
    this.avatarFallback = { ...this.avatarFallback, [key]: true };
  }

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
    this.avatarCacheKeys.forEach(key => this.avatarService.revoke(key));
    this.avatarCacheKeys.clear();
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

  /** Star rating for reviews (Google Business etc.); undefined if not a review or no rating */
  getReviewRating(interaction: IInteraction): number | undefined {
    const r = (interaction as any).rating ?? interaction.metadata?.starRating;
    if (r == null || typeof r !== 'number') return undefined;
    return Math.min(5, Math.max(1, Math.round(r)));
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
