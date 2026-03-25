import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { InboxService } from '../../../core/services/inbox.service';
import { IIntentBucket } from '../../../core/services/intent-bucket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IInteraction, IInboxFilters } from '../../../core/models/interaction.model';
import { ISentimentBreakdown } from '../../../core/models/analytics.model';
import { SentimentDonutChartComponent } from '../../../shared/components/charts/sentiment-donut-chart.component';
import { Subscription } from 'rxjs';

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
  imports: [CommonModule, DragDropModule, SentimentDonutChartComponent],
  templateUrl: './inbox-bucket-view.component.html',
  styleUrls: ['./inbox-bucket-view.component.scss']
})
export class InboxBucketViewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() filters: IInboxFilters = {};
  @Output() interactionSelect = new EventEmitter<IInteraction>();

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

  private subscriptions: Subscription[] = [];
  /** At most this many bucket columns may be expanded at once (unassigned counts as one column). */
  private readonly maxExpandedBuckets = 3;

  // ── Cached insight properties (computed once after data loads, never in getters) ──
  totalColumns = 0;
  sentimentBreakdownInput: ISentimentBreakdown = { positive: 0, neutral: 0, negative: 0, total: 0 };
  commonComments: { keyword: string; count: number; sample: IInteraction }[] = [];
  bucketTotal = 0;
  bucketTopics: { name: string; color: string; count: number; percent: number }[] = [];
  aiRecommendation = '';

  constructor(
    private inboxService: InboxService,
    private notify: NotificationService
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
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  loadBucketView(): void {
    this.loading = true;
    const params: any = { limit: 20 };
    if (this.filters.platform) params.platform = this.filters.platform;
    if (this.filters.type) params.type = this.filters.type;
    if (this.filters.sentiment) params.sentiment = this.filters.sentiment;
    if (this.filters.status) params.status = this.filters.status;
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.dateFrom) params.dateFrom = this.filters.dateFrom;
    if (this.filters.dateTo) params.dateTo = this.filters.dateTo;

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
        this.computeInsights();   // initial render with interaction data
        this.loadInsightStats();  // then refresh with full server stats
      },
      error: () => {
        this.notify.error('Error', 'Failed to load bucket view');
        this.loading = false;
      }
    });
  }

  loadInsightStats(): void {
    this.insightsLoading = true;
    const statsFilters = this.filters.platform ? { platform: this.filters.platform as any } : undefined;
    this.inboxService.getStats(statsFilters).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.inboxStats = res.data;
        }
        this.insightsLoading = false;
        this.computeInsights();
      },
      error: () => { this.insightsLoading = false; }
    });
  }

  /** Compute all insight values once and cache them as plain properties.
   *  Never use expensive computations inside Angular template-bound getters. */
  private computeInsights(): void {
    // ── Collect all loaded interactions ──
    const all: IInteraction[] = [];
    this.columns.forEach(col => all.push(...col.interactions));
    all.push(...this.unassignedColumn.interactions);

    // ── totalColumns ──
    this.totalColumns = this.columns.length + (this.unassignedColumn.total > 0 ? 1 : 0);

    // ── Sentiment breakdown (prefer server stats for full dataset) ──
    let positive = 0, neutral = 0, negative = 0;
    if (this.inboxStats) {
      positive = this.inboxStats.positive || 0;
      neutral  = this.inboxStats.neutral  || 0;
      negative = this.inboxStats.negative || 0;
    } else {
      all.forEach(i => {
        if (i.sentiment === 'positive') positive++;
        else if (i.sentiment === 'negative') negative++;
        else if (i.sentiment === 'neutral') neutral++;
      });
    }
    const sentTotal = positive + neutral + negative || 1;
    this.sentimentBreakdownInput = { positive, neutral, negative, total: sentTotal };

    // ── Bucket totals ──
    this.bucketTotal = this.columns.reduce((s, c) => s + c.total, 0) + this.unassignedColumn.total;
    const btTotal = this.bucketTotal || 1;
    this.bucketTopics = [...this.columns.map(col => ({
      name: col.bucket.name,
      color: col.bucket.color,
      count: col.total,
      percent: Math.round((col.total / btTotal) * 100)
    }))].sort((a, b) => b.count - a.count);

    // ── Most common topics (keyword frequency) ──
    const STOP = new Set([
      'i','me','my','we','our','you','your','he','she','it','they','them',
      'is','am','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','could','should','may','might','shall',
      'a','an','the','and','but','or','so','if','in','on','at','to','for',
      'of','with','by','from','up','about','into','than','then','that','this',
      'what','which','who','how','when','where','why','not','no','yes','can',
      'just','get','got','also','very','more','some','any','all','there','here'
    ]);
    const kmap = new Map<string, { count: number; sample: IInteraction }>();
    all.forEach(interaction => {
      const seen = new Set<string>();
      (interaction.content || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP.has(w))
        .forEach(word => {
          if (seen.has(word)) return;
          seen.add(word);
          const e = kmap.get(word);
          if (e) { e.count++; }
          else { kmap.set(word, { count: 1, sample: interaction }); }
        });
    });
    this.commonComments = Array.from(kmap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([keyword, { count, sample }]) => ({ keyword, count, sample }));

    // ── AI Recommendation ──
    const positivePercent = Math.round((positive / sentTotal) * 100);
    const negativePercent = Math.round((negative / sentTotal) * 100);
    let worstBucket = '', worstCount = 0;
    this.columns.forEach(col => {
      const neg = col.interactions.filter(i => i.sentiment === 'negative').length;
      if (neg > worstCount) { worstCount = neg; worstBucket = col.bucket.name; }
    });
    const unreadCount = all.filter(i => i.status === 'unread').length;
    if (sentTotal <= 1) {
      this.aiRecommendation = 'Load your inbox data to generate AI insights for your conversations.';
    } else if (negativePercent >= 20 && worstBucket) {
      this.aiRecommendation = `${worstCount} negative conversation${worstCount > 1 ? 's' : ''} in "${worstBucket}". Prioritise responses there to improve satisfaction.`;
    } else if (unreadCount > 10) {
      this.aiRecommendation = `You have ${unreadCount} unread conversations. Consider assigning them to team members to reduce response times.`;
    } else if (positivePercent >= 60) {
      this.aiRecommendation = 'Great sentiment overall! Consider sharing positive testimonials to boost brand trust.';
    } else {
      this.aiRecommendation = 'Engage consistently with your audience to maintain healthy sentiment scores across all channels.';
    }
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
    this.selectedInteractionId = interaction._id;
    this.interactionSelect.emit(interaction);
  }

  loadMore(column: BucketColumn): void {
    if (column.loading || column.interactions.length >= column.total) return;
    column.loading = true;
    const params: any = {
      intentBucket: column.bucket._id,
      limit: 20,
      page: Math.floor(column.interactions.length / 20) + 1
    };
    if (this.filters.platform) params.platform = this.filters.platform;
    if (this.filters.sentiment) params.sentiment = this.filters.sentiment;
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
    const params: any = {
      intentBucket: 'none',
      limit: 20,
      page: Math.floor(this.unassignedColumn.interactions.length / 20) + 1
    };
    if (this.filters.platform) params.platform = this.filters.platform;
    if (this.filters.sentiment) params.sentiment = this.filters.sentiment;
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

  getAvatarUrl(interaction: IInteraction): string | null {
    const author = interaction.author;
    return author?.avatarUrl || author?.profilePicture || null;
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

  getSentimentEmoji(sentiment?: string): string {
    if (sentiment === 'positive') return '😊';
    if (sentiment === 'negative') return '😠';
    return '';
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
