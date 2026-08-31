import { Permission } from '@core/constants/permissions';
import type { TranslationKey } from '@core/i18n/translations';

export interface NavItem {
  route: string;
  /** Translation key, resolved by LanguageService at render time. */
  labelKey: TranslationKey;
  /** Inline SVG path data — see the icon set in the design export. */
  icon: 'grid' | 'box' | 'list' | 'card' | 'user';
  permission: Permission;
}

/**
 * The lessor sidebar, in the design's order. Each entry carries the permission
 * that reveals it, so the nav and the route guards agree by construction rather
 * than by two people remembering to update both.
 */
export const LESSOR_NAV: readonly NavItem[] = [
  {
    route: '/lessor/dashboard',
    labelKey: 'nav.dashboard',
    icon: 'grid',
    permission: Permission.ManageOwnUnits,
  },
  {
    route: '/lessor/units',
    labelKey: 'nav.units',
    icon: 'box',
    permission: Permission.ManageOwnUnits,
  },
  {
    route: '/lessor/requests',
    labelKey: 'nav.requests',
    icon: 'list',
    permission: Permission.ViewIncomingBookings,
  },
  {
    route: '/lessor/earnings',
    labelKey: 'nav.earnings',
    icon: 'card',
    permission: Permission.ViewOwnFinancialReports,
  },
  {
    // The commission invoices the platform billed this lessor. Top-level for
    // the same reason as complaints: `/me/invoices` is one endpoint for both
    // parties, and a lessor has no "حجوزاتي" to reach an invoice through.
    route: '/my-invoices',
    labelKey: 'invoices.title',
    icon: 'card',
    permission: Permission.ViewOwnFinancialReports,
  },
  {
    // The lessor reads and answers complaints about their own spaces, so this
    // is not a renter-only screen. Guarded on the same permission as the rest
    // of the portal rather than on a complaint-specific one: there is none,
    // and being a party to the booking is what the server checks.
    route: '/my-complaints',
    labelKey: 'complaints.mine',
    icon: 'list',
    permission: Permission.RaiseComplaint,
  },
  {
    route: '/lessor/account',
    labelKey: 'nav.account',
    icon: 'user',
    permission: Permission.ManageBankDetails,
  },
];
