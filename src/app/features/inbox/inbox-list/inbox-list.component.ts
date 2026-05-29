import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IInteraction, IReply, Platform } from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';
import { AppearanceService } from '../../../core/services/appearance.service';
import { InboxAvatarService } from '../../../core/services/inbox-avatar.service';
import { looksLikeAttachmentFilename, isUnsupportedWhatsAppIncoming } from '../../../core/utils/inbox-attachment-display';

/**
 * Inbox List Component - Single Responsibility Principle
 * Displays list of interactions
 */
@Component({
  selector: 'app-inbox-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inbox-list.component.html',
  styleUrls: ['./inbox-list.component.scss']
})
export class InboxListComponent implements OnInit, OnDestroy {
  @Input() interactions: IInteraction[] = [];
  @Input() loading = false;
  @Input() loadingMore = false;
  /** Whether another page of chats exists after the current loaded slice (from API pagination.hasMore). */
  @Input() hasMore = false;
  /** Total matching conversations on the server (for footer hint). */
  @Input() totalConversations = 0;
  @Input() showSearch = false;
  @Input() selectedInteraction: IInteraction | null = null;
  @Input() selectedIds: Set<string> = new Set();
  @Output() interactionSelect = new EventEmitter<IInteraction>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<Set<string>>();
  /** Fired when the user scrolls near the bottom (lazy-load next page). */
  @Output() loadMore = new EventEmitter<void>();
  /** Fired when the user clicks the empty-state Refresh button. */
  @Output() refreshRequested = new EventEmitter<void>();

  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  /** Tracks avatar load errors so we can show initial fallback */
  avatarFallback: Record<string, boolean> = {};
  /** Debounces repeated scroll-bottom firing while the parent loads more rows */
  private loadMoreCooldownUntil = 0;

  /** WhatsApp Business profile image in platform badge — hide on load error */
  platformBadgeImgError: Record<string, boolean> = {};

  constructor(
    public themeService: ThemeService,
    private appearance: AppearanceService,
    private sanitizer: DomSanitizer,
    private avatarService: InboxAvatarService
  ) {}

  onAvatarError(key: string): void {
    this.avatarFallback = { ...this.avatarFallback, [key]: true };
  }

  onPlatformBadgeImgError(platformId: string): void {
    if (!platformId) return;
    this.platformBadgeImgError = { ...this.platformBadgeImgError, [platformId]: true };
  }

  /** Returns up to 2 initials from the author's display name: "John Doe" → "JD", "John" → "JO". */
  getAuthorInitials(interaction: IInteraction): string {
    const name = this.getAuthorDisplayName(interaction);
    if (!name || name === 'Unknown') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Observable avatar URL (fetched with auth for Facebook so img can display). */
  getAuthorAvatar$(author: IInteraction['author'], platform?: string, pageId?: string, threadPlatformId?: string): Observable<SafeUrl | null> {
    return this.avatarService.getAvatarUrl(platform ?? '', author, pageId, threadPlatformId).pipe(
      map(url => (url ? this.sanitizer.bypassSecurityTrustUrl(url) : null))
    );
  }

  /** Display name with platform fallback when profile isn't available (e.g. Instagram without Advanced Access). */
  getAuthorDisplayName(interaction: IInteraction): string {
    const name = interaction?.author?.name || interaction?.author?.username;
    if (name) return name;
    if (interaction?.platform === 'instagram') return 'Instagram User';
    if (interaction?.platform === 'facebook') return 'Messenger User';
    if (interaction?.platform === 'email') {
      return interaction?.author?.email || (interaction.metadata as any)?.email?.from?.address || 'Email Sender';
    }
    return 'Unknown';
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

  /**
   * trackBy for the conversation *ngFor — without this, every polling tick / socket event
   * rebuilds every row from scratch (avatars reload, DOM thrashes, scroll position jumps).
   * Keying on `_id` lets Angular update in place.
   */
  trackByInteractionId(_: number, interaction: IInteraction): string {
    return interaction._id;
  }

  trackByLabelId(_: number, label: { _id: string }): string {
    return label._id;
  }

  /** Infinite scroll: request next page when near bottom */
  onListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const thresholdPx = 100;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > thresholdPx) return;
    if (!this.hasMore || this.loading || this.loadingMore) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now < this.loadMoreCooldownUntil) return;
    this.loadMoreCooldownUntil = now + 500;
    this.loadMore.emit();
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

