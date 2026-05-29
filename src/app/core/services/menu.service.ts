import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { resolvePlanFeatureForRoute } from '../constants/plan-route-features';
import { EntitlementsStore, FeatureKey } from './entitlements.store';

export interface IMenuItem {
  _id: string;
  label: string;
  icon: string;
  route: string;
  requiredRoles: string[];
  requiredPermissions: string[];
  order: number;
  isActive: boolean;
  badge?: {
    enabled: boolean;
    source: 'notifications' | 'inbox' | 'custom' | 'none';
  };
  group: 'main' | 'management' | 'settings' | 'automation' | 'campaigns';
  parentId?: string;
  /** Nested items when API returns a tree under `grouped` */
  children?: IMenuItem[];
  /** Router query params (e.g. Analytics tabs on one route) */
  queryParams?: Record<string, string>;
  description?: string;
  tooltip?: string;
  requiresFeature?: string;
}

export interface IMenuResponse {
  menus: IMenuItem[];
  grouped: {
    main: IMenuItem[];
    management: IMenuItem[];
    settings: IMenuItem[];
    automation?: IMenuItem[];
    campaigns?: IMenuItem[];
  };
}

/**
 * Menu Service - Single Responsibility Principle
 * Manages dynamic menus from database with role-based access
 */
