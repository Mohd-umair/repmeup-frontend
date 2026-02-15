import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { NotificationDataService, INotification } from '../../core/services/notification-data.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Notifications Component - View All Notifications Page
 * Displays all user notifications with filtering, pagination, and actions
 */
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Expose Math for template
  Math = Math;
  
  notifications: INotification[] = [];
  filteredNotifications: INotification[] = [];
  isLoading = false;
  
  // Filters
  selectedFilter: 'all' | 'unread' | 'read' = 'all';
  selectedType: string = 'all';
  searchQuery: string = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;
  totalPages = 0;
  
  // Notification types for filter dropdown
  notificationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'new_interaction', label: 'New Interactions' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'mention', label: 'Mentions' },
    { value: 'escalation', label: 'Escalations' },
    { value: 'negative_spike', label: 'Negative Sentiment Spikes' },
    { value: 'response_received', label: 'Responses Received' },
    { value: 'platform_error', label: 'Platform Errors' },
    { value: 'system', label: 'System Notifications' }
  ];
  
  // Stats
  unreadCount = 0;
  
  constructor(
    private notificationDataService: NotificationDataService,
    private notificationService: NotificationService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadNotifications();
    
    // Subscribe to unread count
    this.notificationDataService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadCount = count;
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load notifications from API
   */
  loadNotifications(): void {
    this.isLoading = true;
    
    const unreadOnly = this.selectedFilter === 'unread';
    
    this.notificationDataService.getNotifications(unreadOnly)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notifications = response.data || [];
            this.totalItems = response.pagination?.total || this.notifications.length;
            this.totalPages = response.pagination?.pages || 1;
            this.applyFilters();
          }
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          this.notificationService.error('Failed to load notifications');
        }
      });
  }
  
  /**
   * Apply filters to notifications
   */
  applyFilters(): void {
    let filtered = [...this.notifications];
    
    // Filter by read status
    if (this.selectedFilter === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (this.selectedFilter === 'read') {
      filtered = filtered.filter(n => n.isRead);
    }
    
    // Filter by type
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(n => n.type === this.selectedType);
    }
    
    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }
    
    this.filteredNotifications = filtered;
    this.totalItems = filtered.length;
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    this.currentPage = 1; // Reset to first page when filtering
  }
  
  /**
   * Get paginated notifications
   */
  getPaginatedNotifications(): INotification[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredNotifications.slice(startIndex, endIndex);
  }
  
  /**
   * Handle filter change
   */
  onFilterChange(filter: 'all' | 'unread' | 'read'): void {
    this.selectedFilter = filter;
    if (filter === 'unread' || filter === 'all') {
      this.loadNotifications();
    } else {
      this.applyFilters();
    }
  }
  
  /**
   * Handle type filter change
   */
  onTypeFilterChange(): void {
    this.applyFilters();
  }
  
  /**
   * Handle search
   */
  onSearch(): void {
    this.applyFilters();
  }
  
  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }
  
  /**
   * Mark notification as read
   */
  markAsRead(notification: INotification, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (notification.isRead) return;
    
    this.notificationDataService.markAsRead(notification._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          notification.isRead = true;
          notification.readAt = new Date();
        },
        error: (error) => {
          console.error('Error marking notification as read:', error);
        }
      });
  }
  
  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    if (this.unreadCount === 0) return;
    
    this.notificationDataService.markAllAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications.forEach(n => {
            n.isRead = true;
            n.readAt = new Date();
          });
          this.notificationService.success('All notifications marked as read');
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error marking all as read:', error);
          this.notificationService.error('Failed to mark all as read');
        }
      });
  }
  
  /**
   * Delete notification
   */
  deleteNotification(notification: INotification, event: Event): void {
    event.stopPropagation();
    
    if (!confirm('Delete this notification?')) return;
    
    this.notificationDataService.deleteNotification(notification._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n._id !== notification._id);
          this.applyFilters();
          this.notificationService.success('Notification deleted');
        },
        error: (error) => {
          console.error('Error deleting notification:', error);
          this.notificationService.error('Failed to delete notification');
        }
      });
  }
  
  /**
   * Clear all read notifications
   */
  clearAllRead(): void {
    const readCount = this.notifications.filter(n => n.isRead).length;
    
    if (readCount === 0) {
      this.notificationService.info('No read notifications to clear');
      return;
    }
    
    if (!confirm(`Clear ${readCount} read notification(s)?`)) return;
    
    this.notificationDataService.clearReadNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => !n.isRead);
          this.applyFilters();
          this.notificationService.success(`${readCount} notification(s) cleared`);
        },
        error: (error) => {
          console.error('Error clearing notifications:', error);
          this.notificationService.error('Failed to clear notifications');
        }
      });
  }
  
  /**
   * Handle notification click
   */
  onNotificationClick(notification: INotification): void {
    // Mark as read
    this.markAsRead(notification);
    
    // Navigate to action URL if available
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
    }
  }
  
  /**
   * Get notification icon
   */
  getNotificationIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'new_interaction': '💬',
      'assignment': '📋',
      'mention': '📢',
      'escalation': '🚨',
      'negative_spike': '📉',
      'response_received': '📬',
      'platform_error': '❌',
      'system': '⚙️'
    };
    return icons[type] || '🔔';
  }
  
  /**
   * Get notification type label
   */
  getTypeLabel(type: string): string {
    const label = this.notificationTypes.find(t => t.value === type);
    return label?.label || type;
  }
  
  /**
   * Format date
   */
  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString();
  }
  
  /**
   * Pagination controls
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
  
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  /**
   * Refresh notifications
   */
  refresh(): void {
    this.loadNotifications();
  }
}
