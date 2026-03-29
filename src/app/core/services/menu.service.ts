import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

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
  group: 'main' | 'management' | 'settings';
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
    settings: []
  });
  public groupedMenus$ = this.groupedMenusSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private apiService: ApiService) {}

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
              grouped = { main: [], management: [], settings: [] };
            }

            const hasContentTop = menus.some(
              (m: IMenuItem) => m.route === '/app/content' && !m.parentId
            );
            if (!hasContentTop) {
              const contentMenu: IMenuItem = {
                _id: 'content-default',
                label: 'Content',
                icon: '📄',
                route: '/app/content',
                requiredRoles: ['admin', 'manager', 'agent'],
                requiredPermissions: [],
                order: 5,
                isActive: true,
                group: 'main'
              };
              menus = [...menus, contentMenu];
              grouped = {
                main: [...(grouped.main || [])],
                management: [...(grouped.management || [])],
                settings: [...(grouped.settings || [])]
              };
              grouped.main.push(contentMenu);
              grouped.main.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            }

            // Inject Drafts menu item if not already present
            const hasDrafts = menus.some(
              (m: IMenuItem) => m.route === '/app/drafts' && !m.parentId
            );
            if (!hasDrafts) {
              const draftsMenu: IMenuItem = {
                _id: 'drafts-default',
                label: 'Drafts',
                icon: '📝',
                route: '/app/drafts',
                requiredRoles: ['admin', 'manager', 'agent'],
                requiredPermissions: ['posts.read'],
                order: 72,
                isActive: true,
                group: 'main'
              };
              menus = [...menus, draftsMenu];
              grouped = {
                main: [...(grouped.main || [])],
                management: [...(grouped.management || [])],
                settings: [...(grouped.settings || [])]
              };
              grouped.main.push(draftsMenu);
              grouped.main.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            }

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
}
