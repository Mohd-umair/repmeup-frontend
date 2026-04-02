import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationComponent } from '../notification/notification.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { GlobalLoaderComponent } from '../global-loader/global-loader.component';

/**
 * Main Layout Component - Single Responsibility Principle
 * Provides the main application layout with sidebar and header
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationComponent, SidebarComponent, HeaderComponent, GlobalLoaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {
  @ViewChild('mainScroll', { read: ElementRef }) private mainScroll?: ElementRef<HTMLElement>;

  sidebarOpen = false;

  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        queueMicrotask(() => {
          const el = this.mainScroll?.nativeElement;
          if (el) {
            el.scrollTop = 0;
          }
        });
      });
  }

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
