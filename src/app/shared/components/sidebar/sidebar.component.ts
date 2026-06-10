import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subject, merge, combineLatest, Subscription, timer } from 'rxjs';
import { distinctUntilChanged, filter, map, take, takeUntil } from 'rxjs/operators';
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

type SidebarSectionId = 'main' | 'management' | 'settings' | 'automation' | 'campaigns';

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
export class SidebarComponent implements OnInit, OnDestroy, OnChanges {
  /** Desktop (lg+): narrow icon rail — controlled by main layout */
  @Input() collapsed = false;

  @Output() menuItemClicked = new EventEmitter<void>();

  /** Only menu structure stored here — source of truth remains MenuService.groupedMenusValue */
  sidebarSections: SidebarSection[] = [];

  /** When collapsed, submenu opens as flyout — key matches `submenuKey` */
  flyoutKey: string | null = null;

  /** Fixed flyout panel position (viewport) — avoids overflow clipping from sidebar/nav */
  flyoutPosition: { top: number; left: number } | null = null;

  private flyoutAnchorEl: HTMLElement | null = null;

  private readonly boundScrollReposition = (): void => {
    if (this.flyoutKey == null) return;
    this.ngZone.run(() => {
      this.repositionFlyout();
    });
  };

  private readonly boundResizeReposition = (): void => {
    if (this.flyoutKey == null) return;
    this.ngZone.run(() => {
      this.repositionFlyout();
    });
  };

  loadingMenus = true;
  currentUser: IUser | null = null;

  /** Stable refs for routerLinkActiveOptions — avoids new object allocation each CD */
  readonly routerActiveExact = { exact: true };
  readonly routerActivePrefix = { exact: false };

  private readonly destroy$ = new Subject<void>();
  private navUrl = '';
  private notificationPollStartSub?: Subscription;

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
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
    private ngZone: NgZone
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collapsed'] && !changes['collapsed'].firstChange) {
      this.clearFlyoutState();
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    this.navUrl = this.normalizePath(this.router.url);

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
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

