import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { IUser } from '../models/user.model';

/**
 * Centralized permission checker.
 * Listens to the current user and exposes helpers to check
 * permission codes that come from the user's assigned Group.
 *
 * Super-admin / admin roles bypass all permission checks.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<Set<string>>(new Set());
  permissions$ = this.permissionsSubject.asObservable();

  private currentRole: string | null = null;

  private readonly BYPASS_ROLES = ['admin', 'super_admin'];

  /** Route → minimum permission code mapping used by sidebar filtering */
  static readonly ROUTE_PERMISSION_MAP: Record<string, string> = {
    '/app/dashboard':       'analytics.read',
    '/app/inbox':           'inbox.read',
    '/app/publish':         'posts.create',
    '/app/calendar':        'posts.read',
    '/app/publish/calendar':'posts.read',
    '/app/publish/published':'posts.read',
    '/app/content':         'posts.read',
    '/app/brand-hub':       'posts.read',
    '/app/content-studio':  'posts.create',
    '/app/approval-queue':  'posts.manage',
    '/app/trend-explorer':  'analytics.read',
    '/app/analytics':       'analytics.read',
    '/app/knowledge-base':  'knowledge_base.read',
    '/app/settings':        'settings.read',
    '/app/agents':          'users.read',
    '/app/plans':           'billing.read',
    '/app/ai-credits':      'billing.read',
    '/app/notifications':   'settings.read',
    '/app/media-library':   'media.read'
  };

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => this.syncPermissions(user));
  }

  private syncPermissions(user: IUser | null): void {
    if (!user) {
      this.currentRole = null;
      this.permissionsSubject.next(new Set());
      return;
    }
    this.currentRole = user.role;
    const codes = user.resolvedPermissions ?? [];
    this.permissionsSubject.next(new Set(codes));
  }

  /** True if the user's group grants this permission code, or user is admin/super_admin. */
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
    const required = PermissionService.ROUTE_PERMISSION_MAP[route];
    if (!required) return true;
    return this.hasPermission(required);
  }

  private isBypassRole(): boolean {
    return !!this.currentRole && this.BYPASS_ROLES.includes(this.currentRole);
  }
}
