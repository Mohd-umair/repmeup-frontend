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
        tap(response => {
          if (response.success && response.data) {
            this.menusSubject.next(response.data.menus);
            this.groupedMenusSubject.next(response.data.grouped);
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
