import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IInboxFilters, InteractionType, Sentiment, InteractionStatus, ILabel } from '../../../core/models/interaction.model';
import { ThemeService } from '../../../core/services/theme.service';
import { inboxFilterToArray } from '../../../core/utils/inbox-filter-values';
import {
  InboxMultiselectFilterComponent,
  InboxMultiselectOption
} from '../inbox-multiselect-filter/inbox-multiselect-filter.component';

export interface AppliedFilterChip {
  category: 'label' | 'type' | 'sentiment' | 'status' | 'date' | 'chatSession';
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
  @Input() initialFilters: IInboxFilters = {};
  @Input() labels: ILabel[] = [];

  filters: IInboxFilters = {};
  dateFromModel = '';
  dateToModel = '';
  expanded = false;

  selectedLabelIds: string[] = [];
  selectedTypes: string[] = [];
  selectedSentiments: string[] = [];
  selectedStatuses: string[] = [];
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

  statusOptions: InboxMultiselectOption[] = [
    { value: InteractionStatus.UNREAD, label: 'Unread', icon: '📩' },
    { value: InteractionStatus.READ, label: 'Read', icon: '📖' },
    { value: InteractionStatus.REPLIED, label: 'Replied', icon: '✅' },
    { value: InteractionStatus.ASSIGNED, label: 'Assigned', icon: '👤' },
    { value: InteractionStatus.RESOLVED, label: 'Resolved', icon: '✔️' }
  ];

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
    if (!changes['initialFilters']) return;
    this.filters = { ...(this.initialFilters || {}) };
    this.dateFromModel = this.filters.dateFrom || '';
    this.dateToModel = this.filters.dateTo || '';
    this.syncSelectionsFromFilters();
  }

  private syncSelectionsFromFilters(): void {
    this.selectedTypes = inboxFilterToArray(this.filters.type as any);
    this.selectedSentiments = inboxFilterToArray(this.filters.sentiment as any);
    this.selectedStatuses = inboxFilterToArray(this.filters.status as any);
    this.selectedLabelIds = inboxFilterToArray(this.filters.label as any);
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
    if (this.chatSession) {
      (this.filters as IInboxFilters).chatSession = this.chatSession;
    } else {
      delete (this.filters as IInboxFilters).chatSession;
    }
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

  onStatusesChange(vals: string[]): void {
    this.selectedStatuses = vals;
    this.emitFilters();
  }

  onChatSessionChange(val: 'open' | 'closed' | null): void {
    this.chatSession = val;
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
    this.chatSession = null;
    this.emitFilters();
  }

  private emitFilters(): void {
    this.applySelectionsToFilters();
    if (!this.filters.dateFrom?.toString().trim()) delete this.filters.dateFrom;
    if (!this.filters.dateTo?.toString().trim()) delete this.filters.dateTo;
    this.filtersChange.emit({ ...this.filters });
  }

  hasActiveFilters(): boolean {
    return (
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
      const o = this.statusOptions.find((s) => s.value === v);
      chips.push({ category: 'status', value: v, display: o?.label || v });
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
    if (this.chatSession === 'open') {
      chips.push({ category: 'chatSession', value: 'open', display: 'Chat open' });
    } else if (this.chatSession === 'closed') {
      chips.push({ category: 'chatSession', value: 'closed', display: 'Chat closed' });
    }
    return chips;
  }

  trackByChip(_index: number, chip: AppliedFilterChip): string {
    return `${chip.category}:${chip.value}`;
  }

  chipCategoryLabel(chip: AppliedFilterChip): string {
    switch (chip.category) {
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
      case 'chatSession':
        return 'Chat';
      default:
        return '';
    }
  }

  removeAppliedChip(chip: AppliedFilterChip, ev?: Event): void {
    ev?.stopPropagation();
    switch (chip.category) {
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
        this.selectedStatuses = this.selectedStatuses.filter((x) => x !== chip.value);
        break;
      case 'date':
        this.clearDateRange();
        return;
      case 'chatSession':
        this.chatSession = null;
        break;
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
