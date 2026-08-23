import type { Routes } from '@angular/router';

/**
 * The public catalogue: landing page, search results, one space in full
 * (FR-MKT).
 *
 * No guards. Browsing and search are open to guests (FR-MKT-02, and the design's
 * first binding rule); registration is only requested when "احجز الآن" is
 * pressed, and appears as a dialog rather than a redirect.
 *
 * The shell these render inside is declared in layout/public/public.routes.ts.
 */
export const MARKETPLACE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'حيزك — كل مساحة لها قيمة',
    loadComponent: () => import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'units',
    pathMatch: 'full',
    title: 'نتائج البحث',
    loadComponent: () => import('./pages/results-page/results-page').then((m) => m.ResultsPage),
  },
  {
    path: 'units/:id',
    title: 'تفاصيل المساحة',
    loadComponent: () =>
      import('./pages/unit-details-page/unit-details-page').then((m) => m.UnitDetailsPage),
  },
];
