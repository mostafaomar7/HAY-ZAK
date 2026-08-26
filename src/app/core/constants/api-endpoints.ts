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

  /**
   * Open reference data and the public catalogue — FR-MKT-02.
   *
   * No token on any of these, and no bearer even when one is to hand: a guest
   * and a signed-in visitor must get the same answer, so `SKIP_AUTH` is not an
   * optimisation here but part of the contract.
   *
   * `/public/cities` nests each city's districts, which is why there is no
   * districts route to call.
   */
  public: {
    categories: '/public/categories',
    cities: '/public/cities',
    prohibitedItems: '/public/prohibited-items',
    /** Search and filter. Every parameter is optional; a bare call lists. */
    units: '/public/units',
    /**
     * One space in full. Anything not published — draft, rejected, archived,
     * or an id that never existed — answers the same 404, so a caller cannot
     * tell them apart. Do not try to; that indistinguishability is deliberate.
     */
    unitById: (id: string) => `/public/units/${id}`,
  },

  /**
   * The renter's own account — FR-AUTH, FR-NTF.
   *
   * **Not shipped.** Every route here answers 404; the signed-in account lives
   * at `me.*` instead, which is shipped and is what these screens should be
   * moved onto once someone decides which of the two survives.
   */
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
    /** One request for the whole landing screen — counts, money and the badge. */
    dashboard: '/lessor/dashboard',
    /** The three money buckets, plus the rule that separates the first two. */
    earnings: '/lessor/earnings',
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
    bookingRequests: '/lessor/booking-requests',
    earningsTable: '/lessor/earnings/rows',
    earningsStatement: '/lessor/earnings/statement',
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

  /**
   * FR-MKT — the rest of the public catalogue, and shipped.
   *
   * Search and the details page live under `public.units`; these two hang off
   * a unit. `/marketplace/units` never existed and answers 404 — nothing
   * should point at it.
   */
  marketplace: {
    /**
     * FR-UNT-08 — the taken days, `?from=&to=` (plain dates, both optional).
     *
     * Half-open ranges, already merged, and no `reason` on any of them. The
     * `to` that comes back is the server's own — it has a 365-day ceiling — so
     * anything past it was never answered and must not be drawn as free.
     *
     * Not a substitute for the server's check: a clashing booking is still
     * refused at creation by a database constraint. This only decides whether
     * the date was offered.
     */
    unitAvailability: (id: string) => `/public/units/${id}/availability`,
    /**
     * The "مساحات مشابهة" rail, `?limit=` (1–12, default 6).
     *
     * `distanceMeters` is always null here, deliberately: both units sit behind
     * approximate circles, and a distance between two of them is a second
     * independent measurement of the same geometry. Enough pairs and the real
     * coordinates fall out. It orders the rail; it is never shown.
     */
    similarUnits: (id: string) => `/public/units/${id}/similar`,
  },

  /**
   * FR-BKG — **not shipped**, every route answers 404.
   *
   * This is the whole renter journey past the details page: the draft, the
   * quote, the payment, "حجوزاتي" and the complaint that is the only way out
   * of a booking. The wizard is built and points at these names.
   */
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
    /**
     * Money that is releasable but has no payout yet, one row per lessor.
     *
     * Not a payout status: a payout exists only once an operator approves one.
     * Each row carries `blocked` — `null`, or the reason it cannot be paid —
     * so the obstacle is visible before the button is pressed.
     */
    eligiblePayouts: '/admin/payouts/eligible',
    /** GET lists them; POST `{ lessorId }` approves one. */
    payouts: '/admin/payouts',
    payoutById: (id: string) => `/admin/payouts/${id}`,
    /** `{ bankReference }` — required; 422 without it. */
    markPayoutPaid: (id: string) => `/admin/payouts/${id}/paid`,
    /** `{ reason }` — required. */
    markPayoutFailed: (id: string) => `/admin/payouts/${id}/failed`,
    /** Back to APPROVED once whatever failed has been corrected. */
    retryPayout: (id: string) => `/admin/payouts/${id}/retry`,

    // ── Not shipped yet.
    tracking: '/admin/payments',
    refunds: '/admin/refunds',
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
    /**
     * FR-LSR-02. Several per account, and the API resolves the bank from the
     * IBAN — there is no bank to choose and any `bankName` sent is ignored.
     *
     * The full number is never returned, not even to its owner: `ibanLast4`
     * only, so there is no screen that could display it and no endpoint that
     * would give it up.
     */
    bankAccounts: '/me/bank-accounts',
    bankAccountById: (id: string) => `/me/bank-accounts/${id}`,
    /** Where the money goes. Worth a confirmation before it is called. */
    makeBankAccountDefault: (id: string) => `/me/bank-accounts/${id}/default`,

    notifications: '/me/notifications',
    /** Both answer with the fresh `unreadCount`, so the badge needs no refetch. */
    markNotificationRead: (id: string) => `/me/notifications/${id}/read`,
    markAllNotificationsRead: '/me/notifications/read-all',
  },

  /** FR-NTF — not shipped; see `me.notifications` for what exists. */
  notifications: {
    base: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    unreadCount: '/notifications/unread-count',
  },

  /**
   * FR-CMS — **not shipped**, every route answers 404.
   *
   * "كيف تعمل المنصة", the FAQ, the contact page and the policies are all
   * server-held documents (FR-CMS-01) so an operator can edit them without a
   * release. Until the module exists those four links in the header and footer
   * reach a page that cannot fill itself.
   */
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
