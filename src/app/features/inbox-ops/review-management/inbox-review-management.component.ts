import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IOpsReviewDetail,
  IOpsReviewRow,
  IOpsReviewStats,
  IOpsStatCard
} from '../../../core/models/inbox-ops.model';
import { OpsStatsRowComponent } from '../shared/ops-stats-row.component';
import { OpsFilterBarComponent } from '../shared/ops-filter-bar.component';
import { OpsStatusBadgeComponent } from '../shared/ops-status-badge.component';
import { OpsCustomerCellComponent } from '../shared/ops-customer-cell.component';
import { OpsDetailDrawerComponent } from '../shared/ops-detail-drawer.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-inbox-review-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OpsStatsRowComponent,
    OpsFilterBarComponent,
    OpsStatusBadgeComponent,
    OpsCustomerCellComponent,
    OpsDetailDrawerComponent,
    PaginationComponent
  ],
  templateUrl: './inbox-review-management.component.html'
})
export class InboxReviewManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  loading = true;
  actionLoading = false;
  rows: IOpsReviewRow[] = [];
  statCards: IOpsStatCard[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 30;

  activeTab = 'all';
  search = '';
  platform = '';

  drawerOpen = false;
  detail: IOpsReviewDetail | null = null;
  replyDraft = '';

  readonly tabs = [
    { value: 'all', label: 'All Reviews' },
    { value: 'rating_5', label: '5 ★' },
    { value: 'rating_4', label: '4 ★' },
    { value: 'rating_3', label: '3 ★ & below' },
    { value: 'awaiting_reply', label: 'Awaiting Reply' },
    { value: 'flagged', label: 'Flagged' }
  ];

  readonly platformOptions = [
    { value: 'google', label: 'Google' },
    { value: 'facebook', label: 'Facebook' }
  ];

  constructor(
    private ops: InboxOpsService,
    private notify: NotificationService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.loadList();
      });
    this.loadStats();
    this.loadList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStats(): void {
    this.ops.getReviewStats().subscribe({
      next: (s: IOpsReviewStats) => {
        this.statCards = [
          { label: 'Avg Rating', value: `${s.avgRating} ★`, tone: 'amber' },
          { label: 'Reviews This Month', value: s.reviewsThisMonth, tone: 'lime' },
          { label: 'Replies Sent', value: s.repliesSent, tone: 'green' },
          { label: 'Flagged Reviews', value: s.flaggedCount, tone: 'red' }
        ];
      }
    });
  }

  loadList(): void {
    this.loading = true;
    this.ops
      .listReviews({
        page: this.page,
        limit: this.pageSize,
        tab: this.activeTab === 'all' ? undefined : this.activeTab,
        platform: this.platform || undefined,
        search: this.search || undefined
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.rows = r.rows;
          this.total = r.total;
        },
        error: () => this.notify.error('Failed to load reviews')
      });
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.page = 1;
    this.loadList();
  }

  onSearchChange(q: string): void {
    this.search = q;
    this.search$.next(q);
  }

  onPlatformChange(p: string): void {
    this.platform = p;
    this.page = 1;
    this.loadList();
  }

  onPageChange(p: number): void {
    this.page = p;
    this.loadList();
  }

  openRow(row: IOpsReviewRow): void {
    this.ops.getReviewDetail(row.id).subscribe({
      next: (d) => {
        this.detail = d;
        this.replyDraft = d.aiDraft || '';
        this.drawerOpen = true;
      },
      error: () => this.notify.error('Failed to load review')
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.detail = null;
  }

  stars(n: number | null): string {
    if (!n) return '—';
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  suggestReply(): void {
    if (!this.detail) return;
    this.actionLoading = true;
    this.ops
      .suggestReviewReply(this.detail.id)
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (r) => {
          this.replyDraft = r.content;
          this.notify.success('AI draft generated');
        },
        error: () => this.notify.error('Failed to generate draft')
      });
  }

  publishReply(): void {
    if (!this.detail || !this.replyDraft.trim()) return;
    this.actionLoading = true;
    this.ops
      .publishReviewReply(this.detail.id, this.replyDraft.trim())
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.notify.success('Reply published');
          this.loadList();
          this.loadStats();
        },
        error: () => this.notify.error('Failed to publish reply')
      });
  }
}
