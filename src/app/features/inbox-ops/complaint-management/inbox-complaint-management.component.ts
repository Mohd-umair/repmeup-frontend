import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import {
  IOpsComplaintDetail,
  IOpsComplaintRow,
  IOpsComplaintStats,
  IOpsStatCard
} from '../../../core/models/inbox-ops.model';
import { OpsStatsRowComponent } from '../shared/ops-stats-row.component';
import { OpsFilterBarComponent } from '../shared/ops-filter-bar.component';
import { OpsStatusBadgeComponent } from '../shared/ops-status-badge.component';
import { OpsCustomerCellComponent } from '../shared/ops-customer-cell.component';
import { OpsDetailDrawerComponent } from '../shared/ops-detail-drawer.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-inbox-complaint-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OpsStatsRowComponent,
    OpsFilterBarComponent,
    OpsStatusBadgeComponent,
    OpsCustomerCellComponent,
    OpsDetailDrawerComponent,
    PaginationComponent
  ],
  templateUrl: './inbox-complaint-management.component.html'
})
export class InboxComplaintManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  loading = true;
  actionLoading = false;
  rows: IOpsComplaintRow[] = [];
  statCards: IOpsStatCard[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 30;

  activeTab = 'all';
  search = '';
  channel = '';
  agents: IAvailableAgent[] = [];
  selectedAssignee = '';

  drawerOpen = false;
  detail: IOpsComplaintDetail | null = null;
  resolveNote = '';

  readonly tabs = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' }
  ];

  readonly channelOptions = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'email', label: 'Email' }
  ];

  constructor(
    private ops: InboxOpsService,
    private notify: NotificationService,
    private users: UserService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.loadList();
      });
    this.users.getAvailableAgents().subscribe({
      next: (r) => (this.agents = r.data ?? [])
    });
    this.loadStats();
    this.loadList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStats(): void {
    this.ops.getComplaintStats().subscribe({
      next: (s: IOpsComplaintStats) => {
        this.statCards = [
          { label: 'Open Complaints', value: s.open, sub: s.highPriorityOpen ? `${s.highPriorityOpen} high priority` : undefined, tone: 'red' },
          { label: 'Acknowledged', value: s.acknowledged, tone: 'amber' },
          { label: 'Resolved This Month', value: s.resolvedThisMonth, tone: 'green' },
          { label: 'Avg Resolution Time', value: `${s.avgResolutionHours}h`, tone: 'blue' }
        ];
      }
    });
  }

  loadList(): void {
    this.loading = true;
    this.ops
      .listComplaints({
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
        error: () => this.notify.error('Failed to load complaints')
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

  openRow(row: IOpsComplaintRow): void {
    this.ops.getComplaintDetail(row.id).subscribe({
      next: (d) => {
        this.detail = d;
        this.resolveNote = '';
        this.drawerOpen = true;
      },
      error: () => this.notify.error('Failed to load complaint')
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.detail = null;
  }

  viewChat(): void {
    const id = this.detail?.interactionId;
    if (id) this.router.navigate(['/app/inbox'], { queryParams: { selected: id } });
  }

  acknowledge(): void {
    if (!this.detail) return;
    this.runAction(() => this.ops.acknowledgeComplaint(this.detail!.id));
  }

  assign(): void {
    if (!this.detail || !this.selectedAssignee) return;
    this.runAction(() => this.ops.assignComplaint(this.detail!.id, this.selectedAssignee));
  }

  resolve(): void {
    if (!this.detail) return;
    this.runAction(() => this.ops.resolveComplaint(this.detail!.id, this.resolveNote || undefined));
  }

  closeComplaint(): void {
    if (!this.detail) return;
    this.runAction(() => this.ops.closeComplaint(this.detail!.id));
  }

  private runAction(fn: () => ReturnType<InboxOpsService['acknowledgeComplaint']>): void {
    this.actionLoading = true;
    fn()
      .pipe(finalize(() => (this.actionLoading = false)))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.notify.success('Complaint updated');
          this.loadList();
          this.loadStats();
        },
        error: () => this.notify.error('Action failed')
      });
  }

  priorityClass(p: string): string {
    return p === 'high' || p === 'urgent' ? 'text-red-600 font-bold' : '';
  }
}
