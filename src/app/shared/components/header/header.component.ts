import { Component, OnInit, OnDestroy, Output, Input, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationDataService, INotification } from '../../../core/services/notification-data.service';
import { AccountSwitcherService, IOrgMembership } from '../../../core/services/account-switcher.service';
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

  /** Desktop sidebar collapsed (icon rail) — drives header collapse button icon */
  @Input() sidebarCollapsed = false;

  @Output() sidebarCollapseToggle = new EventEmitter<void>();
  
  currentUser: IUser | null = null;
  showUserMenu = false;
  showNotifications = false;
  notificationCount = 0;
  notifications: INotification[] = [];
  loadingNotifications = false;

  // AI Credits
  aiCredits: any = null;
  loadingCredits = false;

  // Agency multi-account switcher
  memberships: IOrgMembership[] = [];
  activeOrgId: string | null = null;
  switchingOrgId: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private notificationDataService: NotificationDataService,
    private accountSwitcher: AccountSwitcherService,
    private router: Router,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.showUserMenu && !this.showNotifications) return;
    if (this.elRef.nativeElement.contains(ev.target as Node)) return;
    this.showUserMenu = false;
    this.showNotifications = false;
  }

  ngOnInit(): void {
    const userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadAICredits(); // Load credits when user is available
        this.accountSwitcher.load().subscribe(); // refresh accessible orgs
      }
    });
    this.subscriptions.push(userSub);

    // Agency multi-account: keep the switcher list + active org in sync.
    this.subscriptions.push(
      this.accountSwitcher.memberships$.subscribe(m => (this.memberships = m))
    );
    this.subscriptions.push(
      this.accountSwitcher.activeOrgId$.subscribe(id => (this.activeOrgId = id))
    );

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
    this.menuToggle.emit();
  }

  onSidebarCollapseToggle(): void {
    this.sidebarCollapseToggle.emit();
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

  /** Whether to show the org switcher (only when the user belongs to >1 org). */
  get hasMultipleOrgs(): boolean {
    return this.memberships.length > 1;
  }

  /** Reseller operators see the "Client Workspaces" link. */
  get isReseller(): boolean {
    const role = (this.currentUser?.role as string | undefined);
    return role === 'reseller_admin' || role === 'super_admin';
  }

  /** Display name of the active organization (for the header label). */
  get activeOrgName(): string {
    const active = this.memberships.find(m => m.organizationId === this.activeOrgId);
    return active?.name || '';
  }

  /** Switch the active organization (re-issues session + reloads app). */
  switchOrg(organizationId: string): void {
    if (organizationId === this.activeOrgId || this.switchingOrgId) return;
    this.switchingOrgId = organizationId;
    this.accountSwitcher.switchTo(organizationId).subscribe({
      next: (switched) => {
        if (switched) {
          // Hard reload so every org-scoped subject/cache rebuilds cleanly.
          this.router.navigateByUrl('/app/dashboard').then(() => window.location.reload());
        } else {
          this.switchingOrgId = null;
        }
      },
      error: () => {
        this.switchingOrgId = null;
      }
    });
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
