import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import type { Permission } from '../constants/permissions';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Factory guard driven by the permission matrix rather than by role names:
 * `canActivate: [permissionGuard([Permission.ReviewUnit])]`.
 */
export const permissionGuard = (required: Permission[]): CanActivateFn => {
  return (_route, state) => {
    const auth = inject(AuthService);
    const permissions = inject(PermissionService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    return permissions.canAll(required) ? true : router.createUrlTree(['/forbidden']);
  };
};
