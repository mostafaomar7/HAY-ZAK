import { Permission } from '@core/constants/permissions';
import type { TranslationKey } from '@core/i18n/translations';

export interface AdminNavItem {
  route: string;
  labelKey: TranslationKey;
  permission: Permission;
  /** Which pending-work counter to show beside the label, if any. */
  badge?: 'listings' | 'complaints';
}

export interface AdminNavGroup {
  titleKey: TranslationKey;
  items: readonly AdminNavItem[];
}

/**
 * The admin sidebar, in the design's three groups and its order.
 *
 * The design tags each entry with the roles that may see it. Here each entry
 * carries the *permission* instead, and the sidebar filters on that — the same
 * arrangement as `LESSOR_NAV`. It resolves to the same three roles the client
 * named (مدير النظام, مشرف العمليات, المسؤول المالي) through `ROLE_PERMISSIONS`,
 * but it keeps one source of truth: a route guard and its nav entry cannot
 * disagree, and a fourth role later needs no edit here.
 *
 * A group with no visible items disappears with its heading, so the finance
 * officer never sees an empty "النظام" divider.
 */
export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    titleKey: 'adminNav.operations',
    items: [
      {
        route: '/admin/dashboard',
        labelKey: 'adminNav.dashboard',
        permission: Permission.ViewReports,
      },
      {
        route: '/admin/listings',
        labelKey: 'adminNav.listings',
        permission: Permission.ReviewUnit,
        badge: 'listings',
      },
      {
        route: '/admin/complaints',
        labelKey: 'adminNav.complaints',
        permission: Permission.ManageComplaints,
        badge: 'complaints',
      },
    ],
  },
  {
    titleKey: 'adminNav.finance',
    items: [
      {
        route: '/admin/payments',
        labelKey: 'adminNav.payments',
        permission: Permission.ViewReports,
      },
      {
        route: '/admin/transfers',
        labelKey: 'adminNav.transfers',
        permission: Permission.ExecutePayouts,
      },
      {
        route: '/admin/invoices',
        labelKey: 'adminNav.invoices',
        permission: Permission.ViewReports,
      },
      {
        route: '/admin/reports',
        labelKey: 'adminNav.reports',
        permission: Permission.ViewReports,
      },
      {
        route: '/admin/financial-settings',
        labelKey: 'adminNav.financialSettings',
        permission: Permission.SetFinancialSettings,
      },
    ],
  },
  {
    titleKey: 'adminNav.system',
    items: [
      { route: '/admin/users', labelKey: 'adminNav.users', permission: Permission.ManageUsers },
      {
        route: '/admin/reference-lists',
        labelKey: 'adminNav.referenceLists',
        permission: Permission.ManageReferenceData,
      },
      {
        route: '/admin/content',
        labelKey: 'adminNav.content',
        permission: Permission.ManageCms,
      },
      {
        route: '/admin/terms',
        labelKey: 'adminNav.terms',
        permission: Permission.ManageCms,
      },
      { route: '/admin/audit', labelKey: 'adminNav.audit', permission: Permission.ViewAuditLog },
      {
        route: '/admin/library',
        labelKey: 'adminNav.library',
        permission: Permission.ManageCms,
      },
    ],
  },
];