@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private menusSubject = new BehaviorSubject<IMenuItem[]>([]);
  public menus$ = this.menusSubject.asObservable();

  private groupedMenusSubject = new BehaviorSubject<any>({
    main: [],
    management: [],
    settings: [],
    automation: [],
    campaigns: []
  });
  public groupedMenus$ = this.groupedMenusSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private entitlementsStore: EntitlementsStore
  ) {}

  /**
   * Load menus for current user
   */
  loadMenus(): Observable<IApiResponse<IMenuResponse>> {
    this.loadingSubject.next(true);
    
    return this.apiService.get<IApiResponse<IMenuResponse>>('/menus')
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            let menus = response.data.menus || [];
            /** Use API tree — do not rebuild grouped from flat `menus` (would duplicate child rows). */
            let grouped = response.data.grouped;
            if (!grouped || typeof grouped !== 'object') {
              grouped = { main: [], management: [], settings: [], automation: [], campaigns: [] };
            }

            const normalized = this.normalizeAllMenuRoutes(menus, grouped);
            menus = normalized.menus;
            grouped = normalized.grouped;

            /** Hide top-level items that duplicate other flows (Content → Publish/Published; Drafts → create flow). */
            const isRemovedStandaloneMenu = (m: IMenuItem): boolean => {
              const noParent = m.parentId == null || m.parentId === '';
              if (!noParent) return false;
              return m.route === '/app/content' || m.route === '/app/drafts';
            };

            menus = menus.filter((m) => !isRemovedStandaloneMenu(m));
            const filterGroupedTop = (arr: IMenuItem[] | undefined) =>
              (arr || []).filter((item) => !isRemovedStandaloneMenu(item));
            grouped = {
              main: filterGroupedTop(grouped.main),
              management: filterGroupedTop(grouped.management),
              settings: filterGroupedTop(grouped.settings),
              automation: filterGroupedTop(grouped.automation),
              campaigns: filterGroupedTop(grouped.campaigns)
            };

            menus = this.filterMenusByPlan(menus);
            grouped = {
              main: this.filterMenusByPlan(grouped.main),
              management: this.filterMenusByPlan(grouped.management),
              settings: this.filterMenusByPlan(grouped.settings),
              automation: this.filterMenusByPlan(grouped.automation),
              campaigns: this.filterMenusByPlan(grouped.campaigns)
            };

            this.menusSubject.next(menus);
            this.groupedMenusSubject.next(grouped);
          }
          this.loadingSubject.next(false);
        })
      );
  }

  /**
   * Get all menus (Admin only)
   */
  getAllMenus(): Observable<IApiResponse<IMenuItem[]>> {
    return this.apiService.get<IApiResponse<IMenuItem[]>>('/menus/all');
  }

  /**
   * Create menu (Admin only)
   */
  createMenu(menu: Partial<IMenuItem>): Observable<IApiResponse<IMenuItem>> {
    return this.apiService.post<IApiResponse<IMenuItem>>('/menus', menu);
  }

  /**
   * Update menu (Admin only)
   */
  updateMenu(id: string, menu: Partial<IMenuItem>): Observable<IApiResponse<IMenuItem>> {
    return this.apiService.put<IApiResponse<IMenuItem>>(`/menus/${id}`, menu);
  }

  /**
   * Delete menu (Admin only)
   */
  deleteMenu(id: string): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>(`/menus/${id}`);
  }

  /**
   * Seed default menus (Admin only)
   */
  seedMenus(): Observable<IApiResponse<IMenuItem[]>> {
    return this.apiService.post<IApiResponse<IMenuItem[]>>('/menus/seed', {});
  }

  /**
   * Get current menus value (synchronous)
   */
  get menusValue(): IMenuItem[] {
    return this.menusSubject.value;
  }

  /**
   * Get grouped menus value (synchronous)
   */
  get groupedMenusValue(): any {
    return this.groupedMenusSubject.value;
  }

  /**
   * DB menus often omit `/app/` or use a nested path. Angular app routes live under `/app/...`.
   * e.g. `app/publish/approval-queue` must become `/app/approval-queue` (not `/app/app/publish/...`).
   */
  private static readonly PUBLIC_SINGLE_ROUTE_SEGMENTS = new Set([
    'home',
    'contact',
    'about',
    'privacy-policy',
    'terms-conditions',
    'refund-cancellation-policy',
    'terms',
    'data-deletion-status',
    'auth',
    'login',
    'register'
  ]);

  private normalizeMenuRouteForApp(route: string): string {
    const raw = (route || '').trim();
    if (!raw) return raw;
    const qIdx = raw.search(/[?#]/);
    const pathRaw = (qIdx === -1 ? raw : raw.slice(0, qIdx)).trim();
    const suffix = qIdx === -1 ? '' : raw.slice(qIdx);
    if (!pathRaw) return raw;

    let path = pathRaw;
    if (!path.startsWith('/')) {
      path = path.startsWith('app/') ? `/${path}` : path;
    }
    const core = path.replace(/\/+$/, '') || '/';

    if (
      core === '/app/publish/approval-queue' ||
      core === '/app/app/publish/approval-queue'
    ) {
      return `/app/approval-queue${suffix}`;
    }

    if (core.startsWith('/app/') || core === '/app') {
      return `${core}${suffix}`;
    }

    if (!pathRaw.startsWith('/')) {
      const seg = pathRaw.replace(/^\/+/, '');
      return `/app/${seg}${suffix}`;
    }

    const inner = core.replace(/^\/+|\/+$/g, '');
    if (!inner || inner.includes('/')) {
      return `${core}${suffix}`;
    }
    if (inner === 'app' || MenuService.PUBLIC_SINGLE_ROUTE_SEGMENTS.has(inner)) {
      return `${core}${suffix}`;
    }
    return `/app/${inner}${suffix}`;
  }

  private normalizeMenuItemDeep(item: IMenuItem): IMenuItem {
    const route = this.normalizeMenuRouteForApp(item.route);
    const requiresFeature =
      item.requiresFeature || resolvePlanFeatureForRoute(route) || undefined;
    const children = item.children?.length
      ? item.children.map((c) => this.normalizeMenuItemDeep(c))
      : undefined;
    return { ...item, route, requiresFeature, ...(children ? { children } : {}) };
  }

  /** Hide menu entries for plan-gated modules when entitlements are loaded. */
  private filterMenusByPlan(items: IMenuItem[] | undefined): IMenuItem[] {
    if (!this.entitlementsStore.isReady()) return items || [];
    return (items || [])
      .map((item) => {
        const children = item.children?.length
          ? this.filterMenusByPlan(item.children)
          : undefined;
        const featureKey = (item.requiresFeature ||
          resolvePlanFeatureForRoute(item.route)) as FeatureKey | undefined;
        if (featureKey && !this.entitlementsStore.can(featureKey)) {
          if (children?.length) {
            return { ...item, children };
          }
          return null;
        }
        return children ? { ...item, children } : item;
      })
      .filter((item): item is IMenuItem => item != null);
  }

  private normalizeAllMenuRoutes(
    menus: IMenuItem[],
    grouped: IMenuResponse['grouped']
  ): { menus: IMenuItem[]; grouped: IMenuResponse['grouped'] } {
    const normList = (list: IMenuItem[] | undefined) =>
      (list || []).map((m) => this.normalizeMenuItemDeep(m));
    return {
      menus: normList(menus),
      grouped: {
        main: normList(grouped.main),
        management: normList(grouped.management),
        settings: normList(grouped.settings),
        automation: normList(grouped.automation),
        campaigns: normList(grouped.campaigns)
      }
    };
  }
}
