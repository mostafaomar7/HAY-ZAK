import type { Routes } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { permissionGuard } from '@core/guards/permission.guard';

/**
 * Where the payment gateway sends the browser back to.
 *
 * One route, and a fixed one: `returnUrl` has to be a whole URL on this
 * origin — the API refuses anything else, because an open return parameter is
 * a phishing tool — so this address is part of the contract rather than a
 * layout choice.
 *
 * The booking id and the gateway's own verdict arrive in the query string.
 * The id is used; **the verdict is not**. The webhook that actually settles
 * the payment can land before or after the browser gets here, and both happen,
 * so the page reads the booking and believes that instead. See
 * `payment-return-page.ts`.
 */
export const PAYMENT_RETURN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard([Permission.CreateBooking])],
    title: 'نتيجة الدفع',
    loadComponent: () =>
      import('./pages/payment-return-page/payment-return-page').then((m) => m.PaymentReturnPage),
  },
];
