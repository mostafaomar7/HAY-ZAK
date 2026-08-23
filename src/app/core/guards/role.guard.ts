import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import type { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';

/**
 * Factory guard — attach as `canActivate: [roleGuard([UserRole.Admin])]`.
 * Passes when the user holds at least one of the listed roles.
 */
export const roleGuard = (allowed: UserRole[]): CanActivateFn => {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    return auth.hasAnyRole(allowed) ? true : router.createUrlTree(['/forbidden']);
  };
};
