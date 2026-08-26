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
 * The outcome screen is **not** here. The gateway sends the browser to
 * `/bookings/return` on this origin, which is a fixed address the API
 * validates, so it lives at the top level rather than under this feature's
 * prefix — see `payment-return.routes.ts`. It is an outcome rather than a
 * fourth step, and showing the step header above it would suggest there is
 * more to do.
 */
export const BOOKING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    loadComponent: () => import('./pages/booking-shell/booking-shell').then((m) => m.BookingShell),
    children: [
      {
        // Declared before `new/:unitId` so the longer path is tried first.
        //
        // Still keyed by the unit, not by a booking: nothing exists on the
        // server until this step submits. The create call takes the dates, the
        // goods and the acknowledgement together and comes back holding the
        // dates, so there is no id to key off before it.
        path: 'new/:unitId/goods',
        data: { step: 'goods' },
        title: 'وصف البضاعة',
        loadComponent: () => import('./pages/goods-step/goods-step').then((m) => m.GoodsStep),
      },
      {
        // `new/:unitId` rather than `:unitId/dates`: the pay step keys off the
        // booking id, and one parameter name meaning two different things
        // would be a trap for the next person reading this file.
        path: 'new/:unitId',
        data: { step: 'dates' },
        title: 'اختيار التواريخ',
        loadComponent: () => import('./pages/dates-step/dates-step').then((m) => m.DatesStep),
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
