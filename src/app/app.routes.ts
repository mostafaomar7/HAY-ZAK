import type { Routes } from '@angular/router';

/**
 * Root routing table. Every feature is lazy-loaded from its own routes file so
 * the initial bundle only ever carries the shell.
 *
 * The full planned tree, with the permission each route needs, is in
 * docs/route-map.md. Features are registered here as they are built.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  {
    path: 'lessor',
    loadChildren: () => import('@features/lessor/lessor.routes').then((m) => m.LESSOR_ROUTES),
  },

  {
    path: 'admin',
    loadChildren: () => import('@features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  /**
   * The address the emailed confirmation link actually points at.
   *
   * The server builds `{WEB_URL}/verify-email?token=…`, not `/auth/verify-email`
   * — so without this the one link in that email lands on the not-found page.
   * A redirect rather than a second mounting of the component: one screen, one
   * place it lives, and `queryParamsHandling` carries the token across.
   */
  {
    path: 'verify-email',
    redirectTo: 'auth/verify-email',
    pathMatch: 'full',
  },

  {
    path: 'forbidden',
    title: 'لا تملك صلاحية الوصول',
    loadComponent: () =>
      import('@features/system/pages/forbidden-page/forbidden-page').then((m) => m.ForbiddenPage),
  },

  // The renter side owns the root: a guest landing on the site sees the public
  // home page, not a redirect into the lessor portal. One shell wraps the whole
  // of it — see layout/public/public.routes.ts.
  {
    path: '',
    loadChildren: () => import('@layout/public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },

  // Must stay last. Also catches the guards' redirect targets for routes that
  // are not built yet (e.g. /auth/login) rather than throwing a router error.
  {
    path: '**',
    title: 'الصفحة غير موجودة',
    loadComponent: () =>
      import('@features/system/pages/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
