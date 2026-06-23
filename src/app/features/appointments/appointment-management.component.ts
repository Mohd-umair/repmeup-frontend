import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { AppointmentService } from '../../core/services/appointment.service';
import { NotificationService } from '../../core/services/notification.service';
import { IApptDetail, IApptRow, IApptStats, APPOINTMENT_CHANNELS } from '../../core/models/appointment.model';
import { IOpsStatCard, IOpsFilterTab } from '../../core/models/inbox-ops.model';
import { OpsStatsRowComponent } from '../inbox-ops/shared/ops-stats-row.component';
import { OpsFilterBarComponent } from '../inbox-ops/shared/ops-filter-bar.component';
import { OpsStatusBadgeComponent } from '../inbox-ops/shared/ops-status-badge.component';
import { OpsCustomerCellComponent } from '../inbox-ops/shared/ops-customer-cell.component';
import { OpsDetailDrawerComponent } from '../inbox-ops/shared/ops-detail-drawer.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { AppointmentBookingModalComponent } from './appointment-booking-modal.component';

@Component({
  selector: 'app-appointment-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    OpsStatsRowComponent, OpsFilterBarComponent, OpsStatusBadgeComponent,
    OpsCustomerCellComponent, OpsDetailDrawerComponent, PaginationComponent,
    AppointmentBookingModalComponent
  ],
  templateUrl: './appointment-management.component.html'
})
export class AppointmentManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  loading = true;
  actionLoading = false;
  rows: IApptRow[] = [];
  stats: IApptStats | null = null;
  statCards: IOpsStatCard[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 30;

  activeTab = 'upcoming';
  search = '';
  channel = '';

  drawerOpen = false;
  detail: IApptDetail | null = null;

  bookingModalOpen = false;
  bookingMode: 'create' | 'reschedule' = 'create';
  rescheduleId: string | null = null;
  reschedulePresetService: string | null = null;

  actionModal: 'cancel' | null = null;
  reasonText = '';

  readonly tabs: IOpsFilterTab[] = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No-show' }
  ];
  readonly channelOptions = APPOINTMENT_CHANNELS;

  constructor(
    private appt: AppointmentService,
    private notify: NotificationService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.page = 1; this.loadList(); });
    this.loadStats();
    this.loadList();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadStats(): void {
    this.appt.stats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.stats = s;
        this.statCards = [
          { label: 'Upcoming', value: s.upcoming, tone: 'lime' },
          { label: 'Today', value: s.today, tone: 'blue' },
          { label: 'Completed', value: s.completed, tone: 'green' },
          { label: 'No-shows', value: s.noShow, tone: 'red' }
        ];
      }
    });
  }

  loadList(): void {
    this.loading = true;
    this.appt.list({
      page: this.page, limit: this.pageSize,
      tab: this.activeTab === 'all' ? undefined : this.activeTab,
      channel: this.channel || undefined,
      search: this.search || undefined
    }).pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (r) => { this.rows = r.rows; this.total = r.total; },
        error: () => this.notify.error('Failed to load appointments')
      });
  }

  onTabChange(tab: string): void { this.activeTab = tab; this.page = 1; this.loadList(); }
  onSearchChange(q: string): void { this.search = q; this.search$.next(q); }
  onChannelChange(ch: string): void { this.channel = ch; this.page = 1; this.loadList(); }
  onPageChange(p: number): void { this.page = p; this.loadList(); }

  openRow(row: IApptRow): void {
    this.appt.detail(row.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (d) => { this.detail = d; this.drawerOpen = true; },
      error: () => this.notify.error('Failed to load appointment')
    });
  }

  closeDrawer(): void { this.drawerOpen = false; this.detail = null; }

  viewChat(): void {
    const id = this.detail?.sourceInteractionId;
    if (id) this.router.navigate(['/app/inbox'], { queryParams: { selected: id } });
  }

  statusActionLabel(status: string): string {
    return ({ confirmed: 'Confirm', completed: 'Mark Completed', cancelled: 'Cancel', no_show: 'No-show' } as Record<string, string>)[status] || status;
  }

  openStatusAction(status: string): void {
    if (status === 'cancelled') { this.reasonText = ''; this.actionModal = 'cancel'; }
    else this.updateStatus(status);
  }

  closeActionModal(): void { this.actionModal = null; }

  submitCancel(): void { this.updateStatus('cancelled', { reason: this.reasonText.trim() || undefined }); }

  updateStatus(status: string, extra?: Record<string, any>): void {
    if (!this.detail) return;
    this.actionLoading = true;
    this.appt.updateStatus(this.detail.id, status, extra)
      .pipe(finalize(() => (this.actionLoading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (d) => { this.detail = d; this.actionModal = null; this.notify.success('Appointment updated'); this.loadList(); this.loadStats(); },
        error: (e) => this.notify.error(e?.error?.error || 'Failed to update appointment')
      });
  }

  openNewBooking(): void {
    this.bookingMode = 'create'; this.rescheduleId = null; this.reschedulePresetService = null; this.bookingModalOpen = true;
  }

  openReschedule(): void {
    if (!this.detail) return;
    this.bookingMode = 'reschedule';
    this.rescheduleId = this.detail.id;
    this.reschedulePresetService = this.detail.serviceId;
    this.bookingModalOpen = true;
  }

  onBooked(): void {
    this.bookingModalOpen = false;
    this.loadList();
    this.loadStats();
    if (this.detail && this.bookingMode === 'reschedule') this.openRow({ id: this.detail.id } as IApptRow);
  }

  trackRow = (row: IApptRow) => row.id;
}
