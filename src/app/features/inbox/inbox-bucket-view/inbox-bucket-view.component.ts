import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { InboxService } from '../../../core/services/inbox.service';
import { IIntentBucket } from '../../../core/services/intent-bucket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { EntitlementsStore, FEATURE_KEY } from '../../../core/services/entitlements.store';
import { IInteraction, IInboxFilters, IReply, InteractionStatus, Platform } from '../../../core/models/interaction.model';
import { Media } from '../../../core/models/media.model';
import { MediaSelectorModalComponent } from '../../../shared/components/media-selector-modal/media-selector-modal.component';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { inboxFilterSerialize } from '../../../core/utils/inbox-filter-values';
import {
  buildBucketChatTimeline,
  BucketChatTimelineItem,
  isImagePlaceholderText
} from '../../../core/utils/inbox-bucket-chat-timeline';
import {
  downloadInboxAttachmentFile,
  inboxAttachmentFilenameFromUrl,
  inboxReplyPdfDisplayName
} from '../../../core/utils/inbox-attachment-display';
import { INBOX_EMOJI_LIST } from '../../../core/constants/inbox-emoji-list';
import { ISentimentBreakdown } from '../../../core/models/analytics.model';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { SentimentDonutChartComponent } from '../../../shared/components/charts/sentiment-donut-chart.component';
import { Observable, Subscription, timer, interval } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { InboxLinkifiedTextComponent } from '../../../shared/components/inbox-linkified-text/inbox-linkified-text.component';
import { InboxAvatarService } from '../../../core/services/inbox-avatar.service';

interface BucketColumn {
  bucket: IIntentBucket;
  interactions: IInteraction[];
  total: number;
  loading: boolean;
}

interface SentimentStats {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
}

@Component({
  selector: 'app-inbox-bucket-view',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, AiChatBubbleIconComponent, SentimentDonutChartComponent, MediaSelectorModalComponent, InboxLinkifiedTextComponent],
  templateUrl: './inbox-bucket-view.component.html',
  styleUrls: ['./inbox-bucket-view.component.scss']
})
export class InboxBucketViewComponent implements OnInit, OnDestroy, OnChanges {
  /**
   * Free plan: bucket view is read-only — chat composer hidden, replies route
   * users to the standard inbox detail page. The bucket data itself stays visible.
   */
  protected readonly entitlements = inject(EntitlementsStore);
  protected readonly FEATURE_KEY = FEATURE_KEY;

  @Input() filters: IInboxFilters = {};
  @Output() interactionSelect = new EventEmitter<IInteraction>();

  @ViewChild('chatThreadRef') chatThreadRef?: ElementRef<HTMLElement>;
  @ViewChild('composeRef') composeRef?: ElementRef<HTMLTextAreaElement>;

  columns: BucketColumn[] = [];
  unassignedColumn: { interactions: IInteraction[]; total: number; loading: boolean } = {
    interactions: [], total: 0, loading: false
  };
  loading = true;
  selectedInteractionId: string | null = null;
  collapsedColumns = new Set<string>();
  connectedDropLists: string[] = [];

  // AI Insights panel
  insightsTab: 'sentiment' | 'topics' = 'sentiment';
  inboxStats: any = null;
  insightsLoading = false;

  // ── Inline chat panel ──
  activeChatInteraction: IInteraction | null = null;
  chatLoading = false;
  replyText = '';
  replying = false;
  resolving = false;
  private savedCollapsedColumns = new Set<string>();

  // ── Compose toolbar extras ──
  showEmojiPicker = false;
  showMediaModal = false;
  /** Attachment chosen from media library (URL already public — no upload step). */
  pendingMediaAttachment: { publicUrl: string; mediaType: 'image' | 'video' | 'audio' | 'file'; name?: string } | null = null;
  isRecording = false;
  recordingSeconds = 0;
  recordedAudioUrl: string | null = null;
  private recordedBlob: Blob | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingTickSub?: Subscription;

  /** After a real CDK drag, the browser often fires a click — suppress opening chat for that card only. */
  private pendingSuppressClickForInteractionId: string | null = null;
  private pendingDragClickSub?: Subscription;

  /** Same emoji picker as list inbox (`inbox-detail`) */
  readonly emojiList: readonly string[] = INBOX_EMOJI_LIST;

