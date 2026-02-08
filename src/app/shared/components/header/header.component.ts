import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationDataService, INotification } from '../../../core/services/notification-data.service';
import { IUser } from '../../../core/models/user.model';
import { Subscription } from 'rxjs';

/**
 * Header Component - Single Responsibility Principle
 * Displays top navigation bar with user info and actions
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();
  
  currentUser: IUser | null = null;
  showUserMenu = false;
  showNotifications = false;
  notificationCount = 0;
  notifications: INotification[] = [];
  loadingNotifications = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private notificationDataService: NotificationDataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to notification count
    const countSub = this.notificationDataService.unreadCount$.subscribe(count => {
      this.notificationCount = count;
    });
    this.subscriptions.push(countSub);

    // Subscribe to notifications
    const notifSub = this.notificationDataService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
    });
    this.subscriptions.push(notifSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onMenuToggle(): void {
    console.log('🍔 Hamburger clicked!'); // Debug log
    this.menuToggle.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    this.showNotifications = false; // Close notifications when opening user menu
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    this.showUserMenu = false; // Close user menu when opening notifications
    
    if (this.showNotifications && this.notifications.length === 0) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.loadingNotifications = true;
    this.notificationDataService.getNotifications(false).subscribe({
      next: () => {
        this.loadingNotifications = false;
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.loadingNotifications = false;
      }
    });
  }

  markAsRead(notification: INotification): void {
    if (notification.isRead) return;

    this.notificationDataService.markAsRead(notification._id).subscribe({
      next: () => {
        notification.isRead = true;
        notification.readAt = new Date();
        
        // Navigate to action URL if provided
        if (notification.actionUrl) {
          this.router.navigate([notification.actionUrl]);
          this.showNotifications = false;
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllAsRead(): void {
    this.notificationDataService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => {
          n.isRead = true;
          n.readAt = new Date();
        });
      },
      error: (error) => {
        console.error('Error marking all as read:', error);
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'assignment': return '📋';
      case 'escalation': return '🚨';
      case 'mention': return '@';
      case 'new_interaction': return '💬';
      case 'negative_spike': return '📉';
      case 'response_received': return '✉️';
      case 'platform_error': return '⚠️';
      default: return '🔔';
    }
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    return `${this.currentUser.firstName.charAt(0)}${this.currentUser.lastName.charAt(0)}`.toUpperCase();
  }
}
