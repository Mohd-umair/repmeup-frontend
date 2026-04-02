import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IInboxFilters,
  InteractionType,
  Sentiment,
  InteractionStatus,
  ILabel,
  Platform,
  InboxViewMode
} from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';
import { inboxFilterToArray } from '../../../core/utils/inbox-filter-values';
import {
  InboxMultiselectFilterComponent,
  InboxMultiselectOption
} from '../inbox-multiselect-filter/inbox-multiselect-filter.component';
import { IIntentBucket } from '../../../core/services/intent-bucket.service';

/** Synthetic keys merged into the Status multiselect for chat session */
const CHAT_OPEN_KEY = '__chat_open__';
const CHAT_CLOSED_KEY = '__chat_closed__';

export interface AppliedFilterChip {
  category: 'label' | 'type' | 'sentiment' | 'status' | 'date' | 'chatSession' | 'platform' | 'intent';
  value: string;
  display: string;
}

@Component({
  selector: 'app-inbox-top-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, InboxMultiselectFilterComponent],
  templateUrl: './inbox-top-filters.component.html',
  styleUrls: ['./inbox-top-filters.component.scss']
})
export class InboxTopFiltersComponent implements OnChanges {
  @Output() filtersChange = new EventEmitter<IInboxFilters>();
  /** Emitted when list preset (All / Priority / …) changes from the Extra filter control */
  @Output() viewModeChange = new EventEmitter<InboxViewMode>();
  @Input() initialFilters: IInboxFilters = {};
  /** Synced from parent `platformFilters.platform` — not stored in `initialFilters` */
  @Input() initialPlatform: IInboxFilters['platform'];
  @Input() labels: ILabel[] = [];
  @Input() intentBuckets: IIntentBucket[] = [];
  /** Current inbox layout view (list vs buckets + preset). Used for Extra filter display. */
  @Input() viewMode: InboxViewMode = 'all';

  filters: IInboxFilters = {};
  dateFromModel = '';
  dateToModel = '';
  expanded = false;

  selectedLabelIds: string[] = [];
  selectedTypes: string[] = [];
  selectedSentiments: string[] = [];
  selectedStatuses: string[] = [];
  selectedPlatforms: string[] = [];
  /** Single intent bucket id (API supports one) */
  selectedIntentBucketIds: string[] = [];
  /** Open = active chats; Closed = session closed; null = all */
  chatSession: 'open' | 'closed' | null = null;


  typeOptions: InboxMultiselectOption[] = [
    { value: InteractionType.COMMENT, label: 'Comments', icon: '💬' },
    { value: InteractionType.DM, label: 'Direct Messages', icon: '📧' },
    { value: InteractionType.REVIEW, label: 'Reviews', icon: '⭐' },
    { value: InteractionType.MENTION, label: 'Mentions', icon: '@' }
  ];

  sentimentOptions: InboxMultiselectOption[] = [
    { value: Sentiment.POSITIVE, label: 'Positive', icon: '😊' },
    { value: Sentiment.NEUTRAL, label: 'Neutral', icon: '😐' },
    { value: Sentiment.NEGATIVE, label: 'Negative', icon: '😟' }
  ];

  private readonly statusOptionsCore: InboxMultiselectOption[] = [
    { value: InteractionStatus.UNREAD, label: 'Unread', icon: '📩' },
    { value: InteractionStatus.READ, label: 'Read', icon: '📖' },
    { value: InteractionStatus.REPLIED, label: 'Replied', icon: '✅' },
    { value: InteractionStatus.ASSIGNED, label: 'Assigned', icon: '👤' },
    { value: InteractionStatus.RESOLVED, label: 'Resolved', icon: '✔️' },
    { value: InteractionStatus.SPAM, label: 'Spam', icon: '🚫' },
    { value: InteractionStatus.ARCHIVED, label: 'Archived', icon: '📦' },
    { value: CHAT_OPEN_KEY, label: 'Chat open', icon: '💬' },
    { value: CHAT_CLOSED_KEY, label: 'Chat closed', icon: '🔒' }
  ];

  platformOptions: InboxMultiselectOption[] = [
    { value: Platform.INSTAGRAM, label: 'Instagram', icon: '📷' },
    { value: Platform.FACEBOOK, label: 'Facebook', icon: '👤' },
    { value: Platform.YOUTUBE, label: 'YouTube', icon: '▶️' },
    { value: Platform.GOOGLE, label: 'Google', icon: '🔍' },
    { value: Platform.LINKEDIN, label: 'LinkedIn', icon: '💼' },
    { value: Platform.WHATSAPP, label: 'WhatsApp', icon: '💬' },
    { value: Platform.WEBSITE, label: 'Website', icon: '🌐' }
  ];

