import { Component, OnInit, OnDestroy, Output, Input, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { NotificationDataService, INotification } from '../../../core/services/notification-data.service';
import { IUser, IOrganization } from '../../../core/models/user.model';
import { Subscription, interval } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AccountSwitcherComponent } from '../account-switcher/account-switcher.component';

/**
 * Header Component - Single Responsibility Principle
 * Displays top navigation bar with user info and actions
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, AccountSwitcherComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();

  /** Desktop sidebar collapsed (icon rail) — drives header collapse button icon */
  @Input() sidebarCollapsed = false;

  @Output() sidebarCollapseToggle = new EventEmitter<void>();
  
  currentUser: IUser | null = null;
  organization: IOrganization | null = null;
  orgLogoBroken = false;
  userAvatarBroken = false;
  showUserMenu = false;
  showNotifications = false;
  notificationCount = 0;
  notifications: INotification[] = [];
  loadingNotifications = false;

  // AI Credits
  aiCredits: any = null;
  loadingCredits = false;

  private subscriptions: Subscription[] = [];
  private lastLoadedOrgId: string | null = null;

  constructor(
    private authService: AuthService,
    private organizationService: OrganizationService,
    private notificationDataService: NotificationDataService,
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
      this.userAvatarBroken = false;
      if (user) {
        this.hydrateOrganizationFromUser(user);
        this.loadOrganizationProfile();
        this.loadAICredits();
      } else {
        this.organization = null;
        this.lastLoadedOrgId = null;
        this.orgLogoBroken = false;
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

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    const first = this.currentUser.firstName?.[0] ?? '';
    const last = this.currentUser.lastName?.[0] ?? '';
    if (first || last) return (first + last).toUpperCase();
    return (this.currentUser.email?.[0] ?? 'U').toUpperCase();
  }

  get userDisplayName(): string {
    if (!this.currentUser) return 'User';
    const name = [this.currentUser.firstName, this.currentUser.lastName].filter(Boolean).join(' ').trim();
    return name || this.currentUser.email || 'User';
  }

  get userRoleLabel(): string {
    const role = this.currentUser?.role;
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  get organizationName(): string {
    return this.organization?.name
      || (typeof this.currentUser?.organization === 'object' ? this.currentUser.organization?.name : '')
      || 'Your organisation';
  }

  get organizationLogoUrl(): string | null {
    if (this.orgLogoBroken) return null;
    const logo = this.organization?.logo
      || (typeof this.currentUser?.organization === 'object' ? this.currentUser.organization?.logo : undefined);
    if (!logo) return null;
    return this.resolveMediaUrl(logo);
  }

  get userAvatarUrl(): string | null {
    if (this.userAvatarBroken || !this.currentUser?.avatar) return null;
    return this.resolveMediaUrl(this.currentUser.avatar);
  }

  onOrgLogoError(): void {
    this.orgLogoBroken = true;
  }

  onUserAvatarError(): void {
    this.userAvatarBroken = true;
  }

  private hydrateOrganizationFromUser(user: IUser | null): void {
    const org = user?.organization;
    if (org && typeof org === 'object') {
      this.organization = org as IOrganization;
      this.orgLogoBroken = false;
    }
  }

  private loadOrganizationProfile(): void {
    const org = this.currentUser?.organization;
    const orgId = !org ? null : (typeof org === 'string' ? org : org._id);
    if (!orgId || orgId === this.lastLoadedOrgId) return;
    this.lastLoadedOrgId = orgId;

    const sub = this.organizationService.getOrganization(orgId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.organization = {
            ...(this.organization || {}),
            ...res.data
          } as IOrganization;
          this.orgLogoBroken = false;
        }
      },
      error: () => { /* keep hydrated user org */ }
    });
    this.subscriptions.push(sub);
  }

  private resolveMediaUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    const apiBase = environment.apiUrl.replace(/\/api\/?$/, '');
    return path.startsWith('/') ? `${apiBase}${path}` : `${apiBase}/${path}`;
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
