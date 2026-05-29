import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { EntitlementsStore, FeatureKey } from '../services/entitlements.store';
import { resolvePlanFeatureForRoute } from '../constants/plan-route-features';

/**
 * Blocks navigation when the org's plan does not include a boolean feature
 * (or limit feature is disabled via limit === 0).
 */
@Injectable({ providedIn: 'root' })
export class PlanFeatureGuard implements CanActivate {
  private readonly ent = inject(EntitlementsStore);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const featureKey =
      (route.data?.['planFeature'] as FeatureKey | undefined) ||
      resolvePlanFeatureForRoute(state.url);

    if (!featureKey) return true;

    if (this.ent.isReady()) {
      return this.check(featureKey);
    }

    return this.ent.ensureLoaded().pipe(
      take(1),
      map(() => this.check(featureKey))
    );
  }

  private check(featureKey: FeatureKey): boolean {
    if (this.ent.can(featureKey)) return true;
    this.router.navigate(['/app/plans'], {
      queryParams: { upgrade: featureKey }
    });
    return false;
  }
}