  get intentOptions(): InboxMultiselectOption[] {
    return (this.intentBuckets || []).map((b) => ({
      value: b._id,
      label: b.name,
      icon: '📂'
    }));
  }

  /** Status multiselect: core + chat keys (shown as part of Status) */
  get statusOptionsForMultiselect(): InboxMultiselectOption[] {
    return this.statusOptionsCore;
  }

  get selectedStatusAndChatKeys(): string[] {
    const keys = [...this.selectedStatuses];
    if (this.chatSession === 'open') keys.push(CHAT_OPEN_KEY);
    if (this.chatSession === 'closed') keys.push(CHAT_CLOSED_KEY);
    return keys;
  }

  /** Value bound to Extra filter &lt;select&gt; (empty when bucket board is active) */
  get listViewModeForDropdown(): string {
    if (this.viewMode === 'buckets') return '';
    return this.viewMode;
  }

  get labelOptions(): InboxMultiselectOption[] {
    return (this.labels || []).map((l) => ({
      value: l._id,
      label: l.name,
      icon: l.icon
    }));
  }

  constructor(public themeService: ThemeService) {}

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilters']) {
      this.filters = { ...(this.initialFilters || {}) };
      this.dateFromModel = this.filters.dateFrom || '';
      this.dateToModel = this.filters.dateTo || '';
      this.syncSelectionsFromFilters();
    }
    if (changes['initialPlatform']) {
      this.selectedPlatforms = inboxFilterToArray(this.initialPlatform as any);
    }
  }

  private syncSelectionsFromFilters(): void {
    this.selectedTypes = inboxFilterToArray(this.filters.type as any);
    this.selectedSentiments = inboxFilterToArray(this.filters.sentiment as any);
    this.selectedStatuses = inboxFilterToArray(this.filters.status as any);
    this.selectedLabelIds = inboxFilterToArray(this.filters.label as any);
    const ib = this.filters.intentBucket;
    this.selectedIntentBucketIds =
      ib != null && String(ib).trim() !== '' ? [String(ib).trim()] : [];
    const cs = (this.filters as IInboxFilters).chatSession;
    this.chatSession = cs === 'open' || cs === 'closed' ? cs : null;
  }

  private setMultiField<K extends keyof IInboxFilters>(key: K, values: string[]): void {
    if (values.length === 0) {
      delete this.filters[key];
      return;
    }
    if (values.length === 1) {
      (this.filters as any)[key] = values[0];
    } else {
      (this.filters as any)[key] = [...values];
    }
  }

  private applySelectionsToFilters(): void {
    this.setMultiField('type', this.selectedTypes);
    this.setMultiField('sentiment', this.selectedSentiments);
    this.setMultiField('status', this.selectedStatuses);
    this.setMultiField('label', this.selectedLabelIds);
    if (this.selectedIntentBucketIds.length === 1) {
      this.filters.intentBucket = this.selectedIntentBucketIds[0];
    } else {
      delete this.filters.intentBucket;
    }
    if (this.chatSession) {
      (this.filters as IInboxFilters).chatSession = this.chatSession;
    } else {
      delete (this.filters as IInboxFilters).chatSession;
    }
  }

  onViewModeDropdownSelect(mode: string): void {
    if (!mode || mode === 'buckets') return;
    this.viewModeChange.emit(mode as InboxViewMode);
  }

  onPlatformsChange(vals: string[]): void {
    this.selectedPlatforms = vals;
    this.emitFilters(true);
  }

  onIntentChange(vals: string[]): void {
    this.selectedIntentBucketIds = vals.length ? [vals[vals.length - 1]] : [];
    this.emitFilters();
  }

  onLabelsChange(vals: string[]): void {
    this.selectedLabelIds = vals;
    this.emitFilters();
  }

  onTypesChange(vals: string[]): void {
    this.selectedTypes = vals;
    this.emitFilters();
  }

  onSentimentsChange(vals: string[]): void {
    this.selectedSentiments = vals;
    this.emitFilters();
  }

  onStatusAndChatChange(vals: string[]): void {
    const openSel = vals.includes(CHAT_OPEN_KEY);
    const closedSel = vals.includes(CHAT_CLOSED_KEY);
    this.selectedStatuses = vals.filter((v) => v !== CHAT_OPEN_KEY && v !== CHAT_CLOSED_KEY);
    if (openSel && !closedSel) {
      this.chatSession = 'open';
    } else if (closedSel && !openSel) {
      this.chatSession = 'closed';
    } else {
      this.chatSession = null;
    }
    this.emitFilters();
  }

  onDateFromChange(value: string | null | undefined): void {
    const v = (value ?? '').toString().trim();
    this.dateFromModel = v;
    if (v) {
      this.filters.dateFrom = v;
    } else {
      delete this.filters.dateFrom;
    }
    this.emitFilters();
  }

  onDateToChange(value: string | null | undefined): void {
    const v = (value ?? '').toString().trim();
    this.dateToModel = v;
    if (v) {
      this.filters.dateTo = v;
    } else {
      delete this.filters.dateTo;
    }
    this.emitFilters();
  }

  clearDateRange(): void {
    delete this.filters.dateFrom;
    delete this.filters.dateTo;
    this.dateFromModel = '';
    this.dateToModel = '';
    this.emitFilters();
  }

  clearFilters(): void {
    this.filters = {};
    this.dateFromModel = '';
    this.dateToModel = '';
    this.selectedLabelIds = [];
    this.selectedTypes = [];
    this.selectedSentiments = [];
    this.selectedStatuses = [];
    this.selectedPlatforms = [];
    this.selectedIntentBucketIds = [];
    this.chatSession = null;
    this.emitFilters(true);
  }

  /**
   * @param includePlatform when true, `platform` is set on the payload so the parent can sync `platformFilters`.
   */
  private emitFilters(includePlatform = false): void {
    this.applySelectionsToFilters();
    if (!this.filters.dateFrom?.toString().trim()) delete this.filters.dateFrom;
    if (!this.filters.dateTo?.toString().trim()) delete this.filters.dateTo;
    const payload: IInboxFilters = { ...this.filters };
    if (includePlatform) {
      if (this.selectedPlatforms.length === 0) {
        (payload as any).platform = undefined;
      } else if (this.selectedPlatforms.length === 1) {
        payload.platform = this.selectedPlatforms[0] as Platform;
      } else {
        payload.platform = [...this.selectedPlatforms] as Platform[];
      }
    }
    this.filtersChange.emit(payload);
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedPlatforms.length > 0 ||
      this.selectedIntentBucketIds.length > 0 ||
      this.selectedTypes.length > 0 ||
      this.selectedSentiments.length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.selectedLabelIds.length > 0 ||
      this.chatSession != null ||
      !!(this.filters.dateFrom || this.filters.dateTo)
    );
  }

  /** Pills shown under the header so applied filters stay visible (collapsed or expanded). */
  get appliedFilterChips(): AppliedFilterChip[] {
    const chips: AppliedFilterChip[] = [];
    for (const p of this.selectedPlatforms) {
      const o = this.platformOptions.find((x) => x.value === p);
      chips.push({ category: 'platform', value: p, display: o?.label || p });
    }
    for (const id of this.selectedIntentBucketIds) {
      const b = (this.intentBuckets || []).find((x) => x._id === id);
      chips.push({ category: 'intent', value: id, display: b?.name || id });
    }
    for (const id of this.selectedLabelIds) {
      const lab = (this.labels || []).find((l) => l._id === id);
      chips.push({
        category: 'label',
        value: id,
        display: lab?.name || id
      });
    }
    for (const v of this.selectedTypes) {
      const o = this.typeOptions.find((t) => t.value === v);
      chips.push({ category: 'type', value: v, display: o?.label || v });
    }
    for (const v of this.selectedSentiments) {
      const o = this.sentimentOptions.find((s) => s.value === v);
      chips.push({ category: 'sentiment', value: v, display: o?.label || v });
    }
    for (const v of this.selectedStatuses) {
      const o = this.statusOptionsCore.find((s) => s.value === v);
      chips.push({ category: 'status', value: v, display: o?.label || v });
    }
    if (this.chatSession === 'open') {
      chips.push({ category: 'status', value: CHAT_OPEN_KEY, display: 'Chat open' });
    } else if (this.chatSession === 'closed') {
      chips.push({ category: 'status', value: CHAT_CLOSED_KEY, display: 'Chat closed' });
    }
    if (this.dateFromModel || this.dateToModel) {
      let display = '';
      if (this.dateFromModel && this.dateToModel) {
        display = `${this.dateFromModel} → ${this.dateToModel}`;
      } else if (this.dateFromModel) {
        display = `From ${this.dateFromModel}`;
      } else {
        display = `To ${this.dateToModel}`;
      }
      chips.push({ category: 'date', value: 'range', display });
    }
    return chips;
  }

  trackByChip(_index: number, chip: AppliedFilterChip): string {
    return `${chip.category}:${chip.value}`;
  }

  chipCategoryLabel(chip: AppliedFilterChip): string {
    switch (chip.category) {
      case 'platform':
        return 'Platform';
      case 'intent':
        return 'Intent';
      case 'label':
        return 'Label';
      case 'type':
        return 'Type';
      case 'sentiment':
        return 'Sentiment';
      case 'status':
        return 'Status';
      case 'date':
        return 'Date';
      default:
        return '';
    }
  }

  removeAppliedChip(chip: AppliedFilterChip, ev?: Event): void {
    ev?.stopPropagation();
    switch (chip.category) {
      case 'platform':
        this.selectedPlatforms = this.selectedPlatforms.filter((x) => x !== chip.value);
        this.emitFilters(true);
        return;
      case 'intent':
        this.selectedIntentBucketIds = [];
        break;
      case 'label':
        this.selectedLabelIds = this.selectedLabelIds.filter((x) => x !== chip.value);
        break;
      case 'type':
        this.selectedTypes = this.selectedTypes.filter((x) => x !== chip.value);
        break;
      case 'sentiment':
        this.selectedSentiments = this.selectedSentiments.filter((x) => x !== chip.value);
        break;
      case 'status':
        if (chip.value === CHAT_OPEN_KEY || chip.value === CHAT_CLOSED_KEY) {
          this.chatSession = null;
        } else {
          this.selectedStatuses = this.selectedStatuses.filter((x) => x !== chip.value);
        }
        break;
      case 'date':
        this.clearDateRange();
        return;
    }
    this.emitFilters();
  }

  getSentimentBackground(sentiment: string, isActive: boolean): string {
    if (!isActive) return 'white';
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return 'linear-gradient(135deg, #10B981, #059669)';
      case Sentiment.NEGATIVE:
        return 'linear-gradient(135deg, #EF4444, #DC2626)';
      default:
        return 'linear-gradient(135deg, #6B7280, #4B5563)';
    }
  }

  getSentimentHoverBackground(sentiment: string): string {
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return 'linear-gradient(to right, #D1FAE5, #A7F3D0)';
      case Sentiment.NEGATIVE:
        return 'linear-gradient(to right, #FEE2E2, #FECACA)';
      default:
        return 'linear-gradient(to right, #F3F4F6, #E5E7EB)';
    }
  }

  getSentimentShadow(sentiment: string, isActive: boolean): string {
    if (!isActive) return '0 1px 3px rgba(0,0,0,0.1)';
    switch (sentiment) {
      case Sentiment.POSITIVE:
        return '0 4px 12px rgba(16, 185, 129, 0.4)';
      case Sentiment.NEGATIVE:
        return '0 4px 12px rgba(239, 68, 68, 0.4)';
      default:
        return '0 4px 12px rgba(107, 114, 128, 0.4)';
    }
  }

  getStatusBackground(status: string, isActive: boolean): string {
    if (!isActive) return 'white';
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'linear-gradient(135deg, #F59E0B, #D97706)';
      case InteractionStatus.READ:
        return 'linear-gradient(135deg, #3B82F6, #2563EB)';
      case InteractionStatus.REPLIED:
        return 'linear-gradient(135deg, #10B981, #059669)';
      case InteractionStatus.ASSIGNED:
        return 'linear-gradient(135deg, #8B5CF6, #7C3AED)';
      case InteractionStatus.RESOLVED:
        return 'linear-gradient(135deg, #14B8A6, #0D9488)';
      default:
        return 'linear-gradient(135deg, #6B7280, #4B5563)';
    }
  }

  getStatusHoverBackground(status: string): string {
    switch (status) {
      case InteractionStatus.UNREAD:
        return 'linear-gradient(to right, #FEF3C7, #FDE68A)';
      case InteractionStatus.READ:
        return 'linear-gradient(to right, #DBEAFE, #BFDBFE)';
      case InteractionStatus.REPLIED:
        return 'linear-gradient(to right, #D1FAE5, #A7F3D0)';
      case InteractionStatus.ASSIGNED:
        return 'linear-gradient(to right, #EDE9FE, #DDD6FE)';
      case InteractionStatus.RESOLVED:
        return 'linear-gradient(to right, #CCFBF1, #99F6E4)';
      default:
        return 'linear-gradient(to right, #F3F4F6, #E5E7EB)';
    }
  }

  getStatusShadow(status: string, isActive: boolean): string {
    if (!isActive) return '0 1px 3px rgba(0,0,0,0.1)';
    switch (status) {
      case InteractionStatus.UNREAD:
        return '0 4px 12px rgba(245, 158, 11, 0.4)';
      case InteractionStatus.READ:
        return '0 4px 12px rgba(59, 130, 246, 0.4)';
      case InteractionStatus.REPLIED:
        return '0 4px 12px rgba(16, 185, 129, 0.4)';
      case InteractionStatus.ASSIGNED:
        return '0 4px 12px rgba(139, 92, 246, 0.4)';
      case InteractionStatus.RESOLVED:
        return '0 4px 12px rgba(20, 184, 166, 0.4)';
      default:
        return '0 4px 12px rgba(107, 114, 128, 0.4)';
    }
  }
}
