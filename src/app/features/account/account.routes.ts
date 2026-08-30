import type { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

/**
 * The renter's own account (RNT-09, RNT-10).
 *
 * Separate from the lessor's profile screen: the two roles have different
 * records — a renter has an identity verification block and no bank details, a
 * lessor the reverse — and the SRS keeps accounts to a single role in phase one.
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    title: 'حسابي',
    loadComponent: () => import('./pages/account-page/account-page').then((m) => m.AccountPage),
  },
  {
    /**
     * Two-factor enrolment (§17). Its own screen rather than a panel on the
     * account page: it is a sequence with a point of no return in the middle —
     * the recovery codes are shown once and never reissued — and burying that
     * among unrelated settings is how somebody navigates away from them.
     */
    path: 'security',
    canActivate: [authGuard],
    title: 'الأمان',
    loadComponent: () => import('./pages/security-page/security-page').then((m) => m.SecurityPage),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    title: 'الإشعارات',
    loadComponent: () =>
      import('./pages/notifications-page/notifications-page').then(
        (m) => m.RenterNotificationsPage,
      ),
  },
];
