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
    route: '/lessor/account',
    labelKey: 'nav.account',
    icon: 'user',
    permission: Permission.ManageBankDetails,
  },
];
