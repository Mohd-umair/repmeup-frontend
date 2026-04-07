import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TicketService } from '../../core/services/ticket.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ITicket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS
} from '../../core/models/ticket.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { RaiseTicketModalComponent } from './raise-ticket-modal/raise-ticket-modal.component';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PaginationComponent, RaiseTicketModalComponent],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit, OnDestroy {
  tickets: ITicket[] = [];

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  loading = true;
  showRaiseModal = false;
  selectedTicket: ITicket | null = null;

  /** Bound to search input; debounced requests use trimmed value */
  searchQuery = '';

  filterStatus: TicketStatus | '' = '';
  filterCategory: TicketCategory | '' = '';
  filterPriority: TicketPriority | '' = '';

  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly categoryLabels = TICKET_CATEGORY_LABELS;

  readonly statusFilterOptions: { value: TicketStatus | ''; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' }
  ];

  readonly categoryFilterOptions: { value: TicketCategory | ''; label: string }[] = [
    { value: '', label: 'All categories' },
    { value: 'bug', label: TICKET_CATEGORY_LABELS.bug },
    { value: 'feature_request', label: TICKET_CATEGORY_LABELS.feature_request },
    { value: 'billing', label: TICKET_CATEGORY_LABELS.billing },
    { value: 'general', label: TICKET_CATEGORY_LABELS.general }
  ];

  readonly priorityFilterOptions: { value: TicketPriority | ''; label: string }[] = [
    { value: '', label: 'All priorities' },
    { value: 'low', label: TICKET_PRIORITY_LABELS.low },
    { value: 'medium', label: TICKET_PRIORITY_LABELS.medium },
    { value: 'high', label: TICKET_PRIORITY_LABELS.high }
  ];

  private readonly search$ = new Subject<string>();
  private loadSub?: Subscription;
  private searchSub?: Subscription;

  constructor(
    private ticketService: TicketService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.searchSub = this.search$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage = 1;
        this.load();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    this.search$.complete();
  }

  onSearchChange(): void {
    this.search$.next(this.searchQuery.trim());
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.load();
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.loadSub = this.ticketService
      .getMyTickets({
        page: this.currentPage,
        limit: this.pageSize,
        status: this.filterStatus || undefined,
        category: this.filterCategory || undefined,
        priority: this.filterPriority || undefined,
        q: this.searchQuery.trim() || undefined
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.tickets = res.data.tickets;
            const p = res.data.pagination;
            this.totalItems = p.total;
            this.totalPages = p.pages;
            this.currentPage = p.page;
            this.pageSize = p.limit;
          }
          this.loading = false;
        },
        error: () => {
          this.notify.error('Error', 'Failed to load tickets.');
          this.loading = false;
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.load();
  }

  onTicketSubmitted(): void {
    this.showRaiseModal = false;
    this.currentPage = 1;
    this.load();
  }

  openTicket(ticket: ITicket): void {
    this.selectedTicket = ticket;
  }

  closeTicketDetail(): void {
    this.selectedTicket = null;
  }

  getStatusClass(status: TicketStatus): string {
    const map: Record<TicketStatus, string> = {
      open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
    };
    return map[status] || '';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      high: 'text-red-500 dark:text-red-400',
      medium: 'text-amber-500 dark:text-amber-400',
      low: 'text-emerald-500 dark:text-emerald-400'
    };
    return map[priority] || 'text-gray-400';
  }

  getRelativeTime(date: Date | string): string {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackByTicket(_: number, t: ITicket): string {
    return t._id;
  }
}
