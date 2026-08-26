import type { Routes } from '@angular/router';

/**
 * Everything that lives inside the renter-facing shell.
 *
 * The shell is declared once, here, with each feature lazy-loaded beneath it.
 * Registering the features side by side at the application root would have
 * worked, but every one of them would have needed its own copy of the shell —
 * and the header would then be torn down and rebuilt on the walk from a search
 * result to a booking to an invoice, losing scroll position and re-fetching the
 * notification count each time.
 *
 * No guard sits on the shell: browsing and search are open (FR-MKT-02, design
 * rule 1). The guards live on the individual features that need them — booking,
 * my-bookings and account.
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./public-shell/public-shell').then((m) => m.PublicShell),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES),
      },
      {
        path: 'booking',
        loadChildren: () =>
          import('@features/booking/booking.routes').then((m) => m.BOOKING_ROUTES),
      },
      {
        // Where the payment gateway sends the browser back to. A top-level
        // segment because `returnUrl` must be a stable, whole URL on this
        // origin — the API refuses anything else, and it is the one address
        // that cannot move without a conversation.
        path: 'bookings/return',
        loadChildren: () =>
          import('@features/booking/payment-return.routes').then((m) => m.PAYMENT_RETURN_ROUTES),
      },
      {
        path: 'my-bookings',
        loadChildren: () =>
          import('@features/booking/my-bookings.routes').then((m) => m.MY_BOOKINGS_ROUTES),
      },
      {
        path: 'account',
        loadChildren: () =>
          import('@features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        // Top-level rather than under `my-bookings`: a lessor reaches the same
        // complaint about their own space, and they have no "حجوزاتي".
        path: 'my-complaints',
        loadChildren: () =>
          import('@features/complaints/complaints.routes').then((m) => m.COMPLAINTS_ROUTES),
      },
      {
        path: 'pages',
        loadChildren: () =>
          import('@features/content/content.routes').then((m) => m.CONTENT_ROUTES),
      },
    ],
  },
];
