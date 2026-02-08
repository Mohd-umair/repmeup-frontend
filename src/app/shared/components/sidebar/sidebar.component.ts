import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationDataService } from '../../../core/services/notification-data.service';
import { MenuService, IMenuItem } from '../../../core/services/menu.service';
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
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() menuItemClicked = new EventEmitter<void>();
  
  menuItems: MenuItem[] = [];
  loadingMenus = true;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private notificationDataService: NotificationDataService,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
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
    this.menuService.loadMenus().subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Menus loaded successfully');
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
}
