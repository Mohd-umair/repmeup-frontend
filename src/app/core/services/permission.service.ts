import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { IUser } from '../models/user.model';

/**
 * Centralized permission checker.
 * Listens to the current user and exposes helpers to check
 * permission codes that come from the user's assigned Group.
 *
 * super_admin bypasses permission checks.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<Set<string>>(new Set());
  permissions$ = this.permissionsSubject.asObservable();

  private currentRole: string | null = null;
  private hasResolvedPermissions = false;

  /** Avoid emitting identical permission sets (new Set() every time was retriggering sidebar rebuilds in a tight loop). */
  private lastSyncedUserPermissionKey: string | null = null;

  private readonly BYPASS_ROLES = ['super_admin'];

  /** Route → minimum permission code mapping used by sidebar filtering */
  static readonly ROUTE_PERMISSION_MAP: Record<string, string> = {
    '/app/dashboard':       'analytics.read',
    '/app/inbox':           'inbox.read',
    '/app/publish':         'posts.create',
    '/app/calendar':        'posts.read',
    '/app/publish/calendar':'posts.read',
    '/app/publish/published':'posts.read',
    '/app/publish/approval-queue': 'posts.read',
    '/app/content':         'posts.read',
    '/app/brand-hub':       'posts.read',
    '/app/content-studio':  'posts.create',
    '/app/approval-queue':  'posts.read',
    '/app/trend-explorer':  'analytics.export',
    '/app/analytics': 'analytics.read',
    '/app/knowledge-base':  'knowledge_base.read',
    '/app/settings':                    'settings.read',
    '/app/settings/platforms':        'settings.read',
    '/app/settings/profile':          'settings.read',
    '/app/settings/organization':     'organization.read',
    '/app/settings/notifications':    'settings.read',
    '/app/settings/payment-gateways': 'settings.read',
    '/app/payments/analytics':         'settings.read',
    '/app/automation/ai-replies':      'settings.read',
    '/app/settings/brand-rules':      'settings.read',
    '/app/settings/compliance':       'settings.read',
    '/app/agents':          'users.read',
    '/app/plans':           'billing.manage',
    '/app/ai-credits':      'billing.read',
    '/app/notifications':   'settings.read',
    '/app/media-library':   'media.read',
    '/app/campaigns':       'settings.read'
  };

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => this.syncPermissions(user));
  }

  private syncPermissions(user: IUser | null): void {
    if (!user) {
      if (this.lastSyncedUserPermissionKey === '__logged_out__') {
        return;
      }
      this.lastSyncedUserPermissionKey = '__logged_out__';
      this.currentRole = null;
      this.hasResolvedPermissions = false;
      this.permissionsSubject.next(new Set());
      return;
    }

    const codes = user.resolvedPermissions ?? [];
    const key = `${String(user._id ?? '')}|${user.role ?? ''}|${[...codes].sort().join('\u001f')}`;
    if (key === this.lastSyncedUserPermissionKey) {
      return;
    }
    this.lastSyncedUserPermissionKey = key;

    this.currentRole = user.role;
    this.hasResolvedPermissions = codes.length > 0;
    this.permissionsSubject.next(new Set(codes));
  }

  /** True if the user's group grants this permission code, or user is super_admin. */
  hasPermission(code: string): boolean {
    if (this.isBypassRole()) return true;
    return this.permissionsSubject.value.has(code);
  }

  /** True if the user has at least one of the given permission codes. */
  hasAnyPermission(codes: string[]): boolean {
    if (this.isBypassRole()) return true;
    const perms = this.permissionsSubject.value;
    return codes.some(c => perms.has(c));
  }

  /** True if the user has all of the given permission codes. */
  hasAllPermissions(codes: string[]): boolean {
    if (this.isBypassRole()) return true;
    const perms = this.permissionsSubject.value;
    return codes.every(c => perms.has(c));
  }

  /** Whether the user's route is allowed (for sidebar filtering and guard). */
  canAccessRoute(route: string): boolean {
    if (this.isBypassRole()) return true;
    const normalizedRoute = this.normalizeRoute(route);
    const required = PermissionService.ROUTE_PERMISSION_MAP[normalizedRoute];
    if (!required) return true;
    return this.hasPermission(required);
  }

  private normalizeRoute(route: string): string {
    if (!route) return route;
    const [pathOnly] = route.split(/[?#]/);
    if (!pathOnly) return route;
    if (pathOnly.length > 1 && pathOnly.endsWith('/')) {
      return pathOnly.slice(0, -1);
    }
    return pathOnly;
  }

  private isBypassRole(): boolean {
    if (!this.currentRole) return false;
    if (this.BYPASS_ROLES.includes(this.currentRole)) return true;
    // Safety fallback: avoid locking out legacy admin users
    // who are not assigned to a group yet.
    if (this.currentRole === 'admin' && !this.hasResolvedPermissions) return true;
    return false;
  }
}
