import type { Routes } from '@angular/router';

/**
 * The seven static pages (FR-CMS-01).
 *
 * One parameterised route, not seven: the pages share a layout and differ only
 * in the content the CMS returns, so an eighth page is a publishing decision
 * rather than a release. An unknown slug renders the page's own not-found state
 * instead of the application-wide 404, which keeps the header, footer and the
 * "related pages" rail in place — the visitor is on the site, just at a page
 * that has moved.
 */
export const CONTENT_ROUTES: Routes = [
  {
    path: ':slug',
    title: 'حيزك',
    loadComponent: () =>
      import('./pages/static-page/static-page').then((m) => m.StaticPageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'about' },
];
