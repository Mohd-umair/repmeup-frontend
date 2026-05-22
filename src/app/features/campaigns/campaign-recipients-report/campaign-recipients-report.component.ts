import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import {
  CampaignService,
  ICampaign,
  ICampaignRecipient,
  ICampaignRecipientSummary,
  CampaignRecipientReportStatus
} from '../../../core/services/campaign.service';

@Component({
  selector: 'app-campaign-recipients-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-recipients-report.component.html'
})
export class CampaignRecipientsReportComponent implements OnInit, OnDestroy, OnChanges {
  @Input() campaign: ICampaign | null = null;
  @Output() closed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  loading = false;
  error = '';

  summary: ICampaignRecipientSummary | null = null;
  recipients: ICampaignRecipient[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 25;

  filterStatus = '';
  searchPhone = '';

  readonly statusFilters: { value: string; label: string }[] = [
    { value: '',          label: 'All statuses' },
    { value: 'pending',   label: 'Pending' },
    { value: 'sent',      label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'read',      label: 'Read' },
    { value: 'replied',   label: 'Replied' },
    { value: 'failed',    label: 'Failed' }
  ];

  readonly summaryChips: { key: keyof ICampaignRecipientSummary; label: string; color: string }[] = [
    { key: 'total',     label: 'Total',     color: 'text-gray-400' },
    { key: 'pending',   label: 'Pending',   color: 'text-gray-400' },
    { key: 'sent',      label: 'Sent',      color: 'text-sky-400' },
    { key: 'delivered', label: 'Delivered', color: 'text-blue-400' },
    { key: 'read',      label: 'Read',      color: 'text-indigo-400' },
    { key: 'replied',   label: 'Replied',   color: 'text-emerald-400' },
    { key: 'failed',    label: 'Failed',    color: 'text-red-400' }
  ];

  constructor(private campaignService: CampaignService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign'] && !changes['campaign'].firstChange) {
      this.page = 1;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (!this.campaign?._id) return;
    this.loading = true;
    this.error = '';
    this.campaignService
      .getRecipientsReport(this.campaign._id, {
        page: this.page,
        limit: this.pageSize,
        reportStatus: this.filterStatus || undefined,
        search: this.searchPhone.trim() || undefined
      })
      .pipe(takeUntil(this.destroy$), finalize(() => (this.loading = false)))
      .subscribe({
        next: r => {
          this.summary  = r.summary || null;
          this.recipients = r.recipients || [];
          this.total    = r.total || 0;
        },
        error: err => {
          this.error = err?.error?.error || 'Failed to load recipient report';
        }
      });
  }

  onFilterChange(status: string): void {
    this.filterStatus = status;
    this.page = 1;
    this.load();
  }

  onSearch(): void {
    this.page = 1;
    this.load();
  }

  clearSearch(): void {
    this.searchPhone = '';
    this.page = 1;
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page < this.totalPages()) { this.page++; this.load(); }
  }

  close(): void {
    this.closed.emit();
  }

  summaryCount(key: keyof ICampaignRecipientSummary): number {
    return this.summary?.[key] ?? 0;
  }

  /** Same badge pattern used in campaigns list and all other dashboard tables */
  statusBadgeClass(status: CampaignRecipientReportStatus | string | undefined): string {
    const map: Record<string, string> = {
      pending:   'bg-gray-500/20 text-gray-400',
      sent:      'bg-sky-500/20 text-sky-400',
      delivered: 'bg-blue-500/20 text-blue-400',
      read:      'bg-indigo-500/20 text-indigo-400',
      replied:   'bg-emerald-500/20 text-emerald-400',
      failed:    'bg-red-500/20 text-red-400'
    };
    return map[status || 'pending'] || map['pending'];
  }

  errorDetail(r: ICampaignRecipient): string {
    return r.deliveryError || r.errorMessage || '';
  }
}
