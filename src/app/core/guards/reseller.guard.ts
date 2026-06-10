import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guards the in-app reseller pages (/app/reseller/*).
 * Allows reseller_admin (and super_admin). Others are redirected to the dashboard.
 */
@Injectable({ providedIn: 'root' })
export class ResellerGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const role = this.authService.currentUserValue?.role as string | undefined;
    if (role === 'reseller_admin' || role === 'super_admin') {
      return true;
    }
    return this.router.createUrlTree(['/app/dashboard']);
  }
}
