import type { Routes } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { permissionGuard } from '@core/guards/permission.guard';

/**
 * Lessor portal, lazy-loaded behind the shell. Each child declares the
 * permission it needs, mirroring its sidebar entry in nav-items.ts.
 *
 * `data.title` drives the topbar heading; `title` sets the browser tab. Route
 * params reach the page as component inputs via withComponentInputBinding, so a
 * detail page reads `id` as an input rather than injecting ActivatedRoute.
 *
 * Ordering matters: `units/new` must precede `units/:id`, or "new" would be read
 * as a unit id.
 */
export const LESSOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('@layout/dashboard/lessor-shell').then((m) => m.LessorShell),
    children: [
      {
        path: 'dashboard',
        title: 'اللوحة',
        data: { titleKey: 'nav.dashboard' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () =>
          import('./pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },

      {
        path: 'bank-account',
        title: 'البيانات البنكية',
        data: { titleKey: 'bank.title' },
        canActivate: [permissionGuard([Permission.ManageBankDetails])],
        loadComponent: () =>
          import('./pages/bank-account-page/bank-account-page').then((m) => m.BankAccountPage),
      },

      {
        path: 'account',
        title: 'حسابي',
        data: { titleKey: 'nav.account' },
        canActivate: [permissionGuard([Permission.ManageBankDetails])],
        loadComponent: () => import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
      },

      {
        path: 'units',
        title: 'المساحات المسجّلة',
        data: { titleKey: 'nav.units' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () => import('./pages/units-page/units-page').then((m) => m.UnitsPage),
      },
      {
        path: 'units/new',
        title: 'إضافة مساحة',
        data: { title: 'إضافة مساحة' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () =>
          import('./pages/unit-form-page/unit-form-page').then((m) => m.UnitFormPage),
      },
      {
        path: 'units/:id/edit',
        title: 'تعديل المساحة',
        data: { title: 'تعديل المساحة' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () =>
          import('./pages/unit-form-page/unit-form-page').then((m) => m.UnitFormPage),
      },
      {
        path: 'units/:id',
        title: 'تفاصيل المساحة',
        data: { title: 'تفاصيل المساحة' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () =>
          import('./pages/unit-detail-page/unit-detail-page').then((m) => m.UnitDetailPage),
      },

      {
        path: 'requests',
        title: 'الطلبات',
        data: { titleKey: 'nav.requests' },
        canActivate: [permissionGuard([Permission.ViewIncomingBookings])],
        loadComponent: () =>
          import('./pages/requests-page/requests-page').then((m) => m.RequestsPage),
      },
      {
        path: 'requests/:id',
        title: 'تفاصيل الطلب',
        data: { title: 'تفاصيل الطلب' },
        canActivate: [permissionGuard([Permission.ViewIncomingBookings])],
        loadComponent: () =>
          import('./pages/request-detail-page/request-detail-page').then(
            (m) => m.RequestDetailPage,
          ),
      },

      {
        path: 'earnings',
        title: 'المستحقات',
        data: { titleKey: 'nav.earnings' },
        canActivate: [permissionGuard([Permission.ViewOwnFinancialReports])],
        loadComponent: () =>
          import('./pages/earnings-page/earnings-page').then((m) => m.EarningsPage),
      },

      {
        path: 'notifications',
        title: 'الإشعارات',
        data: { titleKey: 'topbar.notifications' },
        canActivate: [permissionGuard([Permission.ManageOwnUnits])],
        loadComponent: () =>
          import('./pages/notifications-page/notifications-page').then((m) => m.NotificationsPage),
      },

      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
];
