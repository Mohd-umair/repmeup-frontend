import { Component } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Sidebar Component - Single Responsibility Principle
 * Handles navigation menu
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
export class SidebarComponent {
  menuItems: MenuItem[] = [
    { label: 'Home', icon: '🏠', route: '/' },
    { label: 'Dashboard', icon: '📊', route: '/app/dashboard' },
    { label: 'Inbox', icon: '📥', route: '/app/inbox', badge: 0 },
    { label: 'Knowledge Base', icon: '🧠', route: '/app/knowledge-base' },
    { label: 'Analytics', icon: '📈', route: '/app/analytics' },
    { label: 'Agents', icon: '👥', route: '/app/agents' },
    { label: 'Settings', icon: '⚙️', route: '/app/settings' }
  ];

  constructor(private router: Router) {}

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
