import type { Routes } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { permissionGuard } from '@core/guards/permission.guard';

/**
 * "حجوزاتي" and everything hanging off one booking (RNT-01, RNT-02, RNT-07,
 * RNT-08).
 *
 * Separate from booking.routes.ts because these are not steps: the wizard is a
 * linear journey with a shared shell and a running hold, while these are records
 * of bookings that already exist.
 *
 * Guarded on `CreateBooking` — the permission that marks an account as a renter
 * (SRS §5). Cancellation additionally needs `CancelBooking`, which the same role
 * carries, so the screen is reached with one check and the action refused by the
 * server if the matrix ever changes.
 */
export const MY_BOOKINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'حجوزاتي',
    loadComponent: () =>
      import('./pages/my-bookings-page/my-bookings-page').then((m) => m.MyBookingsPage),
  },
  {
    path: ':bookingId',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'تفاصيل الحجز',
    loadComponent: () =>
      import('./pages/booking-detail-page/booking-detail-page').then((m) => m.BookingDetailPage),
  },
  {
    path: ':bookingId/invoice',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'الفاتورة',
    loadComponent: () => import('./pages/invoice-page/invoice-page').then((m) => m.InvoicePage),
  },
  {
    path: ':bookingId/cancel',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'إلغاء الحجز',
    loadComponent: () =>
      import('./pages/cancel-booking-page/cancel-booking-page').then((m) => m.CancelBookingPage),
  },
];
