import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subject, merge, combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, takeUntil } from 'rxjs/operators';
import { NotificationDataService } from '../../../core/services/notification-data.service';
import { MenuService, IMenuItem } from '../../../core/services/menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppearanceService } from '../../../core/services/appearance.service';
import { IUser } from '../../../core/models/user.model';

/** View model only — single copy kept on the component (no parallel raw/filtered trees). */
interface MenuItem {
  label: string;
  icon: string;
  route: string;
  queryParams?: Record<string, string> | null;
  badge?: number;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  children?: MenuItem[];
  sidebarParentActive?: boolean;
}

type SidebarSectionId = 'main' | 'management' | 'settings';

interface SidebarSection {
  id: SidebarSectionId;
  label: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() menuItemClicked = new EventEmitter<void>();

  /** Only menu structure stored here — source of truth remains MenuService.groupedMenusValue */
  sidebarSections: SidebarSection[] = [];

  loadingMenus = true;
  currentUser: IUser | null = null;

  userDisplayName = 'User';
  userEmailDisplay = 'user@example.com';
  userInitials = 'U';

  /** Stable refs for routerLinkActiveOptions — avoids new object allocation each CD */
  readonly routerActiveExact = { exact: true };
  readonly routerActivePrefix = { exact: false };

  private readonly destroy$ = new Subject<void>();
  private navUrl = '';
  /** Browser: timer handle is a number (Node typings use Timeout — use loose type for portability). */
  private notificationPollTimerId: number | undefined;

  /**
   * At most one collapsible submenu open (accordion).
   * Key: `${sectionId}::${parentRoute}` (Publish, Settings, …).
   */
  private expandedSubmenuKey: string | null = null;

