# Operations console — implementation record

Source: Claude Design project `4497b924`, saved here as `admin-dashboard.html`.
Fifteen screens: three security screens, eleven operational ones, and the
component gallery.

## The three roles

The client named them: **مدير النظام**, **مشرف العمليات**, **المسؤول المالي**.
They already existed in `UserRole` as `SystemAdministrator`,
`OperationsSupervisor` and `FinanceOfficer`, with their capabilities set out in
`ROLE_PERMISSIONS` (SRS §5).

The design tags each nav entry with the roles that may see it. `ADMIN_NAV` tags
each entry with the **permission** instead, and the sidebar filters on that. It
resolves to the same three roles today, but it keeps one source of truth: the
route guard and the link that reaches it are derived from the same table, and a
fourth role later needs no edit to the navigation.

`admin.routing.spec.ts` signs in as each role and checks both halves — that the
screens open, and that a screen a role cannot open is not linked to.

## The six unified components

The design's "الدفعة الأولى — المكوّنات الموحّدة الستة", built once in
`features/admin/components/` and reused across all eleven screens.

| #   | Design name              | Component                                      |
| --- | ------------------------ | ---------------------------------------------- |
| 1   | بطاقة المؤشر             | `AdminKpiCard`                                 |
| 2   | شارة الحالة              | `UiBadge` (shared, already had the five tones) |
| 3   | شريط الفلاتر             | `AdminFilterBar`                               |
| 4   | جدول الإدارة             | `AdminTable`                                   |
| 5   | اللوحة الجانبية المنزلقة | `AdminPanel`                                   |
| 6   | نافذة السبب الإلزامي     | `AdminReasonModal`                             |

Two more the reports needed: `AdminBarChart` and `AdminMeter`.

## The fifteen screens

| Design screen | Route                       | Component                                                      |
| ------------- | --------------------------- | -------------------------------------------------------------- |
| `login`       | `/admin/login`              | `AdminLoginPage`                                               |
| `otp`         | `/auth/verify`              | `OtpPage` (shared with the other portals)                      |
| `dashboard`   | `/admin/dashboard`          | `AdminDashboardPage`                                           |
| `listings`    | `/admin/listings`           | `AdminListingsPage`                                            |
| `bookings`    | `/admin/bookings`           | `AdminBookingsPage`                                            |
| `complaints`  | `/admin/complaints`         | `AdminComplaintsPage`                                          |
| `payments`    | `/admin/payments`           | `AdminPaymentsPage`                                            |
| `transfers`   | `/admin/transfers`          | `AdminTransfersPage`                                           |
| `reports`     | `/admin/reports`            | `AdminReportsPage` (four tabs)                                 |
| `finSettings` | `/admin/financial-settings` | `AdminFinancialSettingsPage`                                   |
| `users`       | `/admin/users`              | `AdminUsersPage`                                               |
| `refLists`    | `/admin/reference-lists`    | `AdminReferenceListsPage`                                      |
| `content`     | `/admin/content`            | `AdminContentPage`                                             |
| `terms`       | `/admin/terms`              | `AdminTermsPage`                                               |
| `audit`       | `/admin/audit`              | `AdminAuditPage`                                               |
| `library`     | `/admin/library`            | `AdminLibraryPage`                                             |
| `stub`        | —                           | not built: it is the design's placeholder for screens now real |

## Decisions worth knowing

**The table's state switch is not a product control.** The prototype puts a
بيانات/تحميل/فارغ/خطأ switch above every table so a reviewer can see all four
states. Shipping it would let an operator put a live table into a fake error
state. `AdminTable.state` is driven by the service; the switch exists only on
the component-library page, where flipping it is the point.

**Approve takes no argument; reject requires a reason.** `AdminReviewService`
has no `decide(approved, reason?)`, because that shape lets a rejection through
with nothing attached. The reason is a code from a closed list
(`RejectionReasonCode`), not free text — the code is what the audit trail groups
by, what picks the notification template, and what a "why are we rejecting so
much" report can count. The note travels with it and is _required_ when the
reason chosen was "سبب آخر", because that label promises an explanation.

