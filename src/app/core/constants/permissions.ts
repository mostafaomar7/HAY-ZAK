import { UserRole } from '../enums/user-role.enum';

/** Every guarded capability in the system (SRS §5). */
export enum Permission {
  BrowseMarketplace = 'BrowseMarketplace',
  ViewUnitDetails = 'ViewUnitDetails',
  CreateAccount = 'CreateAccount',
  ManageOwnUnits = 'ManageOwnUnits',
  PublishUnitDirectly = 'PublishUnitDirectly',
  ReviewUnit = 'ReviewUnit',
  CreateBooking = 'CreateBooking',
  ViewIncomingBookings = 'ViewIncomingBookings',
  ViewGoodsDescription = 'ViewGoodsDescription',
  ManageBankDetails = 'ManageBankDetails',
  ExecutePayouts = 'ExecutePayouts',
  ConfigureFinancials = 'ConfigureFinancials',
  ViewOwnFinancialReports = 'ViewOwnFinancialReports',
  ViewAllFinancialReports = 'ViewAllFinancialReports',
  ViewAuditTrail = 'ViewAuditTrail',
  ManageUsers = 'ManageUsers',
  ManageReferenceData = 'ManageReferenceData',
  ManageCmsAndTerms = 'ManageCmsAndTerms',
  /**
   * Raise a complaint against a booking. It replaced `CancelBooking`: neither
   * party may cancel, and a problem with a booking is a complaint for an
   * administrator to resolve.
   */
  RaiseComplaint = 'RaiseComplaint',
  ResolveDisputes = 'ResolveDisputes',
}

/**
 * SRS §5 transcribed literally. The matrix is binding and MUST also be enforced
 * server-side (NFR-SEC-03) — this copy only decides what the UI offers.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.Guest]: [
    Permission.BrowseMarketplace,
    Permission.ViewUnitDetails,
    Permission.CreateAccount,
  ],

  [UserRole.Renter]: [
    Permission.BrowseMarketplace,
    Permission.ViewUnitDetails,
    Permission.CreateBooking,
    Permission.RaiseComplaint,
    Permission.ViewGoodsDescription,
  ],

  [UserRole.Lessor]: [
    Permission.BrowseMarketplace,
    Permission.ViewUnitDetails,
    Permission.ManageOwnUnits,
    Permission.ViewIncomingBookings,
    Permission.ViewGoodsDescription, // read-only for the lessor (FR-LSR-05)
    Permission.RaiseComplaint,
    Permission.ManageBankDetails,
    Permission.ViewOwnFinancialReports,
  ],

  [UserRole.OperationsSupervisor]: [
    Permission.BrowseMarketplace,
    Permission.ViewUnitDetails,
    Permission.PublishUnitDirectly,
    Permission.ReviewUnit,
    Permission.ViewIncomingBookings,
    Permission.ViewGoodsDescription,
    Permission.ManageUsers,
    Permission.ManageReferenceData,
    Permission.ResolveDisputes,
    Permission.ViewAllFinancialReports,
  ],

  [UserRole.FinanceOfficer]: [
    Permission.BrowseMarketplace,
    Permission.ViewUnitDetails,
    Permission.ExecutePayouts,
    Permission.ConfigureFinancials,
    Permission.ViewAllFinancialReports,
    Permission.ViewIncomingBookings,
  ],

  [UserRole.SystemAdministrator]: Object.values(Permission),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