    this.notificationPollStartSub = timer(2500)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notificationPollStartSub = undefined;
        this.notificationDataService.startPolling();
      });

    // Reposition fixed flyout when any scroll container moves (main content) or window resizes
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('scroll', this.boundScrollReposition, true);
      window.addEventListener('resize', this.boundResizeReposition);
    });

    combineLatest([
      this.notificationDataService.inboxUnreadCount$,
      this.notificationDataService.publishUnreadCount$
    ]).pipe(takeUntil(this.destroy$))
      .subscribe(([inboxCount, publishCount]) => {
        this.applyBadgesToSections(inboxCount, publishCount);
        this.cdr.markForCheck();
      });

    this.loadMenus();
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.boundScrollReposition, true);
    window.removeEventListener('resize', this.boundResizeReposition);
    this.notificationPollStartSub?.unsubscribe();
    this.notificationDataService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  routerLinkActiveOptionsForChild(route: string): { exact: boolean } {
    if (route === '/app/publish') return this.routerActiveExact;
    /** Hub route must not prefix-match deeper siblings (e.g. /app/automation vs /app/automation/ai-replies). */
    if (route === '/app/automation') return this.routerActiveExact;
    if (route === '/app/inbox') return this.routerActiveExact;
    return this.routerActivePrefix;
  }

  /** Top-level sidebar links that must not prefix-match child routes. */
  routerLinkActiveOptionsForTopLevel(route: string): { exact: boolean } {
    return this.routerLinkActiveOptionsForChild(route);
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

  /**
   * Returns true when the icon string is a Font Awesome class (e.g. "fas fa-user", "fa fa-home").
   * Returns false for emoji / unicode characters which are rendered as plain text.
   */
  isFaIcon(icon: string): boolean {
    if (!icon) return false;
    const t = icon.trim();
    return /^fa[srbldt]?\s/.test(t) || /^fa-/.test(t);
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

  closeFlyout(): void {
    if (this.flyoutKey == null) return;
    this.clearFlyoutState();
    this.cdr.markForCheck();
  }

  private clearFlyoutState(): void {
    this.flyoutKey = null;
    this.flyoutAnchorEl = null;
    this.flyoutPosition = null;
  }

  /**
   * Fixed positioning so the panel is not clipped by sidebar overflow-y / overflow-x.
   */
  private positionFlyoutFromAnchor(anchor: HTMLElement): void {
    this.flyoutAnchorEl = anchor;
    const r = anchor.getBoundingClientRect();
    const gap = 4;
    const panelWidth = 224; // matches w-56
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right + gap;
    let top = r.top;
    if (left + panelWidth > vw - 8) {
      left = Math.max(8, r.left - panelWidth - gap);
    }
    if (top < 8) top = 8;
    const estPanelHeight = 360;
    if (top + estPanelHeight > vh - 8) {
      top = Math.max(8, vh - estPanelHeight - 8);
    }
    this.flyoutPosition = { top, left };
  }

  private repositionFlyout(): void {
    if (this.flyoutKey == null || !this.flyoutAnchorEl) return;
    this.positionFlyoutFromAnchor(this.flyoutAnchorEl);
  }

  isFlyoutOpen(section: SidebarSection, item: MenuItem): boolean {
    if (!item.children?.length) return false;
    return this.flyoutKey === this.submenuKey(section.id, item.route);
  }

  /**
   * Parent row: accordion when expanded or on mobile drawer; flyout when collapsed on lg+ only.
   */
  onParentNavClick(event: MouseEvent, section: SidebarSection, item: MenuItem): void {
    if (!item.children?.length) return;
    const isLg =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (this.collapsed && isLg) {
      event.preventDefault();
      event.stopPropagation();
      const key = this.submenuKey(section.id, item.route);
      const el = event.currentTarget as HTMLElement;
      if (this.flyoutKey === key) {
        this.clearFlyoutState();
      } else {
        this.flyoutKey = key;
        this.positionFlyoutFromAnchor(el);
        requestAnimationFrame(() => {
          if (this.flyoutKey === key && this.flyoutAnchorEl === el) {
            this.positionFlyoutFromAnchor(el);
            this.cdr.markForCheck();
          }
        });
      }
      this.cdr.markForCheck();
      return;
    }
    this.toggleSubmenu(section, item);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const isLg =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (!this.collapsed || !isLg || this.flyoutKey == null) return;
    const t = event.target;
    if (t instanceof Node && this.elementRef.nativeElement.contains(t)) return;
    this.clearFlyoutState();
    this.cdr.markForCheck();
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

  private isGroupedEmpty(grouped: {
    main?: IMenuItem[];
    management?: IMenuItem[];
    settings?: IMenuItem[];
    automation?: IMenuItem[];
    campaigns?: IMenuItem[];
  } | null): boolean {
    if (!grouped) return true;
    return (
      !(grouped.main?.length || grouped.management?.length || grouped.settings?.length || grouped.automation?.length || grouped.campaigns?.length)
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
      { id: 'automation', label: 'Automation', items: mapGroup(grouped.automation) },
      { id: 'campaigns', label: 'Campaigns', items: mapGroup(grouped.campaigns) },
      { id: 'management', label: 'Management', items: mapGroup(grouped.management) },
      { id: 'settings', label: 'Settings', items: mapGroup(grouped.settings) }
    ];
    this.sidebarSections = nextSections.filter((s) => s.items.length > 0);

    this.pruneExpandedSubmenuKeys();
    this.applyBadgesToSections(
      this.notificationDataService.inboxUnreadCountValue,
      this.notificationDataService.publishUnreadCountValue
    );
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

  /**
   * Apply notification badges to the correct sidebar sections:
   *   - Social-interaction notifications  → /app/inbox
   *   - Post-workflow notifications       → /app/publish (parent menu)
   */
  private applyBadgesToSections(inboxCount: number, publishCount: number): void {
    for (const sec of this.sidebarSections) {
      for (const item of sec.items) {
        // Inbox badge
        if (item.route === '/app/inbox') {
          item.badge = inboxCount > 0 ? inboxCount : undefined;
        }
        // Publish parent badge (approval queue lives under /app/publish)
        if (item.route === '/app/publish') {
          item.badge = publishCount > 0 ? publishCount : undefined;
          // Also clear child badges to avoid double-counting
          if (item.children) {
            for (const child of item.children) {
              if (child.route === '/app/approval-queue') {
                child.badge = publishCount > 0 ? publishCount : undefined;
              }
            }
          }
        }
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
    const role = this.currentUser?.role;
    // `reseller_admin` is a superset of `admin` (admin of their own tenant +
    // reseller powers), so it sees every menu an org admin sees. Skip the
    // per-item role gate for admin-like roles instead of requiring each menu
    // to enumerate reseller_admin.
    const adminLike = role === 'admin' || role === 'reseller_admin';
    if (!adminLike && Array.isArray(item.requiredRoles) && item.requiredRoles.length > 0) {
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
