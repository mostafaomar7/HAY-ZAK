/**
 * Every backend route in one place, grouped by SRS module. Paths are relative —
 * ApiService prefixes them with environment.apiUrl.
 *
 * These mirror the FR modules of SRS §4. Confirm against the OpenAPI spec
 * (NFR-SCL-03) once the Technical Design Document lands.
 */
/**
 * The four reference lists, spelled the way their routes are. Declared here
 * rather than imported: this file deliberately has no dependencies, so a
 * constant can never be the reason a module cycle appears.
 */
export type ReferenceKind = 'categories' | 'cities' | 'districts' | 'prohibited-items';

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

    /**
     * The second step of a login that answered `twoFactorRequired`.
     *
     * The `challengeToken` it takes opens nothing on its own — it carries its
     * own type and audience, and the API rejects it as a bearer. That is why
     * the login response is branched on `twoFactorRequired` rather than on
     * whether `tokens` came back.
     */
    twoFactorVerify: '/auth/2fa/verify',

    /**
     * The token out of the emailed link. **A `POST`, and the link goes to the
     * web app rather than here** — corporate mail scanners open every link in a
     * message before the recipient does, and a `GET` verification link would be
     * spent by the scanner. So the link opens a page and the page posts.
     */
    verifyEmail: '/auth/verify-email',

    // ── Not shipped yet; the screens that call them are behind these names.
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
    /**
     * `{ imageIds }` — **every** image on the unit, each exactly once.
     *
     * A partial list is a 422 rather than a move of the ids that were sent:
     * "put these two first" and "these are all the images" cannot both be read
     * off the same array, so the endpoint only accepts the unambiguous one.
     * Answers with the images in their new order, like the upload does.
     *
     * The first image is the cover, and the cover is what the search results
     * and "حجوزاتي" show — which is why ordering is a listing control rather
     * than a nicety.
     */
    unitImageOrder: (id: string) => `/lessor/units/${id}/images/order`,
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
   * FR-BKG, FR-PAY — the booking journey, scoped to the party reading it.
   *
   * Two endpoints answer the same object and the difference is deliberate: the
   * lessor's `price` carries the commission and their net, and the renter's
   * does not. Neither list is reachable by the other role — a lessor asking
   * for `/renter/bookings` gets a 403, not an empty page.
   *
   * There is **one** create. It takes the dates, the goods description and the
   * acknowledgement together and comes back holding the dates for fifteen
   * minutes; there is no draft to build up across steps and no separate
   * confirm. Payment is what confirms — no approval sits between them, so
   * there is no approve or reject here for anyone, and no cancel: a problem
   * with a booking is a complaint an administrator resolves.
   */
  bookings: {
    /** POST creates and holds; GET lists the renter's own. */
    mine: '/renter/bookings',
    byId: (id: string) => `/renter/bookings/${id}`,
    /**
     * `{ returnUrl }` → `{ redirectUrl }`.
     *
     * Send the browser to `redirectUrl` — the whole browser. 3-D Secure does
     * not run inside an iframe, and a fetch cannot carry a challenge.
     * `returnUrl` must be on this application's own origin or it is a 422; an
     * open return is a phishing tool. Safe to call twice: the same charge
     * comes back rather than a second one.
     */
    pay: (id: string) => `/renter/bookings/${id}/pay`,
    /**
     * The ZATCA tax invoice, once the booking is CONFIRMED.
     *
     * A 404 `INVOICE_NOT_FOUND` before payment — that is the screen's "not
     * issued yet" state, not a failure. JSON only: asking for
     * `Accept: application/pdf` returns the same object, so there is nothing to
     * download.
     */
    invoice: (id: string) => `/renter/bookings/${id}/invoice`,
    /** Read-only. The lessor's own bookings, with the commission on them. */
    forLessor: '/lessor/bookings',
    forLessorById: (id: string) => `/lessor/bookings/${id}`,

    // ── Not shipped yet; the screens that call them are behind these names.
    history: (id: string) => `/bookings/${id}/history`,
    contract: (id: string) => `/bookings/${id}/contract`,
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
    /**
     * Takes a published listing off the market, and puts it back.
     *
     * Both answer with the unit, so the row refreshes from the response rather
     * than from a re-read that could disagree with what just happened.
     */
    suspendUnit: (id: string) => `/admin/units/${id}/suspend`,
    reinstateUnit: (id: string) => `/admin/units/${id}/reinstate`,

    // ── Not shipped yet.
    dashboard: '/admin/dashboard',

    /**
     * FR-ADM-04. `role` and `adminRole` are **separate** parameters, and
     * `search` covers the name, the mobile and the email — not the national
     * id, which is encrypted and cannot be searched by part of it.
     */
    users: '/admin/users',
    /** Carries an `activity` block: what suspending this account would break. */
    userById: (id: string) => `/admin/users/${id}`,
    /**
     * `{ reason, force? }`. Refused with 409
     * `ADMIN_USER_HAS_ACTIVE_BOOKINGS` and `meta.liveBookings` while the
     * account has live bookings; `force: true` is the confirmed second attempt.
     *
     * Every session the account holds is revoked immediately.
     *
     * There is deliberately no way to suspend another administrator
     * (`ADMIN_CANNOT_SUSPEND_ADMIN`) or yourself (`ADMIN_CANNOT_ACT_ON_SELF`).
     */
    suspendUser: (id: string) => `/admin/users/${id}/suspend`,
    /** `{ reason }`. */
    activateUser: (id: string) => `/admin/users/${id}/activate`,
    /**
     * FR-ADM-04 — creates an administrator. `admins:manage`.
     *
     * `{ fullName, mobile, adminRole, email? }` and **nothing else**. There is
     * no password field in either direction: the account is created without one
     * and the new administrator sets theirs through the existing reset flow, so
     * the credential is never known by two people. A `password` sent anyway is
     * stripped in silence by the mass-assignment guard rather than refused —
     * so a client that sent one would look like it had worked.
     *
     * The response carries `{ user, activation }`. `activation` is the sentence
     * to read out to the new administrator, in both languages, from the server:
     * the account has no password and they must use "forgot password" with the
     * mobile shown. Render it rather than writing our own — the day the flow
     * changes, the instruction changes with it.
     *
     * `mobile` comes back normalised to `+966…` and `mobileVerifiedAt` is null,
     * so the first sign-in still goes through the OTP.
     */
    createAdmin: '/admin/users/admins',
    /**
     * `{ adminRole, reason }` — a `PUT`, and `admins:manage` alone, so only the
     * system administrator reaches it. Both fields are required.
     *
     * Answers `{ user }` **without the `activity` block** that `GET
     * /admin/users/:id` carries, so a screen that replaces its detail with this
     * response loses the five counts. Merge rather than replace.
     *
     * Setting the role the account already holds is a 409
     * `ADMIN_USER_ALREADY_IN_STATE` — which is why the current role is not
     * offered in the picker rather than being offered and refused.
     *
     * There is deliberately no companion that *creates* an administrator: no
     * route exists for it, so today the first account of a new operator is made
     * in the database. Raised with the backend.
     */
    changeAdminRole: (id: string) => `/admin/users/${id}/admin-role`,
    /** `{ approve, reason? }` — the reason is required to reject. */
    reviewUserIdentity: (id: string) => `/admin/users/${id}/identity`,

    // No route edits a user's name, mobile or email, on purpose: an
    // administrator changing somebody's phone number is the shape of an
    // account takeover. Nothing on this side should offer the control.

    /**
     * FR-PAY-09 — every tax document the platform has issued, both kinds.
     *
     * `?from=&to=&type=&page=&pageSize=` and nothing else; an unknown query
     * parameter is a 422. Any administrator may read it — operations, finance
     * and the system administrator all answer 200, which is why it is guarded
     * on `reports:view` like payment tracking rather than on a money permission.
     *
     * A row carries the invoice, its type and its booking — but **not who it
     * was issued to**, so the register is searchable by booking reference and
     * not by person. Raised with the backend.
     */
    invoices: '/admin/invoices',

    unitReviewById: (id: string) => `/admin/units/${id}/review-detail`,

    bookingReviewById: (id: string) => `/admin/bookings/${id}/review-detail`,

    /**
     * `?group=general|financial|booking|operations|content`.
     *
     * Reading is open to any administrator; **writing depends on the group** —
     * `financial` needs `settings:financial` and everything else needs
     * `settings:manage`, so the two are not interchangeable and neither is a
     * superset. The group is on each row; it cannot be read off the URL.
     */
    settings: '/admin/settings',
    /**
     * `{ value }` — **always a string**, whatever the setting's type.
     * `"1500"` and `"true"`, never `1500` or `true`; the server parses and
     * refuses with a 422 if it will not convert.
     */
    settingByKey: (key: string) => `/admin/settings/${key}`,

    /**
     * FR-ADM-09 — `audit:view`, the system administrator's alone, because it
     * records what every administrator did including whoever is reading it.
     *
     * `?action=&entityType=&entityId=&actorUserId=&from=&to=&page=`, with
     * `from`/`to` as plain `YYYY-MM-DD` and `to` inclusive of its whole day.
     *
     * There is no bulk export, deliberately. Ask before building one.
     */
    auditLog: '/admin/audit',
    /** The `action` values actually present, for the filter. */
    auditActions: '/admin/audit/actions',

    /**
     * FR-ADM-08 — the complaints queue, and the only exception path in the
     * product. Ordered by `slaDueAt`, most overdue first; `?overdue=true`
     * narrows it to the ones already past it.
     *
     * `complaints:manage` — the system administrator and the operations
     * supervisor. The finance officer is refused the queue outright.
     */
    complaints: '/admin/complaints',
    complaintById: (id: string) => `/admin/complaints/${id}`,
    /** **multipart/form-data**, with `isInternal` as the string `"true"`. */
    complaintMessages: (id: string) => `/admin/complaints/${id}/messages`,
    assignComplaint: (id: string) => `/admin/complaints/${id}/assign`,
    /**
     * Ends it with a decision. **Final** — a second attempt is a 409.
     *
     * A resolution that moves money needs `refunds:issue` on top of
     * `complaints:manage`, so an operations supervisor can cancel a booking
     * and suspend a listing but cannot refund a halala.
     */
    resolveComplaint: (id: string) => `/admin/complaints/${id}/resolve`,
    /** Ends it without one — a duplicate, or somebody withdrew it. */
    closeComplaint: (id: string) => `/admin/complaints/${id}/close`,
    /**
     * Lifts a `PAYOUT_HOLD`. On the **complaint**, not the booking, and not
     * automatic when a case closes: closing a case and releasing the money are
     * two judgements, and a case may close precisely because the money is still
     * disputed.
     *
     * Needs `complaints:manage` rather than `payouts:approve` — releasing moves
     * nothing, it only makes the booking eligible again, and finance still has
     * to approve the run.
     */
    releasePayout: (id: string) => `/admin/complaints/${id}/release-payout`,

    /** FR-ADM-05 — one endpoint per list kind, so ordering stays per list. */
    /**
     * FR-ADM-05 — every list at once, active and inactive alike.
     *
     * **Nothing is ever deleted.** Entries are deactivated (`isActive: false`),
     * and a category with published listings under it refuses even that: 409
     * `CATEGORY_IN_USE` with `meta.requested` — the count worth putting on
     * screen instead of the word "failed".
     */
    reference: '/admin/reference',
    referenceKind: (kind: ReferenceKind) => `/admin/reference/${kind}`,
    referenceItem: (kind: ReferenceKind, id: string) => `/admin/reference/${kind}/${id}`,

    /** FR-CMS-01 */
    /** FR-CMS-01. `POST` needs every field; `PUT` is a partial. */
    cmsPages: '/admin/cms/pages',
    /**
     * By **id**, not by slug — the slug is editable, and a route keyed on an
     * editable field renames itself when somebody fixes a typo.
     *
     * A duplicate slug is 409 `CMS_SLUG_TAKEN`; a slug with a space is a 422.
     */
    cmsPageById: (id: string) => `/admin/cms/pages/${id}`,

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
    /**
     * The platform as it stands — **no date filter, on purpose**. "42 listings
     * published in March" is not a sentence that means anything; these are
     * counts of what exists now.
     *
     * Every bucket carries every key, zeros included, so nothing here needs a
     * `?? 0` that would hide a missing block.
     */
    overview: '/admin/reports/overview',
    /**
     * `?from=&to=` — plain `YYYY-MM-DD`, independent, both optional. A
     * malformed date is a 422 rather than a filter quietly ignored.
     *
     * Answers `grossHalalas`: **what renters paid, which is not revenue.**
     */
    bookings: '/admin/reports/bookings',
    /**
     * The actual revenue — `commissionHalalas`, net of refunds — beside the
     * money the platform is only holding. Labelling `grossHalalas` as revenue
     * overstates it by the value of every booking, which is the classic
     * marketplace accounting error.
     */
    revenue: '/admin/reports/revenue',
    /** Per-lessor totals, paged. */
    lessors: '/admin/reports/lessors',
  },

  // There is no `reference: { … }` group. Those five paths all answered 404 and
  // duplicated `public.*`, which is shipped and is what the screens read. The
  // bank list in particular is not owed by anyone: the API resolves the bank
  // from the IBAN and ignores any `bankName` sent, so there is no bank to
  // choose. Deleted rather than left named, so this file stays a list of routes
  // that exist.

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

    /**
     * Complaints — the renter's and the lessor's, on the same routes.
     *
     * This is the whole exception path: there is no cancel, no self-service
     * refund, and no editing a paid booking. `POST` is **multipart/form-data**
     * and refuses JSON even with nothing attached.
     *
     * A second complaint on a booking that already has an open one is a 409
     * carrying `meta.complaintId` — which is a link to offer, not an error to
     * print.
     */
    complaints: '/me/complaints',
    complaintById: (id: string) => `/me/complaints/${id}`,
    /** **multipart/form-data**. Empty body with no files is a 422. */
    complaintMessages: (id: string) => `/me/complaints/${id}/messages`,

    /**
     * TOTP through an authenticator app — **not SMS**, which is exactly what a
     * SIM-swap takes over.
     *
     * `setup` enables nothing: the secret stays provisional until a code proves
     * the user actually stored it, so nobody locks themselves out of an account
     * with a secret they never saved. `disable` takes the password **and** a
     * code together, because either alone is a case this protects against — a
     * stolen phone, or a stolen password.
     */
    twoFactor: '/me/2fa',
    twoFactorSetup: '/me/2fa/setup',
    twoFactorEnable: '/me/2fa/enable',
    twoFactorDisable: '/me/2fa/disable',
    /**
     * A fresh set of ten, invalidating every old one in the same transaction.
     *
     * Takes the same proof as `disable` — the password **and** a current TOTP
     * code. A recovery code is deliberately **not** accepted: somebody down to
     * their last one could otherwise spend it to mint ten more, and a set that
     * is supposed to run out never would.
     */
    twoFactorRecoveryCodes: '/me/2fa/recovery-codes',

    /** 60-second cooldown; a second call inside it is a 429. */
    sendEmailVerification: '/me/email/send-verification',

    /**
     * Every tax document **addressed to this user** — not "the bookings I am
     * on". The same person lets a space and rents one, so the list mixes the
     * booking invoice they were charged and the commission invoice they were
     * billed. Render `type`, or two rows show different totals for one booking
     * with no stated reason.
     *
     * `?page=&pageSize=` only — **no `type` filter here**, unlike the
     * administrator's register. So the list is not filtered at all: filtering
     * the page in hand would narrow a page rather than the set, and label a
     * partial answer as a complete one.
     */
    invoices: '/me/invoices',
    invoiceById: (id: string) => `/me/invoices/${id}`,
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
    /** Published pages only — the footer and the menu read this. */
    pages: '/public/pages',
    /**
     * One page. An unpublished slug answers **404, not 403**: anybody who can
     * tell "exists but hidden" from "does not exist" can learn what is being
     * drafted.
     */
    pageBySlug: (slug: string) => `/public/pages/${slug}`,
    /**
     * The public settings, already converted to their real types — numbers
     * arrive as numbers here, unlike the administrator's string-valued view.
     * Read this instead of hard-coding a page size or a hold length.
     */
    settings: '/public/settings',

    // ── Not shipped; the screens that call them are behind these names.
    activeTerms: '/content/terms/active',
    contact: '/content/contact',
  },

  files: {
    upload: '/files/upload',
  },
} as const;