  /**
   * Font Awesome brand / platform icon (matches list + detail elsewhere).
   */
  getPlatformFaClass(platform: string | undefined | null): string {
    const p = (platform || '').toLowerCase().trim();
    const icons: Record<string, string> = {
      [Platform.INSTAGRAM]: 'fab fa-instagram',
      [Platform.FACEBOOK]: 'fab fa-facebook-f',
      [Platform.YOUTUBE]: 'fab fa-youtube',
      [Platform.GOOGLE]: 'fab fa-google',
      'google_my_business': 'fab fa-google',
      [Platform.LINKEDIN]: 'fab fa-linkedin-in',
      [Platform.WHATSAPP]: 'fab fa-whatsapp',
      [Platform.WEBSITE]: 'fas fa-globe',
      [Platform.EMAIL]: 'fas fa-envelope',
      'gmail': 'fab fa-google',
      'outlook': 'fab fa-microsoft'
    };
    return icons[p] || 'fas fa-share-alt';
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

  /** Default SLA: 24 hours. Show unreplied/overdue and replied timing. */
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

    // A conversation counts as "replied" when:
    //  - status is explicitly 'replied' or 'resolved', OR
    //  - status is 'assigned' but a reply already exists (AI sent fallback then assigned to agent)
    const hasReplies = !!(interaction as any).autoReplied ||
                       !!interaction.respondedAt ||
                       ((interaction as any).replies?.length > 0);
    const isLatestReplied = interaction.status === 'replied' ||
                            interaction.status === 'resolved' ||
                            (interaction.status === 'assigned' && hasReplies);
    if (isLatestReplied) {
      if (interaction.respondedAt) {
        const responseMins = Math.floor((new Date(interaction.respondedAt).getTime() - created) / 60000);
        if (responseMins < 0) return 'Replied';
        return `Replied in ${formatDuration(responseMins)}`;
      }
      return 'Replied';
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
    if (interaction.status === 'replied' || interaction.status === 'resolved') return false;
    const created = new Date(interaction.platformCreatedAt).getTime();
    const elapsedMins = (Date.now() - created) / 60000;
    return elapsedMins >= SLA_MINUTES;
  }

  /** True when the latest message in the thread is already replied/resolved. */
  isLatestReplied(interaction: IInteraction): boolean {
    return interaction.status === 'replied' || interaction.status === 'resolved';
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

  /** Row surface: white in light mode, card token in dark (inline style beats Tailwind on this row). */
  getListRowBackground(interaction: IInteraction): string {
    const colors = this.getPlatformColors(interaction.platform);
    const end = this.appearance.isDark() ? '#1A1D27' : '#ffffff';
    if (this.isSelected(interaction)) {
      return `linear-gradient(to right, ${colors.gradientFrom}14, ${end})`;
    }
    return end;
  }

  getListRowBorderColor(interaction: IInteraction): string {
    if (this.isSelected(interaction)) {
      return this.getPlatformColors(interaction.platform).primary + '40';
    }
    return this.appearance.isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  }

  /**
   * Instagram numeric-ID URLs (e.g. /p/18104377792903993) are Graph API media IDs,
   * not valid web shortcode URLs. Detect and discard them so we don't show broken links.
   */
  private isNumericInstagramUrl(url: string): boolean {
    const m = url.match(/instagram\.com\/p\/([^/?#]+)/);
    if (!m) return false;
    return /^\d{14,}$/.test(m[1]);
  }

  /**
   * Returns post reference data for comment-type interactions so the template
   * can display a "post chip" linking back to the original post/video.
   * Covers: YouTube, Instagram, Facebook, LinkedIn, Twitter/X.
   */
  getPostRef(interaction: IInteraction): { title: string | null; url: string } | null {
    if (interaction.type !== 'comment') return null;

    const m = interaction.metadata as Record<string, unknown> | undefined;

    const pickStr = (v: unknown): string | null => {
      if (!v) return null;
      const s = String(v).trim();
      return s.length > 0 ? s : null;
    };

    // Build the post URL — prefer stored postUrl, fall back to videoId, then platformUrl
    const videoIdFromMeta = pickStr(m?.['videoId']);
    const rawCandidates = [
      pickStr(m?.['postUrl']),
      videoIdFromMeta ? `https://www.youtube.com/watch?v=${videoIdFromMeta}` : null,
      pickStr(interaction.platformUrl),
    ];

    const url = rawCandidates.find(c => {
      if (!c) return false;
      if (interaction.platform === 'instagram' && this.isNumericInstagramUrl(c)) return false;
      return true;
    }) ?? null;

    if (!url) return null;

    // Build the post title — prefer stored title, then caption excerpt
    const rawCaption = pickStr(m?.['mediaCaption']) || pickStr(m?.['postTitle']);
    const title =
      pickStr(m?.['videoTitle']) ||
      (rawCaption ? rawCaption.slice(0, 60) + (rawCaption.length > 60 ? '…' : '') : null);

    return { title: title || null, url };
  }

  /**
   * Returns the text of the last message in the conversation, regardless of direction.
   * For DM threads: compares the last outgoing reply against the last incoming message
   * and returns whichever is newer. Falls back to interaction.content.
   */
  getLastMessage(interaction: IInteraction): string {
    // For email interactions, show the subject line as primary preview
    if (interaction.platform === Platform.EMAIL) {
      const subject = (interaction.metadata as any)?.email?.subject;
      return subject || interaction.content || '(no subject)';
    }

    const { lastReply, lastIncoming } = this._resolveLastMessage(interaction);
    const replyTime = lastReply ? new Date(lastReply.sentAt).getTime() : 0;
    const incomingTime = this._incomingTime(lastIncoming);

    if (!lastReply && !lastIncoming) {
      return this._friendlyAttachmentText({ text: interaction.content ?? '' });
    }
    if (replyTime >= incomingTime && lastReply) {
      const out = this._previewTextForReply(lastReply);
      return out || interaction.content || '';
    }
    if (lastIncoming) {
      return (
        this._friendlyAttachmentText(lastIncoming) ||
        (lastReply ? this._previewTextForReply(lastReply) : '') ||
        interaction.content ||
        ''
      );
    }
    return this._previewTextForReply(lastReply!) || interaction.content || '';
  }

  /** True when the last message in the conversation is an outgoing reply (sent by us / AI). */
  isLastMessageOutgoing(interaction: IInteraction): boolean {
    const { lastReply, lastIncoming } = this._resolveLastMessage(interaction);
    if (!lastReply) return false;
    const replyTime = new Date(lastReply.sentAt).getTime();
    const incomingTime = this._incomingTime(lastIncoming);
    return replyTime >= incomingTime;
  }

  private _resolveLastMessage(interaction: IInteraction): {
    lastReply: IReply | null;
    lastIncoming: { mid?: string; text?: string; timestamp?: number; attachmentType?: string; attachmentUrl?: string } | null;
  } {
    const replies = interaction.replies ?? [];
    const incomingMessages: Array<{ mid?: string; text?: string; timestamp?: number; attachmentType?: string; attachmentUrl?: string }> =
      (interaction as any).metadata?.incomingMessages ?? [];
    return {
      lastReply: replies.length > 0 ? replies[replies.length - 1] : null,
      lastIncoming: incomingMessages.length > 0 ? incomingMessages[incomingMessages.length - 1] : null
    };
  }

  /**
   * List preview for an app-originated reply: real text wins over attachment metadata
   * (avoids stale attachmentType after a later text send).
   */
  private _previewTextForReply(reply: IReply): string {
    const raw = reply.content ?? '';
    const t = raw.trim();
    if (t.length > 0 && !InboxListComponent._isBracketAttachmentPlaceholder(t)) {
      return raw;
    }
    return this._friendlyAttachmentText({
      text: raw,
      attachmentType: reply.attachmentType,
      attachmentUrl: reply.attachmentUrl
    });
  }

  private static _isBracketAttachmentPlaceholder(t: string): boolean {
    return /^\[(image|video|audio|file|attachment|shared instagram reel|shared instagram story|shared instagram post)\]$/i.test(
      t.trim()
    );
  }

  /** Map raw attachment placeholder text to a human-readable label. */
  private _friendlyAttachmentText(msg: { text?: string; attachmentType?: string; attachmentUrl?: string; type?: string; isUnsupported?: boolean }): string {
    if (isUnsupportedWhatsAppIncoming(msg)) {
      return 'Message not available (WhatsApp API limit)';
    }
    const LABELS: Record<string, string> = {
      video: '🎥 Video',
      image: '📷 Photo',
      audio: '🎤 Voice message',
      file: '📎 File',
      ig_reel: '🎬 Shared reel',
      reel: '🎬 Shared reel',
      story: '📖 Shared story',
      ig_story: '📖 Shared story',
      share: '🔗 Shared post',
      ig_post: '🔗 Shared post'
    };
    const raw = msg.text ?? '';
    const t = raw.trim();
    const hasUrl = !!(msg.attachmentUrl && String(msg.attachmentUrl).trim());
    const type = (msg.attachmentType ?? '').trim();

    if (/^\[video\]$/i.test(t)) return '🎥 Video';
    if (/^\[image\]$/i.test(t)) return '📷 Photo';
    if (/^\[audio\]$/i.test(t)) return '🎤 Voice message';
    if (/^\[file\]$/i.test(t)) return '📎 File';
    if (/^\[attachment\]$/i.test(t)) return '📎 File';
    if (/\.pdf$/i.test(t)) return '📄 PDF';
    if (looksLikeAttachmentFilename(t)) return '📎 File';
    if (/^\[shared instagram reel\]$/i.test(t)) return '🎬 Shared reel';
    if (/^\[shared instagram story\]$/i.test(t)) return '📖 Shared story';
    if (/^\[shared instagram post\]$/i.test(t)) return '🔗 Shared post';

    // Substantive DM text must win over attachmentType (platform webhooks often leave stale type on text messages)
    if (t.length > 0 && !InboxListComponent._isBracketAttachmentPlaceholder(t)) {
      return raw;
    }

    if (type && LABELS[type] && (hasUrl || InboxListComponent._isBracketAttachmentPlaceholder(t))) {
      return LABELS[type];
    }

    return raw;
  }

  private _incomingTime(msg: { timestamp?: number } | null): number {
    if (!msg?.timestamp) return 0;
    return msg.timestamp > 1e10 ? msg.timestamp : msg.timestamp * 1000;
  }

  /** Support ticket / chat number: prefer chatRef (e.g. #ORGCODE-101), fallback to chatNumber */
  getTicketDisplay(interaction: IInteraction): string | null {
    const ref = interaction.chatRef?.trim();
    if (ref) return ref;
    if (interaction.chatNumber != null && !Number.isNaN(Number(interaction.chatNumber))) {
      return `#${interaction.chatNumber}`;
    }
    return null;
  }

  /** Platform icon class for the post reference chip */
  getPostRefIcon(platform: string): string {
    const map: Record<string, string> = {
      youtube: 'fa-brands fa-youtube',
      instagram: 'fa-brands fa-instagram',
      facebook: 'fa-brands fa-facebook',
      linkedin: 'fa-brands fa-linkedin',
      twitter: 'fa-brands fa-x-twitter',
      x: 'fa-brands fa-x-twitter',
    };
    return map[platform?.toLowerCase()] || 'fas fa-link';
  }
}
