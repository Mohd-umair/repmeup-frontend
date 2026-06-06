import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IOpsOrderDetail,
  IOpsOrderRow,
  IOpsOrderStats,
  IOpsStatCard
} from '../../../core/models/inbox-ops.model';
import { OpsStatsRowComponent } from '../shared/ops-stats-row.component';
import { OpsFilterBarComponent } from '../shared/ops-filter-bar.component';
import { OpsStatusBadgeComponent } from '../shared/ops-status-badge.component';
import { OpsCustomerCellComponent } from '../shared/ops-customer-cell.component';
import { OpsDetailDrawerComponent } from '../shared/ops-detail-drawer.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { CreateOrderModalComponent } from './create-order-modal.component';
import { formatInrCompact } from '../../../core/utils/currency-format';

@Component({
  selector: 'app-inbox-order-management',
  standalone: true,
  imports: [
    CommonModule,
    OpsStatsRowComponent,
    OpsFilterBarComponent,
    OpsStatusBadgeComponent,
    OpsCustomerCellComponent,
    OpsDetailDrawerComponent,
    PaginationComponent,
    CreateOrderModalComponent
  ],
  templateUrl: './inbox-order-management.component.html'
})
export class InboxOrderManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  loading = true;
  statsLoading = true;
  actionLoading = false;
  rows: IOpsOrderRow[] = [];
  stats: IOpsOrderStats | null = null;
  statCards: IOpsStatCard[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 30;

  activeTab = 'all';
  search = '';
  channel = '';

  drawerOpen = false;
  detail: IOpsOrderDetail | null = null;
  createModalOpen = false;

  readonly tabs = [
    { value: 'all', label: 'All Orders' },
    { value: 'paid', label: 'Paid' },
    { value: 'payment_pending', label: 'Payment Pending' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  readonly channelOptions = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'voice', label: 'Voice' },
    { value: 'manual', label: 'Manual' }
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
    this.statsLoading = true;
    this.ops
      .getOrderStats()
      .pipe(finalize(() => (this.statsLoading = false)))
      .subscribe({
        next: (s) => {
          this.stats = s;
          this.statCards = [
            { label: 'Total Orders', value: s.totalOrders, sub: s.deltaVsYesterdayPct != null ? `${s.deltaVsYesterdayPct >= 0 ? '+' : ''}${s.deltaVsYesterdayPct}% vs yesterday` : undefined, tone: 'lime' },
            { label: 'Revenue Closed', value: this.formatRevenue(s.revenueClosed), tone: 'green' },
            { label: 'Pending Payment', value: s.pendingPayment, tone: 'amber' },
            { label: 'Shipped Today', value: s.shippedToday, tone: 'blue' }
          ];
        }
      });
  }

  loadList(): void {
    this.loading = true;
    this.ops
      .listOrders({
        page: this.page,
        limit: this.pageSize,
        tab: this.activeTab === 'all' ? undefined : this.activeTab,
        channel: this.channel || undefined,
        search: this.search || undefined
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.rows = r.rows;
          this.total = r.total;
        },
        error: () => this.notify.error('Failed to load orders')
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

  onChannelChange(ch: string): void {
    this.channel = ch;
    this.page = 1;
    this.loadList();
  }

  onPageChange(p: number): void {
    this.page = p;
    this.loadList();
  }

  openRow(row: IOpsOrderRow): void {
    this.ops.getOrderDetail(row.id).subscribe({
      next: (d) => {
        this.detail = d;
        this.drawerOpen = true;
      },
      error: () => this.notify.error('Failed to load order details')
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.detail = null;
  }

  viewChat(): void {
    const id = this.detail?.sourceInteractionId;
    if (!id) return;
    this.router.navigate(['/app/inbox'], { queryParams: { selected: id } });
  }

  markShipped(): void {
    if (!this.detail) return;
    this.updateStatus('shipped');
  }

  updateStatus(status: string): void {
    if (!this.detail) return;
    this.actionLoading = true;
    this.ops
      .updateOrderStatus(this.detail.id, status)
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.notify.success('Order updated');
          this.loadList();
          this.loadStats();
        },
        error: () => this.notify.error('Failed to update order')
      });
  }

  formatRevenue(n: number): string {
    return formatInrCompact(n);
  }

  onOrderCreated(): void {
    this.loadList();
    this.loadStats();
  }

  trackRow = (row: IOpsOrderRow) => row.id;
}
