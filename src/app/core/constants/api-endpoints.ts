/**
 * Every backend route in one place, grouped by SRS module. Paths are relative —
 * ApiService prefixes them with environment.apiUrl.
 *
 * These mirror the FR modules of SRS §4. Confirm against the OpenAPI spec
 * (NFR-SCL-03) once the Technical Design Document lands.
 */
export const API_ENDPOINTS = {
  /** FR-AUTH */
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    requestOtp: '/auth/otp/request',
    verifyOtp: '/auth/otp/verify',
    verifyEmail: '/auth/email/verify',
    forgotPassword: '/auth/password/forgot',
    resetPassword: '/auth/password/reset',
    changePassword: '/auth/password/change',
    /** RNT-09 — starts a Nafath session and polls its outcome. */
    nafathStart: '/auth/identity/nafath',
    nafathStatus: (requestId: string) => `/auth/identity/nafath/${requestId}`,
  },

  /** The renter's own account — FR-AUTH, FR-NTF. */
  account: {
    profile: '/account/profile',
    identity: '/account/identity',
    notificationPreferences: '/account/notification-preferences',
    delete: '/account',
  },

  /** FR-LSR */
  lessor: {
    dashboard: '/lessor/dashboard',
    units: '/lessor/units',
    bookingRequests: '/lessor/booking-requests',
    earnings: '/lessor/earnings',
    earningsTable: '/lessor/earnings/rows',
    earningsStatement: '/lessor/earnings/statement',
    bankAccounts: '/lessor/bank-accounts',
    bankAccountById: (id: string) => `/lessor/bank-accounts/${id}`,
  },

  /** FR-UNT */
  units: {
    base: '/units',
    byId: (id: string) => `/units/${id}`,
    images: (id: string) => `/units/${id}/images`,
    imageById: (unitId: string, imageId: string) => `/units/${unitId}/images/${imageId}`,
    availability: (id: string) => `/units/${id}/availability`,
    submitForReview: (id: string) => `/units/${id}/submit`,
    archive: (id: string) => `/units/${id}/archive`,
    requestSuspension: (id: string) => `/units/${id}/suspension-request`,
  },

  /** FR-MKT — public, no authentication (FR-MKT-02) */
  marketplace: {
    search: '/marketplace/units',
    unitById: (id: string) => `/marketplace/units/${id}`,
    unitAvailability: (id: string) => `/marketplace/units/${id}/availability`,
    /** The "مساحات مشابهة" rail at the foot of the details page. */
    similarUnits: (id: string) => `/marketplace/units/${id}/similar`,
  },

  /** FR-BKG */
  bookings: {
    base: '/bookings',
    byId: (id: string) => `/bookings/${id}`,
    mine: '/bookings/mine',
    quote: '/bookings/quote',
    confirm: (id: string) => `/bookings/${id}/confirm`,
    cancel: (id: string) => `/bookings/${id}/cancel`,
    /** FR-BKG-08 — the refund figure, computed server-side before confirming. */
    cancellationQuote: (id: string) => `/bookings/${id}/cancellation-quote`,
    /** Free windows offered when the chosen one was taken during payment. */
    alternatives: (id: string) => `/bookings/${id}/alternative-periods`,
    history: (id: string) => `/bookings/${id}/history`,
    contract: (id: string) => `/bookings/${id}/contract`,
    invoice: (id: string) => `/bookings/${id}/invoice`,
  },

  /** FR-PAY */
  payments: {
    createIntent: (bookingId: string) => `/bookings/${bookingId}/payment-intent`,
    status: (bookingId: string) => `/bookings/${bookingId}/payment`,
    tracking: '/admin/payments',
    refunds: '/admin/refunds',
    payouts: '/admin/payouts',
    payoutById: (id: string) => `/admin/payouts/${id}`,
    executePayout: (id: string) => `/admin/payouts/${id}/execute`,
    reschedulePayout: (id: string) => `/admin/payouts/${id}/reschedule`,
    /** The unmasked IBAN, fetched only when the operator asks — it is logged. */
    payoutBankDetails: (id: string) => `/admin/payouts/${id}/bank-details`,
    demandBankDetails: (lessorId: string) => `/admin/lessors/${lessorId}/bank-details-demand`,
    ledger: '/admin/ledger',
  },

  /** FR-ADM */
  admin: {
    dashboard: '/admin/dashboard',

    users: '/admin/users',
    userById: (id: string) => `/admin/users/${id}`,
    setUserStatus: (id: string) => `/admin/users/${id}/status`,

    pendingUnits: '/admin/units/pending',
    unitReviewById: (id: string) => `/admin/units/${id}/review-detail`,
    approveUnit: (id: string) => `/admin/units/${id}/approve`,
    rejectUnit: (id: string) => `/admin/units/${id}/reject`,

    pendingBookings: '/admin/bookings/pending',
    bookingReviewById: (id: string) => `/admin/bookings/${id}/review-detail`,
    approveBooking: (id: string) => `/admin/bookings/${id}/approve`,
    rejectBooking: (id: string) => `/admin/bookings/${id}/reject`,

    settings: '/admin/settings',
    commissionExceptions: '/admin/settings/commission-exceptions',
    commissionExceptionById: (id: string) => `/admin/settings/commission-exceptions/${id}`,

    auditLog: '/admin/audit-log',
    auditEntryById: (id: string) => `/admin/audit-log/${id}`,

    disputes: '/admin/disputes',
    disputeById: (id: string) => `/admin/disputes/${id}`,
    resolveDispute: (id: string) => `/admin/disputes/${id}/resolve`,

    /** FR-ADM-05 — one endpoint per list kind, so ordering stays per list. */
    referenceList: (kind: string) => `/admin/reference/${kind}`,
    referenceItem: (kind: string, id: string) => `/admin/reference/${kind}/${id}`,
    referenceOrder: (kind: string) => `/admin/reference/${kind}/order`,

    /** FR-CMS-01 */
    cmsPages: '/admin/cms/pages',
    cmsPageBySlug: (slug: string) => `/admin/cms/pages/${slug}`,

    /** FR-ADM-07 */
    termsVersions: '/admin/terms',
    termsVersionById: (id: string) => `/admin/terms/${id}`,
    publishTermsVersion: (id: string) => `/admin/terms/${id}/publish`,
    archiveTermsVersion: (id: string) => `/admin/terms/${id}/archive`,
    termsApprovals: (id: string) => `/admin/terms/${id}/approvals`,
  },

  /**
   * FR-RPT — the four reports, each with its own shape.
   *
   * Under `/admin` because every one of them aggregates across lessors: a
   * lessor's own figures come from `lessor.earnings`, which is scoped to them.
   */
  reports: {
    bookings: '/admin/reports/bookings',
    revenue: '/admin/reports/revenue',
    payouts: '/admin/reports/payouts',
    occupancy: '/admin/reports/occupancy',
    export: (kind: string) => `/admin/reports/${kind}/export`,
  },

  /** Reference data — FR-ADM-05 */
  reference: {
    categories: '/reference/categories',
    cities: '/reference/cities',
    districts: (cityId: string) => `/reference/cities/${cityId}/districts`,
    prohibitedItems: '/reference/prohibited-items',
    banks: '/reference/banks',
  },

  /** FR-NTF */
  notifications: {
    base: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    unreadCount: '/notifications/unread-count',
  },

  /** FR-CMS */
  content: {
    pageBySlug: (slug: string) => `/content/pages/${slug}`,
    faq: '/content/pages/faq',
    activeTerms: '/content/terms/active',
    contact: '/content/contact',
  },

  files: {
    upload: '/files/upload',
  },
} as const;
