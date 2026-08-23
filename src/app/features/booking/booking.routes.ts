import type { Routes } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { permissionGuard } from '@core/guards/permission.guard';

/**
 * The booking journey (RNT-03 → RNT-06).
 *
 * Guarded, unlike the rest of the renter side: browsing is open, but a booking
 * belongs to an account (design rule 1). The guard records where the visitor was
 * heading, so signing up mid-journey returns them to the same step.
 *
 * `permissionGuard` rather than a bare `authGuard`, because being signed in is
 * not the same as being allowed to book: SRS §5 gives `CreateBooking` to the
 * renter alone, and FR-AUTH-12 keeps one account to one role in Phase 1.
 *
 * The result screen sits outside the wizard shell — it is an outcome, not a
 * fifth step, and showing the four-step header above it would suggest there is
 * more to do. It is declared first so its literal `result` segment is matched
 * before the shell's parameterised children are tried.
 */
export const BOOKING_ROUTES: Routes = [
  {
    path: ':bookingId/result',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'نتيجة الدفع',
    loadComponent: () =>
      import('./pages/payment-result-page/payment-result-page').then((m) => m.PaymentResultPage),
  },

  {
    path: '',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    loadComponent: () => import('./pages/booking-shell/booking-shell').then((m) => m.BookingShell),
    children: [
      {
        // `new/:unitId` rather than `:unitId/dates`: the later steps key off the
        // booking id, and one parameter name meaning two different things would
        // be a trap for the next person reading this file.
        path: 'new/:unitId',
        data: { step: 'dates' },
        title: 'اختيار التواريخ',
        loadComponent: () => import('./pages/dates-step/dates-step').then((m) => m.DatesStep),
      },
      {
        path: ':bookingId/goods',
        data: { step: 'goods' },
        title: 'وصف البضاعة',
        loadComponent: () => import('./pages/goods-step/goods-step').then((m) => m.GoodsStep),
      },
      {
        path: ':bookingId/identity',
        data: { step: 'identity' },
        title: 'توثيق الهوية',
        loadComponent: () =>
          import('./pages/identity-step/identity-step').then((m) => m.IdentityStep),
      },
      {
        path: ':bookingId/pay',
        data: { step: 'pay' },
        title: 'الدفع',
        loadComponent: () => import('./pages/payment-step/payment-step').then((m) => m.PaymentStep),
      },
    ],
  },
];
