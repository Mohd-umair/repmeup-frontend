import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

/**
 * Allows access only when the user's organization is an active reseller.
 */
export const ResellerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser$.pipe(
    take(1),
    map((user) => {
      const org = user?.organization;
      const orgObj = org && typeof org === 'object' ? org : null;
      if (orgObj?.isReseller && orgObj?.isActive !== false) {
        return true;
      }
      return router.createUrlTree(['/app/dashboard']);
    })
  );
};
