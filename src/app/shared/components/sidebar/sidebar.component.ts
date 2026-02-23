import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NotificationDataService } from '../../../core/services/notification-data.service';
import { MenuService, IMenuItem } from '../../../core/services/menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription } from 'rxjs';

/**
 * Sidebar Component - Single Responsibility Principle
 * Handles dynamic navigation menu with notification badges
 */
interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
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
  
  menuItems: MenuItem[] = [];
  loadingMenus = true;
  currentUser: any = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private notificationDataService: NotificationDataService,
    private menuService: MenuService,
    private authService: AuthService
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
      // Update inbox badge
      const inboxItem = this.menuItems.find(item => item.route === '/app/inbox');
      if (inboxItem) {
        inboxItem.badge = count;
      }
    });
    this.subscriptions.push(unreadSub);

    // Subscribe to menu changes
    const menuSub = this.menuService.menus$.subscribe(menus => {
      this.menuItems = menus.map(menu => ({
        label: menu.label,
        icon: menu.icon,
        route: menu.route,
        badge: menu.badge?.enabled && menu.badge.source === 'inbox' ? 0 : undefined
      }));
      
      // Update inbox badge with current count if it exists
      const unreadCount = this.notificationDataService.unreadCountValue;
      if (unreadCount > 0) {
        const inboxItem = this.menuItems.find(item => item.route === '/app/inbox');
        if (inboxItem) {
          inboxItem.badge = unreadCount;
        }
      }
    });
    this.subscriptions.push(menuSub);
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
   * Set default menus as fallback
   */
  private setDefaultMenus(): void {
    this.menuItems = [
      { label: 'Home', icon: '🏠', route: '/' },
      { label: 'Dashboard', icon: '📊', route: '/app/dashboard' },
      { label: 'Inbox', icon: '📥', route: '/app/inbox', badge: 0 },
      { label: 'Publish', icon: '✈️', route: '/app/publish' },
      { label: 'Content', icon: '📄', route: '/app/content' },
      { label: 'Knowledge Base', icon: '🧠', route: '/app/knowledge-base' },
      { label: 'Analytics', icon: '📈', route: '/app/analytics' },
      { label: 'Agents', icon: '👥', route: '/app/agents' },
      { label: 'Settings', icon: '⚙️', route: '/app/settings' }
    ];
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