  private subscriptions: Subscription[] = [];
  /** At most this many bucket columns may be expanded at once (unassigned counts as one column). */
  private readonly maxExpandedBuckets = 3;

  // ── Cached insight properties ──
  totalColumns = 0;
  sentimentBreakdownInput: ISentimentBreakdown = { positive: 0, neutral: 0, negative: 0, total: 0 };
  commonComments: { keyword: string; count: number; sample: any }[] = [];
  bucketTotal = 0;
  bucketTopics: { name: string; color: string; count: number; percent: number }[] = [];
  aiRecommendation = '';
  totalMessagesAnalysed = 0;
  /** Hide broken avatar images so initials show (same pattern as inbox list). */
  avatarFallback: Record<string, boolean> = {};

  constructor(
    private inboxService: InboxService,
    private notify: NotificationService,
    private sweetAlertService: SweetAlertService,
    private sanitizer: DomSanitizer,
    private avatarService: InboxAvatarService
  ) {}

  ngOnInit(): void {
    this.loadBucketView();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange) {
      this.loadBucketView();
    }
  }

  ngOnDestroy(): void {
    this.clearPendingDragClickTimer();
    this.recordingTickSub?.unsubscribe();
    this.recordingTickSub = undefined;
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private clearPendingDragClickTimer(): void {
    this.pendingDragClickSub?.unsubscribe();
    this.pendingDragClickSub = undefined;
  }

  onBucketCardDragStarted(interaction: IInteraction): void {
    this.clearPendingDragClickTimer();
    this.pendingSuppressClickForInteractionId = interaction._id;
  }

  onBucketCardDragEnded(): void {
    this.clearPendingDragClickTimer();
    this.pendingDragClickSub = timer(400)
      .pipe(take(1))
      .subscribe(() => {
        this.pendingDragClickSub = undefined;
        this.pendingSuppressClickForInteractionId = null;
      });
  }

  private mergeListFiltersIntoParams(target: Record<string, unknown>): void {
    const pl = inboxFilterSerialize(this.filters.platform as any);
    if (pl) target['platform'] = pl;
    const t = inboxFilterSerialize(this.filters.type as any);
    if (t) target['type'] = t;
    const s = inboxFilterSerialize(this.filters.sentiment as any);
    if (s) target['sentiment'] = s;
    const st = inboxFilterSerialize(this.filters.status as any);
    if (st) target['status'] = st;
    const lbl = inboxFilterSerialize(this.filters.label as any);
    if (lbl) target['label'] = lbl;
    if (this.filters.search) target['search'] = this.filters.search;
    if (this.filters.dateFrom) target['dateFrom'] = this.filters.dateFrom;
    if (this.filters.dateTo) target['dateTo'] = this.filters.dateTo;
    const chatSession = (this.filters as { chatSession?: 'open' | 'closed' }).chatSession;
    if (chatSession === 'open') target['chatOpen'] = 'true';
    else if (chatSession === 'closed') target['chatOpen'] = 'false';
  }

  loadBucketView(): void {
    this.loading = true;
    const params: Record<string, unknown> = { limit: 20 };
    this.mergeListFiltersIntoParams(params);

    this.inboxService.getBucketView(params).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.columns = (res.data.buckets || []).map((b: any) => ({
            bucket: b.bucket,
            interactions: b.interactions || [],
            total: b.total || 0,
            loading: false
          }));
          this.unassignedColumn = {
            interactions: res.data.unassigned?.interactions || [],
            total: res.data.unassigned?.total || 0,
            loading: false
          };
          this.updateConnectedLists();
          this.collapsedColumns.clear();
          this.columns.slice(3).forEach(col => this.collapsedColumns.add(col.bucket._id));
          if (this.columns.length >= 3 && this.unassignedColumn.total > 0) {
            this.collapsedColumns.add('__unassigned__');
          }
        }
        this.loading = false;
        this.computeLocalInsights();
        this.loadInsightStats();
        this.loadTopicInsights();
      },
      error: () => {
        this.notify.error('Error', 'Failed to load bucket view');
        this.loading = false;
      }
    });
  }

  loadInsightStats(): void {
    this.insightsLoading = true;
    const pl = inboxFilterSerialize(this.filters.platform as any);
    const statsFilters = pl ? { platform: this.filters.platform as any } : undefined;
    this.inboxService.getStats(statsFilters).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.inboxStats = res.data;
        }
        this.insightsLoading = false;
        this.computeLocalInsights();
      },
      error: () => { this.insightsLoading = false; }
    });
  }

  loadTopicInsights(): void {
    const params: Record<string, unknown> = {};
    this.mergeListFiltersIntoParams(params);

    this.inboxService.getTopicInsights(params).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.commonComments = (res.data.commonTopics || []).map((t: any) => ({
            keyword: t.keyword,
            count: t.count,
            sample: t.sample
          }));
          this.aiRecommendation = res.data.recommendation || '';
          this.totalMessagesAnalysed = res.data.totalMessages || 0;
          if (res.data.sentiment) {
            const s = res.data.sentiment;
            this.sentimentBreakdownInput = {
              positive: s.positive, neutral: s.neutral, negative: s.negative, total: s.total
            };
          }
        }
      },
      error: () => {
        this.commonComments = [];
        this.aiRecommendation = 'Unable to load topic insights.';
      }
    });
  }

  private computeLocalInsights(): void {
    this.totalColumns = this.columns.length + (this.unassignedColumn.total > 0 ? 1 : 0);

    let positive = 0, neutral = 0, negative = 0;
    if (this.inboxStats) {
      positive = this.inboxStats.positive || 0;
      neutral  = this.inboxStats.neutral  || 0;
      negative = this.inboxStats.negative || 0;
    } else {
      const all: IInteraction[] = [];
      this.columns.forEach(col => all.push(...col.interactions));
      all.push(...this.unassignedColumn.interactions);
      all.forEach(i => {
        if (i.sentiment === 'positive') positive++;
        else if (i.sentiment === 'negative') negative++;
        else if (i.sentiment === 'neutral') neutral++;
      });
    }
    const sentTotal = positive + neutral + negative || 1;
    this.sentimentBreakdownInput = { positive, neutral, negative, total: sentTotal };

    this.bucketTotal = this.columns.reduce((s, c) => s + c.total, 0) + this.unassignedColumn.total;
    const btTotal = this.bucketTotal || 1;
    this.bucketTopics = [...this.columns.map(col => ({
      name: col.bucket.name,
      color: col.bucket.color,
      count: col.total,
      percent: Math.round((col.total / btTotal) * 100)
    }))].sort((a, b) => b.count - a.count);
  }

  onDrop(event: CdkDragDrop<IInteraction[]>, targetBucketId: string | null): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const interaction = event.previousContainer.data[event.previousIndex];
    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.inboxService.updateInteractionBucket(interaction._id, targetBucketId).subscribe({
      next: () => {},
      error: () => {
        this.notify.error('Error', 'Failed to move conversation');
        this.loadBucketView();
      }
    });
  }

  selectInteraction(interaction: IInteraction): void {
    if (this.pendingSuppressClickForInteractionId === interaction._id) {
      this.clearPendingDragClickTimer();
      this.pendingSuppressClickForInteractionId = null;
      return;
    }
    if (this.activeChatInteraction?._id === interaction._id) {
      this.closeChat();
      return;
    }
    this.openChat(interaction);
  }

  // ── Inline chat ──────────────────────────────────────────────────────────────

  openChat(interaction: IInteraction): void {
    // Save current collapsed state so we can restore it on close
    this.savedCollapsedColumns = new Set(this.collapsedColumns);

    // Determine which column owns this card
    const ownerColumnId = this.findColumnIdForInteraction(interaction);

    // Collapse every column except the owner
    this.columns.forEach(c => {
      if (c.bucket._id !== ownerColumnId) {
        this.collapsedColumns.add(c.bucket._id);
      } else {
        this.collapsedColumns.delete(c.bucket._id);
      }
    });
    // Collapse unassigned unless the card came from there
    if (ownerColumnId === '__unassigned__') {
      this.collapsedColumns.delete('__unassigned__');
    } else {
      this.collapsedColumns.add('__unassigned__');
    }

    this.activeChatInteraction = interaction;
    this.selectedInteractionId = interaction._id;
    this.replyText = '';
    this.loadChatDetail(interaction._id);
  }

  private findColumnIdForInteraction(interaction: IInteraction): string | null {
    for (const col of this.columns) {
      if (col.interactions.some(i => i._id === interaction._id)) {
        return col.bucket._id;
      }
    }
    if (this.unassignedColumn.interactions.some(i => i._id === interaction._id)) {
      return '__unassigned__';
    }
    return null;
  }

  closeChat(): void {
    this.activeChatInteraction = null;
    this.selectedInteractionId = null;
    this.replyText = '';
    this.replying = false;
    this.resolving = false;
    this.showEmojiPicker = false;
    this.clearAttachment();
    this.cancelRecording();
    // Restore the layout that existed before opening
    this.collapsedColumns = new Set(this.savedCollapsedColumns);
  }

  private loadChatDetail(id: string): void {
    this.chatLoading = true;
    this.inboxService.getInteraction(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.activeChatInteraction = res.data;
        }
        this.chatLoading = false;
        this.scrollChatToBottom();
      },
      error: () => {
        this.chatLoading = false;
      }
    });
  }

  private scrollChatToBottom(): void {
    this.subscriptions.push(
      timer(50)
        .pipe(take(1))
        .subscribe(() => {
          if (this.chatThreadRef?.nativeElement) {
            this.chatThreadRef.nativeElement.scrollTop = this.chatThreadRef.nativeElement.scrollHeight;
          }
        })
    );
  }

  submitReply(): void {
    const hasText = this.replyText.trim().length > 0;
    const hasBlob = !!this.recordedBlob;
    const hasLibraryMedia = !!this.pendingMediaAttachment;
    if (!this.activeChatInteraction || (!hasText && !hasBlob && !hasLibraryMedia) || this.replying) return;

    this.replying = true;
    const id = this.activeChatInteraction._id;
    const text = this.replyText.trim();

    if (hasLibraryMedia) {
      const { publicUrl, mediaType } = this.pendingMediaAttachment!;
      const defaultCaption =
        mediaType === 'audio'
          ? '🎤 Voice message'
          : mediaType === 'video'
            ? '🎬 Video'
            : mediaType === 'file'
              ? '📄 PDF'
              : '🖼️ Image';
      const replyContent = text || defaultCaption;
      this.inboxService.replyToInteraction(id, replyContent, false, undefined, publicUrl, mediaType).subscribe({
        next: () => this.onReplySent(id),
        error: () => {
          this.notify.error('Error', 'Failed to send reply. Please try again.');
          this.replying = false;
        }
      });
      return;
    }

    if (hasBlob) {
      const blob = this.recordedBlob!;
      const filename = `voice-${Date.now()}.webm`;
      const replyContent = text || '🎤 Voice message';

      this.inboxService.uploadAttachment(blob, filename).subscribe({
        next: (res: any) => {
          const publicUrl: string = res?.data?.publicUrl;
          if (!publicUrl) {
            this.notify.error('Upload failed', 'Could not get a URL for the attachment.');
            this.replying = false;
            return;
          }
          this.inboxService.replyToInteraction(id, replyContent, false, undefined, publicUrl, 'audio').subscribe({
            next: () => this.onReplySent(id),
            error: () => {
              this.notify.error('Error', 'Failed to send reply. Please try again.');
              this.replying = false;
            }
          });
        },
        error: () => {
          this.notify.error('Upload failed', 'Could not upload the attachment. Please try again.');
          this.replying = false;
        }
      });
    } else {
      this.inboxService.replyToInteraction(id, text).subscribe({
        next: () => this.onReplySent(id),
        error: () => {
          this.notify.error('Error', 'Failed to send reply. Please try again.');
          this.replying = false;
        }
      });
    }
  }

  private onReplySent(id: string): void {
    this.notify.success('Reply sent', 'Your reply has been sent successfully.');
    this.replyText = '';
    this.clearAttachment();
    this.cancelRecording();
    this.showEmojiPicker = false;
    this.updateCardInColumn(id, { status: InteractionStatus.REPLIED as any });
    this.replying = false;
    this.loadChatDetail(id);
  }

  // ── Emoji picker ──────────────────────────────────────────────────────────
  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  insertEmoji(emoji: string): void {
    this.replyText += emoji;
    this.showEmojiPicker = false;
    this.subscriptions.push(
      timer(0)
        .pipe(take(1))
        .subscribe(() => this.composeRef?.nativeElement.focus())
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.emoji-panel') && !target.closest('.emoji-toggle-btn')) {
      this.showEmojiPicker = false;
    }
  }

  // ── Media library attachment (same flow as inbox detail) ───────────────────
  openMediaSelector(): void {
    this.showMediaModal = true;
  }

  closeMediaSelector(): void {
    this.showMediaModal = false;
  }

  private getPlatformMediaLimits(): { imageMaxBytes: number; videoMaxBytes: number; audioMaxBytes: number } {
    const platform = this.activeChatInteraction?.platform;
    if (platform === Platform.INSTAGRAM) {
      return { imageMaxBytes: 8 * 1024 * 1024, videoMaxBytes: 25 * 1024 * 1024, audioMaxBytes: 25 * 1024 * 1024 };
    }
    if (platform === Platform.FACEBOOK) {
      return { imageMaxBytes: 25 * 1024 * 1024, videoMaxBytes: 25 * 1024 * 1024, audioMaxBytes: 25 * 1024 * 1024 };
    }
    return { imageMaxBytes: 25 * 1024 * 1024, videoMaxBytes: 25 * 1024 * 1024, audioMaxBytes: 25 * 1024 * 1024 };
  }

  onMediaSelect(media: Media): void {
    if (!this.activeChatInteraction) return;
    const limits = this.getPlatformMediaLimits();
    const size = media.size ?? 0;
    const isImage = media.mediaType === 'image';
    const isVideo = media.mediaType === 'video';
    const isAudio = media.mediaType === 'audio';
    const isFile = media.mediaType === 'file';
    const maxBytes = isImage
      ? limits.imageMaxBytes
      : isAudio
        ? limits.audioMaxBytes
        : limits.videoMaxBytes;
    if (size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      void this.sweetAlertService.toast('error', `This ${media.mediaType} is too large. Max ${maxMB}MB for this platform.`);
      return;
    }
    this.pendingMediaAttachment = {
      publicUrl: media.publicUrl,
      mediaType: media.mediaType,
      name: media.originalName
    };
    this.showMediaModal = false;
  }

  clearAttachment(): void {
    this.pendingMediaAttachment = null;
  }

  // ── Voice recording ───────────────────────────────────────────────────────
  startRecording(): void {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.notify.error('Not supported', 'Voice recording is not supported in this browser.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const chunks: Blob[] = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        this.recordedBlob = new Blob(chunks, { type: 'audio/webm' });
        this.recordedAudioUrl = URL.createObjectURL(this.recordedBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingSeconds = 0;
      this.recordingTickSub?.unsubscribe();
      this.recordingTickSub = interval(1000).subscribe(() => this.recordingSeconds++);
    }).catch(() => {
      this.notify.error('Microphone denied', 'Please allow microphone access to record voice messages.');
    });
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.recordingTickSub?.unsubscribe();
    this.recordingTickSub = undefined;
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.recordingTickSub?.unsubscribe();
    this.recordingTickSub = undefined;
    this.recordedBlob = null;
    this.recordedAudioUrl = null;
    this.recordingSeconds = 0;
  }

  formatRecordingTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  resolveChat(): void {
    if (!this.activeChatInteraction || this.resolving) return;
    this.resolving = true;
    const id = this.activeChatInteraction._id;

    this.inboxService.updateStatus(id, InteractionStatus.RESOLVED).subscribe({
      next: () => {
        this.notify.success('Resolved', 'Conversation marked as resolved.');
        this.updateCardInColumn(id, { status: InteractionStatus.RESOLVED as any });
        if (this.activeChatInteraction) {
          this.activeChatInteraction = { ...this.activeChatInteraction, status: InteractionStatus.RESOLVED as any };
        }
        this.resolving = false;
      },
      error: () => {
        this.notify.error('Error', 'Failed to resolve conversation.');
        this.resolving = false;
      }
    });
  }

  reopenChat(): void {
    if (!this.activeChatInteraction || this.resolving) return;
    this.resolving = true;
    const id = this.activeChatInteraction._id;

    this.inboxService.updateStatus(id, InteractionStatus.UNREAD).subscribe({
      next: () => {
        this.notify.success('Reopened', 'Conversation reopened.');
        this.updateCardInColumn(id, { status: InteractionStatus.UNREAD as any });
        if (this.activeChatInteraction) {
          this.activeChatInteraction = { ...this.activeChatInteraction, status: InteractionStatus.UNREAD as any };
        }
        this.resolving = false;
      },
      error: () => {
        this.notify.error('Error', 'Failed to reopen conversation.');
        this.resolving = false;
      }
    });
  }

  onReplyKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitReply();
    }
  }

  isResolved(): boolean {
    return (this.activeChatInteraction?.status as string) === InteractionStatus.RESOLVED;
  }

  isSentByTeam(reply: IReply): boolean {
    return !reply.isPlatformReply;
  }

  /** Chronological thread (DM incoming history + replies) for the inline chat panel */
  get chatTimelineItems(): BucketChatTimelineItem[] {
    return buildBucketChatTimeline(this.activeChatInteraction);
  }

  trackByChatItem(_index: number, item: BucketChatTimelineItem): string {
    if (item.kind === 'incoming') {
      return `in-${item.at.getTime()}-${item.text?.slice(0, 24) ?? ''}`;
    }
    const id = (item.reply as { _id?: string })._id;
    return id ? `re-${id}` : `re-${item.at.getTime()}`;
  }

  isBucketIncomingImagePlaceholder(content: string | undefined): boolean {
    return isImagePlaceholderText(content);
  }

  getReplyAuthorInitials(reply: IReply): string {
    if (reply.isPlatformReply) {
      const name = reply.author?.name || this.activeChatInteraction?.author?.name || '?';
      return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
    }
    // Team reply — use sentBy name if populated
    const sentBy = reply.sentBy as any;
    if (sentBy?.firstName || sentBy?.lastName) {
      return ((sentBy.firstName?.[0] || '') + (sentBy.lastName?.[0] || '')).toUpperCase();
    }
    return 'ME';
  }

  private updateCardInColumn(id: string, patch: Partial<IInteraction>): void {
    for (const col of this.columns) {
      const idx = col.interactions.findIndex(i => i._id === id);
      if (idx !== -1) {
        col.interactions[idx] = { ...col.interactions[idx], ...patch };
        return;
      }
    }
    const idx = this.unassignedColumn.interactions.findIndex(i => i._id === id);
    if (idx !== -1) {
      this.unassignedColumn.interactions[idx] = { ...this.unassignedColumn.interactions[idx], ...patch };
    }
  }

  loadMore(column: BucketColumn): void {
    if (column.loading || column.interactions.length >= column.total) return;
    column.loading = true;
    const params: Record<string, unknown> = {
      intentBucket: column.bucket._id,
      limit: 20,
      page: Math.floor(column.interactions.length / 20) + 1
    };
    this.mergeListFiltersIntoParams(params);
    this.inboxService.getInteractions(params).subscribe({
      next: (res: any) => {
        if (res.success && res.data?.interactions) {
          const existingIds = new Set(column.interactions.map(i => i._id));
          const newOnes = res.data.interactions.filter((i: IInteraction) => !existingIds.has(i._id));
          column.interactions = [...column.interactions, ...newOnes];
        }
        column.loading = false;
      },
      error: () => { column.loading = false; }
    });
  }

  loadMoreUnassigned(): void {
    if (this.unassignedColumn.loading || this.unassignedColumn.interactions.length >= this.unassignedColumn.total) return;
    this.unassignedColumn.loading = true;
    const params: Record<string, unknown> = {
      intentBucket: 'none',
      limit: 20,
      page: Math.floor(this.unassignedColumn.interactions.length / 20) + 1
    };
    this.mergeListFiltersIntoParams(params);
    this.inboxService.getInteractions(params).subscribe({
      next: (res: any) => {
        if (res.success && res.data?.interactions) {
          const existingIds = new Set(this.unassignedColumn.interactions.map(i => i._id));
          const newOnes = res.data.interactions.filter((i: IInteraction) => !existingIds.has(i._id));
          this.unassignedColumn.interactions = [...this.unassignedColumn.interactions, ...newOnes];
        }
        this.unassignedColumn.loading = false;
      },
      error: () => { this.unassignedColumn.loading = false; }
    });
  }

  onUnassignedScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.loadMoreUnassigned();
    }
  }

  /** Avatar for bucket cards / chat header — proxied via API when Graph URL or FB/IG needs token. */
  getAuthorAvatar$(interaction: IInteraction): Observable<SafeUrl | null> {
    const pageId = (interaction.metadata as { facebookPageId?: string } | undefined)?.facebookPageId;
    return this.avatarService.getAvatarUrl(interaction.platform, interaction.author, pageId).pipe(
      map(url => (url ? this.sanitizer.bypassSecurityTrustUrl(url) : null))
    );
  }

  bucketAvatarKey(interaction: IInteraction): string {
    return String(interaction.platformId || interaction._id || '');
  }

  onBucketAvatarError(interaction: IInteraction): void {
    const key = this.bucketAvatarKey(interaction);
    if (!key) return;
    this.avatarFallback = { ...this.avatarFallback, [key]: true };
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getRelativeTime(date: Date | string): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  }

  getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'fab fa-instagram', facebook: 'fab fa-facebook',
      whatsapp: 'fab fa-whatsapp', youtube: 'fab fa-youtube',
      google: 'fab fa-google', linkedin: 'fab fa-linkedin', website: 'fas fa-globe'
    };
    return map[platform] || 'fas fa-comment';
  }

  getPlatformColor(platform: string): string {
    const map: Record<string, string> = {
      instagram: '#E1306C', facebook: '#1877F2', whatsapp: '#25D366',
      youtube: '#FF0000', google: '#4285F4', linkedin: '#0A66C2', website: '#6B7280'
    };
    return map[platform] || '#6B7280';
  }

  replyPdfFileLabel(reply: IReply): string {
    return inboxReplyPdfDisplayName(reply);
  }

  downloadBucketPdf(url: string | undefined, reply: IReply): void {
    if (!url) return;
    const name = inboxReplyPdfDisplayName({ ...reply, attachmentUrl: url });
    void downloadInboxAttachmentFile(url, name);
  }

  incomingBucketFileLabel(item: { attachmentUrl?: string }): string {
    return inboxAttachmentFilenameFromUrl(item.attachmentUrl);
  }

  downloadBucketIncomingPdf(url: string | undefined): void {
    if (!url) return;
    void downloadInboxAttachmentFile(url, inboxAttachmentFilenameFromUrl(url));
  }

  getSentimentEmoji(sentiment?: string): string {
    if (sentiment === 'positive') return '😊';
    if (sentiment === 'negative') return '😠';
    return '';
  }

  getResolvedCount(col: BucketColumn): number {
    return col.interactions.filter(i => (i.status as string) === InteractionStatus.RESOLVED).length;
  }

  trackByBucket(index: number, col: BucketColumn): string { return col.bucket._id; }
  trackByInteraction(index: number, interaction: IInteraction): string { return interaction._id; }

  toggleCollapse(id: string): void {
    if (this.collapsedColumns.has(id)) {
      this.collapsedColumns.delete(id);
      this.enforceMaxExpanded(id);
    } else {
      this.collapsedColumns.add(id);
    }
  }

  isCollapsed(id: string): boolean { return this.collapsedColumns.has(id); }

  /** Bucket ids + optional unassigned, left-to-right, that are currently expanded. */
  private getExpandedIdsInDisplayOrder(): string[] {
    const ids: string[] = [];
    for (const col of this.columns) {
      if (!this.collapsedColumns.has(col.bucket._id)) {
        ids.push(col.bucket._id);
      }
    }
    if (this.unassignedColumn.total > 0 && !this.collapsedColumns.has('__unassigned__')) {
      ids.push('__unassigned__');
    }
    return ids;
  }

  /** Keep at most `maxExpandedBuckets` open; prefer keeping `justExpandedId` open and collapse others from the left. */
  private enforceMaxExpanded(justExpandedId: string): void {
    while (this.getExpandedIdsInDisplayOrder().length > this.maxExpandedBuckets) {
      const expanded = this.getExpandedIdsInDisplayOrder();
      const victim = expanded.find(cid => cid !== justExpandedId);
      if (!victim) {
        break;
      }
      this.collapsedColumns.add(victim);
    }
  }

  private updateConnectedLists(): void {
    this.connectedDropLists = [
      'unassigned-list',
      ...this.columns.map(c => 'bucket-' + c.bucket._id)
    ];
  }

  onColumnScroll(event: Event, column: BucketColumn): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.loadMore(column);
    }
  }
}
