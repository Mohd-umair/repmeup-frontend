import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { NotificationComponent } from '../notification/notification.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { GlobalLoaderComponent } from '../global-loader/global-loader.component';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'repmeup-sidebar-collapsed';

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

  /** Mobile drawer open */
  sidebarOpen = false;

  /** Desktop (lg+) collapsed rail — persisted */
  sidebarCollapsed = false;

  private readonly router = inject(Router);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly entitlements = inject(EntitlementsStore);

  /** Used for app-wide subscription cancellation notice */
  readonly limits$ = this.subscriptionService.limits$;

  constructor() {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      this.sidebarCollapsed = raw === '1' || raw === 'true';
    } catch {
      /* ignore */
    }

    this.subscriptionService.getLimits().pipe(takeUntilDestroyed()).subscribe();

    // Single source of truth for "what can this org do?" — load once on mount,
    // subscribe to socket invalidation so plan changes propagate instantly.
    this.entitlements.load();
    this.entitlements.wireSocketInvalidation();

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
    this.sidebarOpen = !this.sidebarOpen;

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

  /**
   * Toggle desktop sidebar width (icon rail vs full). No effect on mobile drawer width.
   */
  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, this.sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
