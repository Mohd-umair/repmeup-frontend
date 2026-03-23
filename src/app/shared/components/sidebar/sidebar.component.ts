import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NotificationDataService } from '../../../core/services/notification-data.service';
import { MenuService, IMenuItem } from '../../../core/services/menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { Subscription } from 'rxjs';

/**
 * Sidebar Component - Single Responsibility Principle
 * Handles dynamic navigation menu with notification badges (grouped: Main / Management / Settings)
 */
interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

interface GroupedMenuItems {
  main: MenuItem[];
  management: MenuItem[];
  settings: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() menuItemClicked = new EventEmitter<void>();
  
  /** Grouped menu items for display (Main / Management / Settings) */
  groupedItems: GroupedMenuItems = { main: [], management: [], settings: [] };
  loadingMenus = true;
  currentUser: any = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private notificationDataService: NotificationDataService,
    private menuService: MenuService,
    private authService: AuthService,
    private permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    // Get current user
    const userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.subscriptions.push(userSub);

    // Start polling for notifications
    this.notificationDataService.startPolling();

    // Load dynamic menus
    this.loadMenus();

    // Subscribe to unread count updates
    const unreadSub = this.notificationDataService.unreadCount$.subscribe(count => {
      this.updateInboxBadgeInGrouped(count);
    });
    this.subscriptions.push(unreadSub);

    const menuSub = this.menuService.groupedMenus$.subscribe(grouped => {
      if (!grouped || (grouped.main?.length === 0 && grouped.management?.length === 0 && grouped.settings?.length === 0)) {
        return;
      }
      this.groupedItems = this.filterByPermissions({
        main: (grouped.main || []).map((m: IMenuItem) => this.menuToItem(m)),
        management: (grouped.management || []).map((m: IMenuItem) => this.menuToItem(m)),
        settings: (grouped.settings || []).map((m: IMenuItem) => this.menuToItem(m))
      });
      this.applyInboxBadge(this.notificationDataService.unreadCountValue);
    });
    this.subscriptions.push(menuSub);

    const permSub = this.permissionService.permissions$.subscribe(() => {
      this.groupedItems = this.filterByPermissions(this.groupedItems);
    });
    this.subscriptions.push(permSub);
  }

  private menuToItem(menu: IMenuItem): MenuItem {
    return {
      label: menu.label,
      icon: menu.icon,
      route: menu.route,
      badge: menu.badge?.enabled && menu.badge?.source === 'inbox' ? 0 : undefined
    };
  }

  private updateInboxBadgeInGrouped(count: number): void {
    this.applyInboxBadge(count);
  }

  private applyInboxBadge(count: number): void {
    if (count <= 0) return;
    const apply = (list: MenuItem[]) => {
      const inbox = list.find(item => item.route === '/app/inbox');
      if (inbox) inbox.badge = count;
    };
    apply(this.groupedItems.main);
    apply(this.groupedItems.management);
    apply(this.groupedItems.settings);
  }

  /**
   * Load menus from backend
   */
  loadMenus(): void {
    this.loadingMenus = true;
    const menuLoadSub = this.menuService.loadMenus().subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Menus loaded successfully');
          // If API returned no menus, use default (e.g. first load or misconfiguration)
          const menus = this.menuService.menusValue;
          if (!menus || menus.length === 0) {
            this.setDefaultMenus();
          }
        }
        this.loadingMenus = false;
      },
      error: (error) => {
        console.error('Error loading menus:', error);
        this.loadingMenus = false;
        // Fallback to default menus if loading fails
        this.setDefaultMenus();
      }
    });
    this.subscriptions.push(menuLoadSub);
  }

  /**
   * Set default menus as fallback (grouped to match new menu structure)
   */
  private setDefaultMenus(): void {
    this.groupedItems = this.filterByPermissions({
      main: [
        { label: 'Home', icon: '🏠', route: '/' },
        { label: 'Dashboard', icon: '📊', route: '/app/dashboard' },
        { label: 'Inbox', icon: '📥', route: '/app/inbox', badge: 0 },
        { label: 'Publish', icon: '✈️', route: '/app/publish' },
        { label: 'Content', icon: '📄', route: '/app/content' },
        { label: 'Brand Hub', icon: '🎨', route: '/app/brand-hub' },
        { label: 'Content Studio', icon: '✨', route: '/app/content-studio' },
        { label: 'Calendar', icon: '📅', route: '/app/calendar' },
        { label: 'Approval Queue', icon: '✅', route: '/app/approval-queue' },
        { label: 'Trend Explorer', icon: '📈', route: '/app/trend-explorer' },
        { label: 'Analytics', icon: '📉', route: '/app/analytics' },
        { label: 'Knowledge Base', icon: '🧠', route: '/app/knowledge-base' }
      ],
      management: [
        { label: 'Agents', icon: '👥', route: '/app/agents' }
      ],
      settings: [
        { label: 'Plans', icon: '💎', route: '/app/plans' },
        { label: 'Settings', icon: '⚙️', route: '/app/settings' }
      ]
    });
  }

  private filterByPermissions(items: GroupedMenuItems): GroupedMenuItems {
    const filter = (list: MenuItem[]) =>
      list.filter(item => this.permissionService.canAccessRoute(item.route));
    return {
      main: filter(items.main),
      management: filter(items.management),
      settings: filter(items.settings)
    };
  }

  ngOnDestroy(): void {
    this.notificationDataService.stopPolling();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
  
  onMenuItemClick(): void {
    // Close sidebar on mobile when menu item is clicked
    this.menuItemClicked.emit();
  }

  /**
   * Get user display name
   */
  getUserDisplayName(): string {
    if (!this.currentUser) return 'User';
    
    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (this.currentUser.email) {
      return this.currentUser.email.split('@')[0];
    }
    
    return 'User';
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.charAt(0).toUpperCase();
    } else if (this.currentUser.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    }
    
    return 'U';
  }

  /**
   * Get user email
   */
  getUserEmail(): string {
    return this.currentUser?.email || 'user@example.com';
  }

  /**
   * Logout user
   */
  logout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }
}
