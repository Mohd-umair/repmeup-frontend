import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { PermissionService } from '../services/permission.service';

/**
 * Guards routes that require specific permissions.
 * Reads `data.permissions` (string[]) from the route config.
 * Admin/super_admin roles bypass all checks.
 */
@Injectable({ providedIn: 'root' })
export class PermissionGuard implements CanActivate {
  constructor(
    private permissionService: PermissionService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean {
    const requiredPermissions: string[] = route.data?.['permissions'] ?? [];

    if (requiredPermissions.length === 0) return true;

    if (this.permissionService.hasAnyPermission(requiredPermissions)) {
      return true;
    }

    this.router.navigate(['/app/dashboard']);
    return false;
  }
}
