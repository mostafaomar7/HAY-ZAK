# Renter portal — implementation record

Source: Claude Design project `a62d7f34` (11 files), saved here as
`renter-interactive-prototype.html` and `renter-design-system.html`.

All seventeen prototype screens are built, plus the three the prototype refers
to but does not draw (account type, password recovery, password reset).

## Binding rules (design system §9)

These are constraints, not suggestions. Each maps to an SRS clause, and each has
a place in the code that enforces it.

| #   | Rule                                                                                   | Where it lives                                                                                           |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Browsing and search need no account; registration is a **modal** on "احجز الآن"        | `PUBLIC_ROUTES` has no guard; `UnitDetailsPage.book()` opens `UiModal`                                   |
| 2   | The renter pays first, then administration reviews; the lessor cannot accept or reject | `BookingService` has no decision verb; `LessorRequestsService` likewise                                  |
| 3   | Once paid, the unit leaves search until the booking ends                               | `UnitStatus.FullyBooked` excluded from `PUBLIC_UNIT_STATUSES`; the card and the booking box both disable |
| 4   | Lessor details locked before approval; the map shows a 300 m circle                    | `UiLocationMap.precise` defaults to false; `isAddressReleased()` derives it from the status              |
| 5   | Exactly one primary action on details: "احجز الآن". No contact, no chat                | `unit-details-page.spec.ts` asserts there is no `tel:`, no `mailto:` and no form                         |
| 6   | **No security promise** — surveillance, guarding, insurance — in any copy              | Noted at the head of `HomePage`; SRS §3 item 1 records why                                               |

## The seventeen screens

| Prototype screen | Route                          | Component                                 |
| ---------------- | ------------------------------ | ----------------------------------------- |
| `home`           | `/`                            | `HomePage`                                |
| `results`        | `/units`                       | `ResultsPage`                             |
| `details`        | `/units/:id`                   | `UnitDetailsPage`                         |
| `dates`          | `/booking/new/:unitId`         | `DatesStep`                               |
| `goods`          | `/booking/:bookingId/goods`    | `GoodsStep`                               |
| `nafath`         | `/booking/:bookingId/identity` | `IdentityStep`                            |
| `pay`            | `/booking/:bookingId/pay`      | `PaymentStep`                             |
| `result`         | `/booking/:bookingId/result`   | `PaymentResultPage`                       |
| `bookings`       | `/my-bookings`                 | `MyBookingsPage`                          |
| `bdetails`       | `/my-bookings/:id`             | `BookingDetailPage`                       |
| `invoice`        | `/my-bookings/:id/invoice`     | `InvoicePage`                             |
| `cancel`         | `/my-bookings/:id/cancel`      | `CancelBookingPage`                       |
| `account`        | `/account`                     | `AccountPage`                             |
| — (RNT-10)       | `/account/notifications`       | `RenterNotificationsPage`                 |
| `signup`         | `/auth/register/renter`        | `RegisterPage` (role in the URL)          |
| `otp`            | `/auth/verify`                 | `OtpPage` (shared with the lessor portal) |
| `static`         | `/pages/:slug`                 | `StaticPageComponent` (all seven pages)   |
| `index`          | prototype navigation only      | not a product screen                      |

Also built, referenced by the prototype but not drawn in it:
`/auth/account-type`, `/auth/forgot-password`, `/auth/reset-password`.

## Decisions worth knowing

**The route parameter changes meaning after step one.** Step one keys off the
unit (`/booking/new/:unitId`); every later step keys off the booking the server
created. One `:id` segment meaning two different things would be a trap, so the
first step is spelled out as `new/`.

**The wizard's draft lives in session storage.** Only so the design's "register
mid-journey" exception works: the renter leaves to create an account and must
return to the same step with the same dates and description. It is session, not
local — a half-finished booking belongs to the tab it was started in.

**The price shown at payment comes from the server.** `calculatePrice` still
runs locally for immediate feedback as the dates change, but the commission
rate, who bears it and the VAT base are all administrator settings (FR-ADM-06);
a locally computed total would disagree with the charge the first time one
changed.

**The refund figure is never computed on the client.** `CancellationQuote` is
read from the server and rendered. A number that disagreed with what arrived in
the renter's account would be a refund dispute, not a display bug.

**The results map is a panel, not a column.** The design's results screen
carries a قائمة/خريطة switch and, in map mode, a 420 px panel above the list —
not a permanent second column. It had been built as a fixed 576 px side rail,
which at 1280 px left the filter rail and the map holding 856 px between them
and crushed each card's text to one letter per line. The switch is now the
design's, and `.card__body` wraps as the prototype's does, so a narrow column
drops the price beneath the details instead of squeezing the title.

**The map is drawn, not fetched.** No tile provider has been chosen, and the
design's own screens show a stylised grid. `UiLocationMap` takes a point, a
radius and a label; when a provider is picked, only that component changes.

**Nafath asks for nothing.** No upload, no selfie, and the ID number on screen
is read-only — it comes from the registration record, and the design says the
check happens inside the Nafath app alone.

## Palette reconciliation

The renter system shares the brand core with the lessor portal — `#123642`
primary, `#C7A15A` accent, `#2D2D2D` text — and adds an inline link blue
(`#2E6E8E`), now `--color-link`.

It also carries slightly different neutral and semantic shades:

| Role          | Lessor file | Renter file |
| ------------- | ----------- | ----------- |
| success       | `#1E7A4B`   | `#1E8E5A`   |
| danger        | `#B3261E`   | `#C0392B`   |
| card border   | `#E7EBEC`   | `#EDEDED`   |
| primary hover | `#0B242C`   | `#0C2731`   |

Left on the lessor values. These are near-identical shades and picking one
silently would quietly diverge from one of the two files — worth one line from
the designer confirming which set is canonical.

## Open questions

**1. One category has two names.** The lessor add-a-space form says
**"مساحة مفتوحة"**; the renter prototype says **"مكان مكشوف"**. This is
admin-maintained reference data (FR-UNT-04) so it comes from the API, but the
seed data and the English pairing need the confirmed wording. The renter
prototype's wording is used in the fixtures for now.

**2. The commission rate differs between the two design files.** The renter
prototype states 5%; `FINANCIAL_DEFAULTS.commissionRate` is 0.1, which came from
the earlier material. SRS §15 item 3 records the rate as an open client
decision, so nothing is hard-coded — `UiPriceBreakdown` renders whatever the
configuration says, and the payment total comes from the server. The number the
client settles on needs to reach both.

**3. Resolved — visiting hours are structured.** `Unit.visitSchedule` is a list
of `VisitWindow` (days plus an open and close time), so the details page renders
the design's day-group cards, the lessor edits days and times rather than typing
prose, and the close-after-open rule is checkable. There is no backend yet — the
contract is ours to write, so it was written properly rather than worked around.

The same pass added `Unit.addressLine` / `postalCode`. The booking details page
had been rendering the visiting hours under the heading "العنوان الدقيق" because
no address field existed; the payoff screen for FR-UNT-11 was showing the wrong
data. The mock interceptor now deletes both fields from every public catalogue
response, mirroring what the API must do, so a template mistake cannot leak an
address the client was never sent.
