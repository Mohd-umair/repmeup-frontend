import { Component, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { MenuService } from '../../../core/services/menu.service';
import { AuthService } from '../../../core/services/auth.service';
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
  private readonly menuService = inject(MenuService);
  private readonly authService = inject(AuthService);

  /** Used for app-wide subscription cancellation notice + demo trial banner/lock */
  readonly limits$ = this.subscriptionService.limits$;

  /**
   * Routes where the expired-demo LOCK overlay must NOT show — the user needs
   * these to actually purchase a plan and unlock the workspace. Mirrors the
   * backend's DEMO_UNLOCKED_PATH_PATTERNS (see middlewares/auth.js).
   */
  private readonly DEMO_UNLOCKED_PATHS = ['/app/plans'];

  /** Current route path (updated on navigation) — drives lock-overlay suppression. */
  readonly currentUrl = signal(this.router.url);

  /** True when the demo-lock overlay must be hidden so the user can buy a plan. */
  isDemoLockSuppressed(): boolean {
    const path = this.currentUrl().split('?')[0];
    return this.DEMO_UNLOCKED_PATHS.some((p) => path.startsWith(p));
  }

  /** Sign out from the demo trial lock overlay. */
  logoutFromLock(): void {
    this.authService.logout();
  }

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

    effect(() => {
      const planId = this.entitlements.planSummary()?.planId;
      if (!planId) return;
      this.menuService.loadMenus().subscribe();
    });

    let previousUrl = '';
    this.router.events
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) {
          previousUrl = this.router.url;
        }
        if (e instanceof NavigationEnd) {
          this.currentUrl.set(e.urlAfterRedirects);
          // Strip query strings to compare base paths only.
          // If the path didn't change (only query params changed), the user is
          // switching tabs/sub-views within the same page — don't reset scroll.
          const prevPath = previousUrl.split('?')[0];
          const nextPath = e.urlAfterRedirects.split('?')[0];
          if (prevPath === nextPath) return;

          queueMicrotask(() => {
            const el = this.mainScroll?.nativeElement;
            if (el) el.scrollTop = 0;
          });
        }
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
