import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationDataService, INotification } from '../../../core/services/notification-data.service';
import { IUser } from '../../../core/models/user.model';
import { Subscription, interval } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Header Component - Single Responsibility Principle
 * Displays top navigation bar with user info and actions
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  // AI Credits
  aiCredits: any = null;
  loadingCredits = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private notificationDataService: NotificationDataService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadAICredits(); // Load credits when user is available
      }
    });
    this.subscriptions.push(userSub);

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

    // Refresh AI credits every 30 seconds
    const creditRefreshSub = interval(30000).subscribe(() => {
      if (this.currentUser) {
        this.loadAICredits();
      }
    });
    this.subscriptions.push(creditRefreshSub);
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

  loadAICredits(): void {
    if (this.loadingCredits) return;
    
    this.loadingCredits = true;
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`).subscribe({
      next: (response) => {
        this.aiCredits = response.credits;
        this.loadingCredits = false;
      },
      error: (error) => {
        console.error('Error loading AI credits:', error);
        this.loadingCredits = false;
      }
    });
  }

  navigateToCredits(): void {
    this.router.navigate(['/app/ai-credits']);
  }

  navigateToNotifications(): void {
    this.showNotifications = false;
    this.router.navigate(['/app/notifications']);
  }

  getCreditStatusColor(): string {
    if (!this.aiCredits) return 'text-gray-500 dark:text-gray-400';
    if (this.aiCredits.isAtLimit) return 'text-red-700 dark:text-red-400';
    if (this.aiCredits.isNearLimit) return 'text-amber-700 dark:text-amber-400';
    return 'text-purple-700 dark:text-purple-300';
  }
}