**Rejecting a booking states the refund in figures first.** It is irreversible
and it moves money, so `AdminReasonModal` prints the amount above the button
rather than confirming afterwards. On a bulk rejection it prints the sum.

**Bulk actions are one request per row.** Each decision is its own audit entry
and its own notification, and a partial failure must leave the rows it did reach
decided.

**Four payout states, four different actions, no default.** A due row can be
executed, a failed one rescheduled, a frozen one only read, and one belonging to
a lessor with no bank details can only be chased. Offering "execute" on all four
is how a payment reaches an account nobody verified.

**The full IBAN is a separate request.** `bankDetails(payoutId)` is fetched only
when the operator presses "كشف". A payload that always carried the whole number
would be logged, cached and screenshotted with it (NFR-SEC-02), and the read is
itself an auditable event.

**Reordering uses buttons, not the design's drag handle.** Drag-and-drop is
unreachable by keyboard and unusable with a screen reader. The buttons do the
same job, are announced, and let one keystroke be undone by the opposite one.
The whole new order goes in a single call, so a reorder cannot land half-applied.

**The CMS editor is plain text.** The public pages render from a known set of
blocks; letting an operator paste arbitrary markup is how stored XSS reaches the
home page. "معاينة الصفحة" opens the real published route — the only honest
preview is the real template.

**The audit service has no update or delete.** FR-ADM-09 says the log is
append-only, and the absence of the method is the enforcement, not the
template's restraint.

**Projected table cells are styled globally.** A row's cells are declared in the
page's template and projected into `AdminTable`, so under emulated encapsulation
they carry the page's attribute and the table's stylesheet cannot reach them.
The alternatives were `::ng-deep` or forty lines copied into six stylesheets;
instead `styles/base/_admin-cells.scss` holds one documented vocabulary.

**The idle timeout is admin-only.** Thirty minutes, warned at twenty-eight
(`AdminSessionService`). A renter left on a listing page for half an hour has
lost nothing; an unattended operations console is an open door to every user
record on the platform. The ticker runs outside Angular's zone.

**The console has its own entrance.** `/admin/login` is separate from
`/auth/login`: email rather than mobile, an authenticator code rather than SMS,
and copy about session length and MFA that means nothing to a renter. Sign-out
returns there, and `AuthService.landingUrl()` now sends an admin role to
`/admin` — the same single definition that already routed lessors and renters.

## Working on it in development

The seeded development session is a lessor (see `core/mock/dev-session.ts`), so
`/admin` refuses it, exactly as it would in production. To get into the console,
open `/admin/login` and sign in as **operations@hayzak.com** with any password:
the mock returns `MOCK_ADMIN_USER` for that address and remembers it for the tab.

## Open questions

**1. The commission rate, again.** The console's fixtures use 5%, matching the
renter prototype and the design's own "العمولة 5%" column header;
`FINANCIAL_DEFAULTS.commissionRate` is 0.1. Nothing is hard-coded — the settings
screen writes it and `AdminSettingsStore` publishes it to every screen — but the
number the client settles on still has to reach the seed data. Same open item as
`renter-plan.md` #2, now visible in a third place.

**2. Category naming, again.** The reports filter in the design lists
**"مكان مكشوف"**; the lessor form says **"مساحة مفتوحة"**. The reference-lists
screen is where this is now maintained, so the fix is one row of seed data once
the wording is confirmed.

**3. What "بحث شامل" searches.** The topbar carries a global search box across
units, bookings and users. It is wired as an output rather than a route, because
what it should do differs per screen and a box that always jumped to one results
page would be wrong on eleven of the fourteen. A cross-entity search endpoint and
a results screen are not in the design; they need a decision before the box does
anything.

**4. Report export format.** `FR-RPT-05` and the design both offer Excel and PDF.
The client renders neither — it asks the server for the file and saves it, which
is the only way the totals in a spreadsheet can be guaranteed to match the totals
on screen. The endpoint shape is written down in `API_ENDPOINTS.reports.export`;
the file itself is the backend's to produce.
