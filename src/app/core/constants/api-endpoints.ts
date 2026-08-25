/**
 * Every backend route in one place, grouped by SRS module. Paths are relative —
 * ApiService prefixes them with environment.apiUrl.
 *
 * These mirror the FR modules of SRS §4. Confirm against the OpenAPI spec
 * (NFR-SCL-03) once the Technical Design Document lands.
 */
export const API_ENDPOINTS = {
  /**
   * FR-AUTH — the eleven the backend has shipped, verified against the running
   * server rather than transcribed from the guide.
   *
   * Three of them have no obvious shape and are worth stating:
   * `register` returns no tokens (they are minted at `verifyMobile`),
   * `resetPassword` returns no tokens either (every session is revoked, so the
   * user signs in again), and `logout` takes the refresh token rather than a
   * bearer — by the time somebody signs out the access token is usually dead.
   */
  auth: {
    /** The version whose `id` must come back on register. */
    terms: '/auth/terms',
    register: '/auth/register',
    /** The only endpoint that mints the first pair of tokens. */
    verifyMobile: '/auth/verify-mobile',
    resendOtp: '/auth/resend-otp',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    me: '/auth/me',

    // ── Not shipped yet; the screens that call them are behind these names.
    verifyEmail: '/auth/email/verify',
    changePassword: '/auth/password/change',
    /** RNT-09 — starts a Nafath session and polls its outcome. */
    nafathStart: '/auth/identity/nafath',
    nafathStatus: (requestId: string) => `/auth/identity/nafath/${requestId}`,
  },

  /** Open reference data — no token, and both language columns on every row. */
  public: {
    categories: '/public/categories',
    cities: '/public/cities',
    prohibitedItems: '/public/prohibited-items',
  },

  /** The renter's own account — FR-AUTH, FR-NTF. */
  account: {
    profile: '/account/profile',
    identity: '/account/identity',
    notificationPreferences: '/account/notification-preferences',
    delete: '/account',
  },

  /**
   * FR-LSR. The units journey is shipped and verified against the server; the
   * rest of this group is not, and a call to one answers 404.
   *
   * Note what is **not** here. There is no `DELETE /lessor/units/:id` — a unit
   * is archived, never deleted, because bookings reference it. There is no
   * separate availability endpoint either: the calendar arrives inside the
   * unit's detail, so reading it is one request rather than two.
   */
  lessor: {
    units: '/lessor/units',
    unitById: (id: string) => `/lessor/units/${id}`,
    /** Multipart, field name `images`, several files per call. */
    unitImages: (id: string) => `/lessor/units/${id}/images`,
    unitImageById: (unitId: string, imageId: string) => `/lessor/units/${unitId}/images/${imageId}`,
    /** Draft or rejected to PENDING_REVIEW. Refused under two images. */
    submitUnit: (id: string) => `/lessor/units/${id}/submit`,
    archiveUnit: (id: string) => `/lessor/units/${id}/archive`,
    /** Manual date blocks. Plain dates, half-open. */
    unitBlocks: (id: string) => `/lessor/units/${id}/blocks`,
    unitBlockById: (unitId: string, blockId: string) => `/lessor/units/${unitId}/blocks/${blockId}`,

    // ── Not shipped yet; the screens that call them are behind these names.
    dashboard: '/lessor/dashboard',
    bookingRequests: '/lessor/booking-requests',
    earnings: '/lessor/earnings',
    earningsTable: '/lessor/earnings/rows',
    earningsStatement: '/lessor/earnings/statement',
    bankAccounts: '/lessor/bank-accounts',
    bankAccountById: (id: string) => `/lessor/bank-accounts/${id}`,
    requestUnitSuspension: (id: string) => `/lessor/units/${id}/suspension-request`,
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
    /**
     * The one route out of a problem with a booking.
     *
     * Neither party can cancel — a complaint is raised against the booking and
     * an administrator resolves it, which is the only path to CANCELLED. See
     * `booking-transitions.ts`.
     */
    complaints: (id: string) => `/bookings/${id}/complaints`,
    quote: '/bookings/quote',
    confirm: (id: string) => `/bookings/${id}/confirm`,
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

  /**
   * FR-ADM. Only the unit review is shipped; everything below it answers 404.
   *
   * There is no `/admin/units/pending`: `pending` would be read as a unit
   * identifier and answer 422. The queue is `/admin/units?status=PENDING_REVIEW`
   * — one endpoint, filtered, which is also how the other statuses are reached.
   */
  admin: {
    units: '/admin/units',
    unitById: (id: string) => `/admin/units/${id}`,
    approveUnit: (id: string) => `/admin/units/${id}/approve`,
    /** `reason` is required — a rejection with no reason is refused. */
    rejectUnit: (id: string) => `/admin/units/${id}/reject`,

    // ── Not shipped yet.
    dashboard: '/admin/dashboard',

    users: '/admin/users',
    userById: (id: string) => `/admin/users/${id}`,
    setUserStatus: (id: string) => `/admin/users/${id}/status`,

    unitReviewById: (id: string) => `/admin/units/${id}/review-detail`,

    bookingReviewById: (id: string) => `/admin/bookings/${id}/review-detail`,

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

  /**
   * The signed-in account itself.
   *
   * `GET /me` is the profile; `GET /me/notifications` answers with the rows and
   * `unreadCount` **together**, so the badge updates from the same response
   * that fills the list. There is deliberately no `unread-count` endpoint to
   * poll, and asking for one would be asking for two answers that disagree.
   */
  me: {
    profile: '/me',
    notifications: '/me/notifications',
  },

  /** FR-NTF — not shipped; see `me.notifications` for what exists. */
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
