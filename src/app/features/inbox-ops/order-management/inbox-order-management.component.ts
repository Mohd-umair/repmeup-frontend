import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IOpsOrderDetail,
  IOpsOrderRow,
  IOpsOrderStats,
  IOpsStatCard,
  IOrderStatusExtra
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
    FormsModule,
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

  // Action modals for status transitions that need extra input.
  actionModal: 'dispatch' | 'cancel' | 'return' | 'refund' | 'shipping' | null = null;
  dispatchForm = { courier: '', trackingNumber: '', trackingUrl: '' };
  reasonText = '';
  refundForm = { amount: '', reference: '' };
  shippingForm = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };

  readonly tabs = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'payment_pending', label: 'Awaiting Payment' },
    { value: 'paid', label: 'Paid' },
    { value: 'processing', label: 'Processing' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'returns', label: 'Returns' }
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
    public router: Router,
    private route: ActivatedRoute
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

    // Deep-link from the inbox "Order placed" chip: /app/inbox/order-management?order=<id>
    const orderId = this.route.snapshot.queryParamMap.get('order');
    if (orderId) this.openOrderById(orderId);
  }

  /** Open a specific order's detail drawer (used by the inbox deep-link). */
  openOrderById(id: string): void {
    this.ops.getOrderDetail(id).subscribe({
      next: (d) => {
        this.detail = d;
        this.drawerOpen = true;
      },
      error: () => this.notify.error('Could not open that order')
    });
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
            { label: 'Awaiting Action', value: s.pendingPayment, tone: 'amber' },
            { label: 'Dispatched Today', value: s.shippedToday, tone: 'blue' }
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
    this.openStatusAction('dispatched');
  }

  /** Friendly button label for a status transition. */
  statusActionLabel(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'Confirm Order',
      payment_pending: 'Request Payment',
      paid: 'Mark Paid',
      processing: 'Mark Processing',
      dispatched: 'Dispatch',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Mark Delivered',
      cancelled: 'Cancel Order',
      returned: 'Mark Returned',
      refunded: 'Refund'
    };
    return map[status] || status;
  }

  /** Statuses that need extra input open a modal; the rest transition directly. */
  openStatusAction(status: string): void {
    if (status === 'dispatched') {
      this.dispatchForm = { courier: '', trackingNumber: '', trackingUrl: '' };
      this.actionModal = 'dispatch';
    } else if (status === 'cancelled') {
      this.reasonText = '';
      this.actionModal = 'cancel';
    } else if (status === 'returned') {
      this.reasonText = '';
      this.actionModal = 'return';
    } else if (status === 'refunded') {
      this.refundForm = { amount: '', reference: '' };
      this.actionModal = 'refund';
    } else {
      this.updateStatus(status);
    }
  }

  closeActionModal(): void {
    this.actionModal = null;
  }

  submitDispatch(): void {
    this.updateStatus('dispatched', { tracking: { ...this.dispatchForm } });
  }

  submitReason(status: 'cancelled' | 'returned'): void {
    this.updateStatus(status, { reason: this.reasonText.trim() || undefined });
  }

  submitRefund(): void {
    this.updateStatus('refunded', {
      refund: { amount: this.refundForm.amount || undefined, reference: this.refundForm.reference.trim() || undefined }
    });
  }

  /** Open the structured shipping-address editor, seeded from the current order. */
  openShippingEditor(): void {
    const s = this.detail?.shipping || {};
    this.shippingForm = {
      name: s.name || this.detail?.customer?.name || '',
      phone: s.phone || '',
      line1: s.line1 || '',
      line2: s.line2 || '',
      city: s.city || '',
      state: s.state || '',
      pincode: s.pincode || '',
      country: s.country || 'India'
    };
    this.actionModal = 'shipping';
  }

  saveShipping(): void {
    if (!this.detail) return;
    this.actionLoading = true;
    this.ops
      .updateOrderShipping(this.detail.id, { shipping: { ...this.shippingForm }, buyerName: this.shippingForm.name, buyerPhone: this.shippingForm.phone })
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.actionModal = null;
          this.notify.success('Shipping address saved');
        },
        error: () => this.notify.error('Failed to save shipping address')
      });
  }

  updateStatus(status: string, extra?: IOrderStatusExtra): void {
    if (!this.detail) return;
    this.actionLoading = true;
    this.ops
      .updateOrderStatus(this.detail.id, status, extra)
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.actionModal = null;
          this.notify.success('Order updated');
          this.loadList();
          this.loadStats();
        },
        error: (e) => this.notify.error(e?.error?.error || 'Failed to update order')
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