  constructor(
    private router: Router,
    private notificationDataService: NotificationDataService,
    private menuService: MenuService,
    private authService: AuthService,
    private permissionService: PermissionService,
    public appearance: AppearanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.navUrl = this.normalizePath(this.router.url);

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.syncUserDisplayFields();
        this.cdr.markForCheck();
      });

    /** One pipeline: menus from service OR identity/permissions change → single full rebuild (no duplicate raw tree in RAM). */
    merge(
      this.menuService.groupedMenus$.pipe(map(() => 'menus' as const)),
      combineLatest([
        this.authService.currentUser$,
        this.permissionService.permissions$
      ]).pipe(
        distinctUntilChanged(
          (a, b) =>
            this.menuFilterTriggerKey(a[0], a[1]) === this.menuFilterTriggerKey(b[0], b[1])
        ),
        map(() => 'auth' as const)
      )
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.rebuildSidebarMenuFromService());

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.navUrl = this.normalizePath(this.router.url);
        this.decorateActiveOnSectionsOnly();
        this.expandSubmenusMatchingCurrentRoute();
        this.cdr.markForCheck();
      });

    this.notificationPollTimerId = window.setTimeout(() => {
      this.notificationDataService.startPolling();
      this.notificationPollTimerId = undefined;
    }, 2500);

    this.notificationDataService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.applyInboxBadgeToSections(count);
        this.cdr.markForCheck();
      });

    this.loadMenus();
  }

  ngOnDestroy(): void {
    if (this.notificationPollTimerId != null) {
      clearTimeout(this.notificationPollTimerId);
    }
    this.notificationDataService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  routerLinkActiveOptionsForChild(route: string): { exact: boolean } {
    if (route === '/app/publish') return this.routerActiveExact;
    return this.routerActivePrefix;
  }

  /**
   * Same routerLink with different queryParams (Analytics tabs) needs exact path + query match.
   */
  childLinkActiveOptions(child: MenuItem): { exact: boolean } | { paths: 'exact'; queryParams: 'exact' } {
    if (child.queryParams && Object.keys(child.queryParams).length > 0) {
      return { paths: 'exact', queryParams: 'exact' };
    }
    return this.routerLinkActiveOptionsForChild(child.route);
  }

  trackBySection(_index: number, section: SidebarSection): string {
    return section.id;
  }

  trackByItem(_index: number, item: MenuItem): string {
    return item.route + '::' + item.label;
  }

  trackByChild(_index: number, child: MenuItem): string {
    const qp = child.queryParams ? JSON.stringify(child.queryParams) : '';
    return `${child.route}::${qp}::${child.label}`;
  }

  onMenuItemClick(): void {
    this.menuItemClicked.emit();
  }

  submenuKey(sectionId: SidebarSectionId, parentRoute: string): string {
    return `${sectionId}::${parentRoute}`;
  }

  isSubmenuExpanded(section: SidebarSection, item: MenuItem): boolean {
    if (!item.children?.length) return false;
    return this.expandedSubmenuKey === this.submenuKey(section.id, item.route);
  }

  toggleSubmenu(section: SidebarSection, item: MenuItem): void {
    if (!item.children?.length) return;
    const key = this.submenuKey(section.id, item.route);
    if (this.expandedSubmenuKey === key) {
      this.expandedSubmenuKey = null;
    } else {
      this.expandedSubmenuKey = key;
    }
    this.cdr.markForCheck();
  }

  /** Stable DOM id for aria-controls / panel (no slashes). */
  submenuPanelDomId(section: SidebarSection, item: MenuItem): string {
    return `submenu-${section.id}-${item.route.replace(/\//g, '-')}`;
  }

  logout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  private loadMenus(): void {
    this.loadingMenus = true;
    this.cdr.markForCheck();
    this.menuService
      .loadMenus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingMenus = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingMenus = false;
          this.sidebarSections = [];
          this.cdr.markForCheck();
        }
      });
  }

  private normalizePath(fullUrl: string): string {
    return (fullUrl.split(/[?#]/)[0] || '').replace(/\/$/, '') || '/';
  }

  private menuFilterTriggerKey(user: IUser | null, perms: Set<string>): string {
    const uid = user?._id != null ? String(user._id) : '';
    const role = user?.role ?? '';
    const codes = [...(user?.resolvedPermissions ?? [])].sort().join('\u001f');
    const p = [...perms].sort().join('\u001f');
    return `${uid}|${role}|${codes}|${p}`;
  }

  private syncUserDisplayFields(): void {
    const u = this.currentUser;
    if (!u) {
      this.userDisplayName = 'User';
      this.userEmailDisplay = 'user@example.com';
      this.userInitials = 'U';
      return;
    }
    const firstName = u.firstName || '';
    const lastName = u.lastName || '';
    if (firstName && lastName) {
      this.userDisplayName = `${firstName} ${lastName}`;
      this.userInitials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      this.userDisplayName = firstName;
      this.userInitials = firstName.charAt(0).toUpperCase();
    } else if (u.email) {
      this.userDisplayName = u.email.split('@')[0];
      this.userInitials = u.email.charAt(0).toUpperCase();
    } else {
      this.userDisplayName = 'User';
      this.userInitials = 'U';
    }
    this.userEmailDisplay = u.email || 'user@example.com';
  }

  private isGroupedEmpty(grouped: {
    main?: IMenuItem[];
    management?: IMenuItem[];
    settings?: IMenuItem[];
  } | null): boolean {
    if (!grouped) return true;
    return (
      !(grouped.main?.length || grouped.management?.length || grouped.settings?.length)
    );
  }

  /**
   * Full rebuild: read once from MenuService, map+filter in locals, assign sections.
   * Releases previous sidebarSections for GC — no second full tree (rawGroupedMenus) on the instance.
   */
  private rebuildSidebarMenuFromService(): void {
    const grouped = this.menuService.groupedMenusValue;
    if (this.isGroupedEmpty(grouped)) {
      this.sidebarSections = [];
      this.cdr.markForCheck();
      return;
    }

    const mapGroup = (list: IMenuItem[] | undefined): MenuItem[] =>
      (list || [])
        .map((m) => this.menuToItem(m))
        .map((i) => this.filterMenuItem(i))
        .filter((i): i is MenuItem => i != null);

    const nextSections: SidebarSection[] = [
      { id: 'main', label: 'Main', items: mapGroup(grouped.main) },
      { id: 'management', label: 'Management', items: mapGroup(grouped.management) },
      { id: 'settings', label: 'Settings', items: mapGroup(grouped.settings) }
    ];
    this.sidebarSections = nextSections.filter((s) => s.items.length > 0);

    this.pruneExpandedSubmenuKeys();
    this.applyInboxBadgeToSections(this.notificationDataService.unreadCountValue);
    this.decorateActiveOnSectionsOnly();
    this.expandSubmenusMatchingCurrentRoute();
    this.cdr.markForCheck();
  }

  /** Clear expand state if that submenu no longer exists after a reload. */
  private pruneExpandedSubmenuKeys(): void {
    if (this.expandedSubmenuKey == null) return;
    const key = this.expandedSubmenuKey;
    let stillValid = false;
    for (const sec of this.sidebarSections) {
      for (const item of sec.items) {
        if (item.children?.length && this.submenuKey(sec.id, item.route) === key) {
          stillValid = true;
          break;
        }
      }
      if (stillValid) break;
    }
    if (!stillValid) {
      this.expandedSubmenuKey = null;
    }
  }

  /** Open the first submenu that contains the active URL (only one open — accordion). */
  private expandSubmenusMatchingCurrentRoute(): void {
    this.expandedSubmenuKey = null;
    const url = this.navUrl;
    for (const sec of this.sidebarSections) {
      for (const item of sec.items) {
        if (!item.children?.length) continue;
        const parentHit = this.routeMatchesPath(url, item.route);
        const childHit = item.children.some((c) => this.routeMatchesPath(url, c.route));
        if (parentHit || childHit) {
          this.expandedSubmenuKey = this.submenuKey(sec.id, item.route);
          return;
        }
      }
    }
  }

  private routeMatchesPath(url: string, route: string): boolean {
    const r = route.replace(/\/$/, '') || '/';
    const u = url.replace(/\/$/, '') || '/';
    if (r === '/app/publish') return u === '/app/publish';
    if (r === '/app/settings') return u === '/app/settings' || u.startsWith('/app/settings/');
    if (r === '/app/analytics') return u === '/app/analytics' || u.startsWith('/app/analytics/');
    return u === r || u.startsWith(r + '/');
  }

  /** O(n) over visible items only — no permission re-filter on navigation */
  private decorateActiveOnSectionsOnly(): void {
    const url = this.navUrl;
    for (const sec of this.sidebarSections) {
      for (const item of sec.items) {
        if (item.children?.length) {
          const self = this.routeMatchesPath(url, item.route);
          const child = item.children.some((c) => this.routeMatchesPath(url, c.route));
          item.sidebarParentActive = self || child;
        }
      }
    }
  }

  private applyInboxBadgeToSections(count: number): void {
    if (count <= 0) return;
    for (const sec of this.sidebarSections) {
      const inbox = sec.items.find((item) => item.route === '/app/inbox');
      if (inbox) {
        inbox.badge = count;
        return;
      }
    }
  }

  private menuToItem(menu: IMenuItem): MenuItem {
    const item: MenuItem = {
      label: menu.label,
      icon: menu.icon,
      route: menu.route,
      requiredPermissions: Array.isArray(menu.requiredPermissions) ? menu.requiredPermissions : [],
      requiredRoles: Array.isArray(menu.requiredRoles) ? menu.requiredRoles : [],
      badge: menu.badge?.enabled && menu.badge?.source === 'inbox' ? 0 : undefined
    };
    if (menu.queryParams && typeof menu.queryParams === 'object') {
      item.queryParams = { ...menu.queryParams };
    }
    if (menu.children?.length) {
      item.children = menu.children.map((c) => this.menuToItem(c));
    }
    return item;
  }

  private filterMenuItem(item: MenuItem): MenuItem | null {
    if (Array.isArray(item.requiredRoles) && item.requiredRoles.length > 0) {
      const role = this.currentUser?.role;
      if (!role || !item.requiredRoles.includes(role)) {
        return null;
      }
    }

    if (item.children?.length) {
      const kids = item.children
        .map((c) => this.filterMenuItem(c))
        .filter((c): c is MenuItem => c != null);
      if (kids.length === 0) return null;
      if (Array.isArray(item.requiredPermissions) && item.requiredPermissions.length > 0) {
        if (!this.permissionService.hasAllPermissions(item.requiredPermissions)) {
          return null;
        }
      }
      return { ...item, children: kids };
    }

    return this.permissionService.canAccessRoute(item.route) ? { ...item } : null;
  }
}
