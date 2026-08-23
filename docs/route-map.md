# Route map

Routing tree for HAY-ZAK, derived from SRS §4 (functional modules) and §5
(permission matrix).

The public, renter, lessor and administration sections are all built. Rows
marked **built** exist today; the rest are planned.

`Permission` values come from [permissions.ts](../src/app/core/constants/permissions.ts).

## Public — no authentication (FR-MKT-02)

Everything below sits inside the public shell (`layout/public/public.routes.ts`),
which carries the header and footer across the whole renter journey.

| Path | Screen | Guard | |
| --- | --- | --- | --- |
| `/` | Landing page (FR-MKT-01) | — | built |
| `/units` | Marketplace search + filters | — | built |
| `/units/:id` | Unit detail page | — | built |
| `/pages/:slug` | CMS static pages (FR-CMS-01) | — | built |
| `/auth/login` | Login | `guestGuard` | built |
| `/auth/account-type` | Choose renter or lessor (FR-AUTH-12) | `guestGuard` | built |
| `/auth/register/:role` | Registration for the chosen role | `guestGuard` | built |
| `/auth/verify` | Mobile OTP (FR-AUTH-04) | — | built |
| `/auth/forgot-password`, `/auth/reset-password` | Password reset | `guestGuard` | built |

## Renter

The wizard keys off the unit for step one and off the booking the server created
for every step after it, so the first segment is spelled out rather than
overloading one `:id` parameter.

| Path | Screen | Guard | |
| --- | --- | --- | --- |
| `/booking/new/:unitId` | Step 1 — dates and duration | `permissionGuard([CreateBooking])` | built |
| `/booking/:id/goods` | Step 2 — goods and prohibited-items acknowledgement | `permissionGuard([CreateBooking])` | built |
| `/booking/:id/identity` | Step 3 — Nafath verification; skipped when already verified | `permissionGuard([CreateBooking])` | built |
| `/booking/:id/pay` | Step 4 — price breakdown, gateway handoff, 15-minute hold | `permissionGuard([CreateBooking])` | built |
| `/booking/:id/result` | Paid, declined, taken, or expired | `permissionGuard([CreateBooking])` | built |
| `/my-bookings` | My bookings, current and past (FR-BKG-07) | `permissionGuard([CreateBooking])` | built |
| `/my-bookings/:id` | Booking detail, stage trail, address once approved | `permissionGuard([CreateBooking])` | built |
| `/my-bookings/:id/invoice` | ZATCA tax invoice (FR-PAY-09) | `permissionGuard([CreateBooking])` | built |
| `/my-bookings/:id/cancel` | Refund quote and confirmation (FR-BKG-08) | `permissionGuard([CreateBooking])` | built |
| `/account` | Profile, verification, password, preferences | `authGuard` | built |
| `/account/notifications` | Notification inbox (FR-NTF) | `authGuard` | built |

`/account` uses `authGuard` rather than the permission guard: it is the account
screen for whoever is signed in, and gating it on a renter permission would lock
a lessor out of their own details.

> SRS §3 item 7 records a direct conflict here: the meeting said the renter needs
> no dashboard, the presentation shows one. The SRS recommends including a
> simplified "My bookings" in Phase 1 — treated as in-scope until the client
> decides (§15 item 12).

## Lessor

| Path | Screen | Guard |
| --- | --- | --- |
| `/lessor` | Dashboard (FR-LSR-01) | `permissionGuard([ManageOwnUnits])` |
| `/lessor/units` | My spaces | `permissionGuard([ManageOwnUnits])` |
| `/lessor/units/new` | Add a space — **max three steps** (SRS §2.2) | `permissionGuard([ManageOwnUnits])` |
| `/lessor/units/:id/edit` | Edit / archive | `permissionGuard([ManageOwnUnits])` |
| `/lessor/requests` | Incoming bookings — view only (FR-LSR-06) | `permissionGuard([ViewIncomingBookings])` |
| `/lessor/earnings` | Earnings + transfer status | `permissionGuard([ViewOwnFinancialReports])` |
| `/lessor/bank-account` | IBAN details (FR-LSR-02) | `permissionGuard([ManageBankDetails])` |

> FR-LSR-03: publishing the first listing is blocked until bank details are
> complete and the mobile number is verified. That is a route-level resolver
> concern, not a form validation one.

## Administration

The console has its own entrance and its own shell
(`layout/admin/admin-shell.ts`). Paths follow the design's own vocabulary rather
than the SRS module names, which is why a few differ from the earlier plan —
`/admin/listings` not `/admin/units`, `/admin/transfers` not `/admin/payouts`.

| Path | Screen | Guard | |
| --- | --- | --- | --- |
| `/admin/login` | Administration sign-in, separate from `/auth/login` | `guestGuard` | **built** |
| `/admin/dashboard` | KPI dashboard + the two live queues (FR-ADM-01) | `permissionGuard([ViewAllFinancialReports])` | **built** |
| `/admin/listings` | Listing review queue (FR-UNT-06) | `permissionGuard([ReviewUnit])` | **built** |
| `/admin/bookings` | Booking review queue, oldest first (UC-03) | `permissionGuard([ReviewBooking])` | **built** |
| `/admin/complaints` | Disputes centre (FR-ADM-08, FR-ADM-11) | `permissionGuard([ResolveDisputes])` | **built** |
| `/admin/payments` | Payment tracking (FR-PAY-05, FR-PAY-08) | `permissionGuard([ViewAllFinancialReports])` | **built** |
| `/admin/transfers` | Payout execution (FR-PAY-06, UC-04) | `permissionGuard([ExecutePayouts])` | **built** |
| `/admin/reports` | The four reports + export (FR-RPT) | `permissionGuard([ViewAllFinancialReports])` | **built** |
| `/admin/financial-settings` | Commission, VAT, cycle, refund policy, auto-approval | `permissionGuard([ConfigureFinancials])` | **built** |
| `/admin/users` | User administration (FR-ADM-04) | `permissionGuard([ManageUsers])` | **built** |
| `/admin/reference-lists` | Categories, cities, districts, prohibited items | `permissionGuard([ManageReferenceData])` | **built** |
| `/admin/content` | The seven static pages (FR-CMS-01) | `permissionGuard([ManageCmsAndTerms])` | **built** |
| `/admin/terms` | Legal versions and their acceptances (FR-ADM-07) | `permissionGuard([ManageCmsAndTerms])` | **built** |
| `/admin/audit` | Audit trail, read-only (FR-ADM-09) | `permissionGuard([ViewAuditTrail])` | **built** |
| `/admin/library` | The six unified components, in every state | `permissionGuard([ManageCmsAndTerms])` | **built** |

> The second factor is mandatory here (design: "مصادقة ثنائية إلزامية"), so
> `/admin/login` always continues to `/auth/verify` before the console opens.

## System

| Path | Screen |
| --- | --- |
| `/forbidden` | 403 — where `permissionGuard` redirects |
| `/**` | 404 |

## Layout shells

- `layout/public/` — header with language switch (FR-CMS-02), footer, no sidebar
- `layout/dashboard/` — lessor and renter shell
- `layout/admin/` — the operations console: teal rail, permission-filtered nav,
  idle-session warning and logout confirmation
