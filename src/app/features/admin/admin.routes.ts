import type { Routes } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { guestGuard } from '@core/guards/guest.guard';
import { permissionGuard } from '@core/guards/permission.guard';
import { AdminQueueCountsService } from './services/admin-queue-counts.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminSettingsStore } from './services/admin-settings.store';

/**
 * The operations console (FR-ADM, FR-RPT), lazy-loaded behind its own shell.
 *
 * Every child declares the permission it needs, matching its entry in
 * `ADMIN_NAV` — so a route guard and the link that reaches it are derived from
 * the same table and cannot disagree.
 *
 * `AdminSettingsStore` and the queue counters are provided here rather than on
 * the shell component. A component provider is tied to that component's lifetime
 * and is only reachable through the element-injector chain; on the route both
 * live exactly as long as the console does and every page resolves the same
 * instance, which is the whole reason they exist — one answer to "how late is
 * late" and one answer to "how much work is waiting".
 *
 * `/admin/login` sits outside the shell — it has no sidebar, and a signed-in
 * operator landing on it is sent on by `guestGuard`.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    title: 'تسجيل دخول الإدارة',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/admin-login-page/admin-login-page').then((m) => m.AdminLoginPage),
  },

  {
    path: '',
    providers: [AdminSettingsStore, AdminSettingsService, AdminQueueCountsService],
    loadComponent: () => import('@layout/admin/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: 'dashboard',
        title: 'لوحة المؤشرات',
        data: { titleKey: 'adminNav.dashboard' },
        canActivate: [permissionGuard([Permission.ViewReports])],
        loadComponent: () =>
          import('./pages/dashboard-page/dashboard-page').then((m) => m.AdminDashboardPage),
      },

      {
        path: 'listings',
        title: 'مراجعة الإعلانات',
        data: { titleKey: 'adminNav.listings' },
        canActivate: [permissionGuard([Permission.ReviewUnit])],
        loadComponent: () =>
          import('./pages/listings-page/listings-page').then((m) => m.AdminListingsPage),
      },
      {
        path: 'complaints',
        title: 'الشكاوى',
        data: { titleKey: 'adminNav.complaints' },
        canActivate: [permissionGuard([Permission.ManageComplaints])],
        loadComponent: () =>
          import('./pages/complaints-page/complaints-page').then((m) => m.AdminComplaintsPage),
      },

      {
        path: 'payments',
        title: 'متابعة المدفوعات',
        data: { titleKey: 'adminNav.payments' },
        canActivate: [permissionGuard([Permission.ViewReports])],
        loadComponent: () =>
          import('./pages/payments-page/payments-page').then((m) => m.AdminPaymentsPage),
      },
      {
        path: 'transfers',
        title: 'التحويلات',
        data: { titleKey: 'adminNav.transfers' },
        canActivate: [permissionGuard([Permission.ExecutePayouts])],
        loadComponent: () =>
          import('./pages/transfers-page/transfers-page').then((m) => m.AdminTransfersPage),
      },
      {
        // `reports:view`, not a money permission: the server answers 200 to all
        // three administrator kinds, and guarding it tighter than the API would
        // hide a register from somebody the API lets read it.
        path: 'invoices',
        title: 'سجل الفواتير',
        data: { titleKey: 'adminNav.invoices' },
        canActivate: [permissionGuard([Permission.ViewReports])],
        loadComponent: () =>
          import('./pages/invoices-page/invoices-page').then((m) => m.AdminInvoicesPage),
      },
      {
        path: 'reports',
        title: 'التقارير',
        data: { titleKey: 'adminNav.reports' },
        canActivate: [permissionGuard([Permission.ViewReports])],
        loadComponent: () =>
          import('./pages/reports-page/reports-page').then((m) => m.AdminReportsPage),
      },
      {
        path: 'financial-settings',
        title: 'الإعدادات المالية',
        data: { titleKey: 'adminNav.financialSettings' },
        // The finance officer's screen, and they do not hold `settings:manage`.
        canActivate: [permissionGuard([Permission.SetFinancialSettings])],
        loadComponent: () =>
          import('./pages/financial-settings-page/financial-settings-page').then(
            (m) => m.AdminFinancialSettingsPage,
          ),
      },

      {
        path: 'users',
        title: 'المستخدمون',
        data: { titleKey: 'adminNav.users' },
        canActivate: [permissionGuard([Permission.ManageUsers])],
        loadComponent: () => import('./pages/users-page/users-page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'reference-lists',
        title: 'القوائم المرجعية',
        data: { titleKey: 'adminNav.referenceLists' },
        canActivate: [permissionGuard([Permission.ManageReferenceData])],
        loadComponent: () =>
          import('./pages/reference-lists-page/reference-lists-page').then(
            (m) => m.AdminReferenceListsPage,
          ),
      },
      {
        path: 'content',
        title: 'إدارة المحتوى',
        data: { titleKey: 'adminNav.content' },
        canActivate: [permissionGuard([Permission.ManageCms])],
        loadComponent: () =>
          import('./pages/content-page/content-page').then((m) => m.AdminContentPage),
      },
      {
        path: 'terms',
        title: 'الشروط والأحكام',
        data: { titleKey: 'adminNav.terms' },
        canActivate: [permissionGuard([Permission.ManageCms])],
        loadComponent: () => import('./pages/terms-page/terms-page').then((m) => m.AdminTermsPage),
      },
      {
        path: 'audit',
        title: 'سجل التدقيق',
        data: { titleKey: 'adminNav.audit' },
        canActivate: [permissionGuard([Permission.ViewAuditLog])],
        loadComponent: () => import('./pages/audit-page/audit-page').then((m) => m.AdminAuditPage),
      },
      {
        path: 'library',
        title: 'مكتبة المكوّنات',
        data: { titleKey: 'adminNav.library' },
        canActivate: [permissionGuard([Permission.ManageCms])],
        loadComponent: () =>
          import('./pages/library-page/library-page').then((m) => m.AdminLibraryPage),
      },

      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
];
