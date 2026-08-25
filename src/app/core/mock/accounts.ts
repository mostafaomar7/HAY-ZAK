import { AccountStatus, AdminRole, UserRole } from '../enums/user-role.enum';
import type { User } from '../models/user.model';
import { MOCK_ADMIN_USER, SEEDED_ADMIN_PERMISSIONS } from './admin.fixtures';
import { MOCK_LESSOR } from './lessor.fixtures';

/**
 * Every identity a development sign-in can produce — one per role.
 *
 * The product allows a single role per account (FR-AUTH-12), so a demo that
 * shows the platform to a client needs one account per role, not one account
 * with everything switched on. Each entry below is the same person the fixtures
 * and the admin user list already name, so the console's "المستخدمون" screen
 * doubles as the credential list: what an operator reads there is what a
 * demonstrator can sign in as.
 *
 * Development only. The real API decides this, and the guards enforce the role
 * against whatever it returns — this file only decides which mock is handed
 * back so the portals can be walked before the backend exists.
 */

/** The design's renter across every prototype (`renter.fixtures.ts`, usr-8). */
export const MOCK_RENTER: User = {
  id: 'usr-8',
  fullName: 'فهد الدوسري',
  mobile: '0552104478',
  email: 'f.aldosari@example.com',
  role: UserRole.Renter,
  status: AccountStatus.Active,
  mobileVerifiedAt: '2026-07-24T09:00:00Z',
  createdAt: '2026-07-24T09:00:00Z',
};

/** usr-6 in the console's user list. */
export const MOCK_OPERATIONS_SUPERVISOR: User = {
  id: 'usr-6',
  fullName: 'نوف السالم',
  mobile: '0542208891',
  email: 'nouf@hayzak.com',
  role: UserRole.Admin,
  adminRole: AdminRole.Operations,
  permissions: SEEDED_ADMIN_PERMISSIONS[AdminRole.Operations],
  status: AccountStatus.Active,
  mobileVerifiedAt: '2026-01-19T09:00:00Z',
  createdAt: '2026-01-19T09:00:00Z',
};

/** usr-7 in the console's user list. */
export const MOCK_FINANCE_OFFICER: User = {
  id: 'usr-7',
  fullName: 'ريم الغامدي',
  mobile: '0556403312',
  email: 'reem@hayzak.com',
  role: UserRole.Admin,
  adminRole: AdminRole.Finance,
  permissions: SEEDED_ADMIN_PERMISSIONS[AdminRole.Finance],
  status: AccountStatus.Active,
  mobileVerifiedAt: '2026-02-02T09:00:00Z',
  createdAt: '2026-02-02T09:00:00Z',
};

/**
 * Ordered as the demo walks them: the two public portals first, then the three
 * console roles. `MOCK_LESSOR` stays defined beside the lessor fixtures that
 * link to it, and `MOCK_ADMIN_USER` beside the console's.
 */
export const MOCK_ACCOUNTS: readonly User[] = [
  MOCK_LESSOR,
  MOCK_RENTER,
  MOCK_ADMIN_USER,
  MOCK_OPERATIONS_SUPERVISOR,
  MOCK_FINANCE_OFFICER,
];

/**
 * Which account a sign-in produces, by email or by mobile — the public login
 * takes either in one field, so both have to resolve to the same person.
 *
 * Anything unrecognised returns the lessor rather than failing: a demo where
 * every made-up address still opens a portal is the point, and a mock that
 * rejected credentials would only be pretending to authenticate.
 */
export function accountFor(identifier: string): User {
  const value = identifier.trim().toLowerCase();
  if (!value) return MOCK_LESSOR;

  const digits = value.replace(/\D/g, '');

  return (
    MOCK_ACCOUNTS.find(
      (account) =>
        account.email?.toLowerCase() === value ||
        (digits.length >= 9 && account.mobile.replace(/\D/g, '').endsWith(digits.slice(-9))),
    ) ?? MOCK_LESSOR
  );
}
