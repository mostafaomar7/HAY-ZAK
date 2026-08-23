import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Keeps signed-in users away from login and registration.
 *
 * Sends them to the portal their role belongs to rather than always to the
 * storefront — a lessor who follows a stale login link should land in their own
 * portal, not on the renter marketplace.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.parseUrl(auth.landingUrl()) : true;
};
