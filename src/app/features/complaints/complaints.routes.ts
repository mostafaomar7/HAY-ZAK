import type { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

/**
 * "شكاويّ" — the exception path, and it belongs to the account.
 *
 * Not under `my-bookings/` and not guarded on a renter permission, because the
 * lessor reads and answers the very same complaint: when a renter reports that
 * a space was locked, the owner of that space has to be able to answer for it
 * before anybody decides anything. One thread, two parties, one set of routes.
 *
 * `authGuard` alone for the same reason — the only requirement is being signed
 * in as one of the two people on the booking, which the server checks.
 */
export const COMPLAINTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    title: 'شكاويّ',
    data: { titleKey: 'complaints.mine' },
    loadComponent: () =>
      import('./pages/my-complaints-page/my-complaints-page').then((m) => m.MyComplaintsPage),
  },
  {
    path: ':complaintId',
    canActivate: [authGuard],
    title: 'تفاصيل الشكوى',
    loadComponent: () =>
      import('./pages/complaint-detail-page/complaint-detail-page').then(
        (m) => m.ComplaintDetailPage,
      ),
  },
];
