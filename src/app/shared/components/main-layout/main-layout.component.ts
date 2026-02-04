import { Component } from '@angular/core';

/**
 * Main Layout Component - Single Responsibility Principle
 * Provides the main application layout with sidebar and header
 */
@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {
  sidebarOpen = false;

  /**
   * Toggle sidebar visibility on mobile
   */
  toggleSidebar(): void {
    console.log('🎯 Toggle sidebar called. Current state:', this.sidebarOpen);
    this.sidebarOpen = !this.sidebarOpen;
    console.log('🎯 New sidebar state:', this.sidebarOpen);
    
    // Log the classes being applied
    setTimeout(() => {
      const sidebarEl = document.querySelector('app-sidebar');
      console.log('📋 Sidebar classes:', sidebarEl?.className);
      const asideEl = document.querySelector('app-sidebar aside');
      console.log('📋 Aside transform:', window.getComputedStyle(asideEl as Element).transform);
    }, 100);
    
    // Prevent body scroll when sidebar is open on mobile
    if (this.sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  
  /**
   * Close sidebar (used when menu item clicked on mobile)
   */
  closeSidebar(): void {
    if (window.innerWidth < 1024 && this.sidebarOpen) {
      this.toggleSidebar();
    }
  }
}
