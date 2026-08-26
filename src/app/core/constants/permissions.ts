import { UserRole } from '../enums/user-role.enum';

/**
 * Every guarded capability the UI knows about.
 *
 * The values are two different kinds of thing, and the prefix says which:
 *
 * - **`domain:action`** — issued by the server, per user, in `user.permissions`.
 *   These are the administration capabilities, and the server is the authority:
 *   it refuses the request whatever the client believes. A guard here only
 *   decides whether to offer a control that would be refused.
 * - **`client:…`** — never sent by anybody. A renter and a lessor come back with
 *   `permissions: []` because their capabilities follow from `role` alone: a
 *   `LESSOR` token is what makes `/lessor/*` answer. These exist so the nav and
 *   the routes have one vocabulary instead of two.
 *
 * Adding a server permission means adding the wire string the server sends —
 * `PermissionService` matches on the value, so a typo silently grants nothing.
 */
export enum Permission {
  // ── Issued by the server (the complete vocabulary, read off the running API).
  ReviewUnit = 'units:review',
  ManageUsers = 'users:manage',
  ManageBookings = 'bookings:manage',
  ManageComplaints = 'complaints:manage',
  ExecutePayouts = 'payouts:approve',
  IssueRefunds = 'refunds:issue',
  /**
   * Platform configuration that is not money: integration keys and system
   * limits. System-administrator only.
   *
   * The commission and the VAT rate are **not** here — they moved to
   * `SetFinancialSettings`, which the finance officer holds. Guarding the
   * financial screen on this one locks that officer out of their own settings.
   */
  ManageSettings = 'settings:manage',
  /** Commission and VAT. `SYSTEM_ADMIN` + `FINANCE` (SRS §5). */
  SetFinancialSettings = 'settings:financial',
  /** The reference lists. `SYSTEM_ADMIN` + `OPERATIONS`. */
  ManageReferenceData = 'reference:manage',
  /**
   * The audit trail. `SYSTEM_ADMIN` alone, and deliberately so: it records what
   * every administrator did, including whoever is reading it.
   */
  ViewAuditLog = 'audit:view',
  ViewReports = 'reports:view',
  ManageCms = 'cms:manage',
  /**
   * Creating and suspending administrator accounts. `SYSTEM_ADMIN` alone.
   *
   * No screen claims it yet — it is here because this enum is the wire's whole
   * vocabulary, and a value the server issues that the client has never heard
   * of is exactly what `WIRE_PERMISSIONS` would silently drop.
   */
  ManageAdmins = 'admins:manage',

  // ── Implied by the role. Never appear on the wire.
  BrowseMarketplace = 'client:marketplace.browse',
  ViewUnitDetails = 'client:units.view',
  CreateAccount = 'client:account.create',
  ManageOwnUnits = 'client:units.own',
  CreateBooking = 'client:bookings.create',
  /**
   * Raise a complaint against a booking. It replaced `CancelBooking`: neither
   * party may cancel, and a problem with a booking is a complaint for an
   * administrator to resolve.
   */
  RaiseComplaint = 'client:complaints.raise',
  ViewIncomingBookings = 'client:bookings.incoming',
  ViewGoodsDescription = 'client:bookings.goods',
  ManageBankDetails = 'client:bank.manage',
  ViewOwnFinancialReports = 'client:earnings.own',
}

/** The values the server may send. Anything else in `permissions` is ignored. */
export const WIRE_PERMISSIONS: ReadonlySet<string> = new Set(
  Object.values(Permission).filter((value) => !value.startsWith('client:')),
);

const PUBLIC: readonly Permission[] = [Permission.BrowseMarketplace, Permission.ViewUnitDetails];

/**
 * What each role can do without the server saying so.
 *
 * Administration is deliberately almost empty: everything an administrator may
 * do arrives in `user.permissions`, and a second copy of that matrix here would
 * be a second answer to the same question — the one that drifts.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.Guest]: [...PUBLIC, Permission.CreateAccount],

  [UserRole.Renter]: [
    ...PUBLIC,
    Permission.CreateBooking,
    Permission.RaiseComplaint,
    Permission.ViewGoodsDescription,
  ],

  [UserRole.Lessor]: [
    ...PUBLIC,
    Permission.ManageOwnUnits,
    Permission.ViewIncomingBookings,
    Permission.ViewGoodsDescription, // read-only for the lessor (FR-LSR-05)
    Permission.RaiseComplaint,
    Permission.ManageBankDetails,
    Permission.ViewOwnFinancialReports,
  ],

  [UserRole.Admin]: PUBLIC,
};

/**
 * Capabilities a granted permission carries with it.
 *
 * An operator who manages bookings necessarily reads what is stored in them;
 * spelling that out here keeps `ViewGoodsDescription` a single check that works
 * for a renter, a lessor and an operator alike, instead of three.
 */
export const IMPLIED_BY: Readonly<Partial<Record<Permission, readonly Permission[]>>> = {
  [Permission.ManageBookings]: [Permission.ViewIncomingBookings, Permission.ViewGoodsDescription],
  [Permission.ManageComplaints]: [Permission.ViewGoodsDescription],
};

/**
 * What a role grants on its own — routing and nav only.
 *
 * Not a permission check: an administrator's capabilities are not in here. Use
 * `PermissionService.can()`, which merges this with what the server issued.
 */
export function roleGrants(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
