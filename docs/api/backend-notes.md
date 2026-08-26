# Backend integration — what the running server actually does

Verified by calling `http://192.168.1.12:4000/api/v1` on 25 Aug 2026, not
transcribed from the guide. Where the two disagree, the client follows the
server and the disagreement is listed below so the backend can settle it.

## Working against it

```
npm start              # the LAN server — the default, and a bare `ng serve` too
npm run start:mock     # the fixtures, offline
```

The real server is what `ng serve` gives you with no flags. It was the other
way round, and that was a trap: the obvious command answered every request from
inside the browser, so an endpoint could be wired, reloaded, and change nothing
on screen. The console says which mode is running on every start.

The fixtures keep their own configuration because `ng test` uses it: a suite
that pointed at a machine on the LAN would fail whenever that machine was off,
for reasons that are not the code's.

Switching modes leaves a token from the other one in the browser. The
application drops a fixture token before its first real request rather than
after two 401s — see `core/startup.ts`.

If a change does not appear after a restart, the build cache is stale:

```
rm -rf .angular/cache && npm start
```

The host is in `src/environments/environment.local-api.ts` and is the only line
to edit when it moves. **Check `http://<host>:4000/health` returns 200 before
debugging anything in the client.**

## Seeded accounts — password `Hayzak@2026`

| Mobile     | Role   | `adminRole`  | What it is for                                     |
| ---------- | ------ | ------------ | -------------------------------------------------- |
| 0500000001 | RENTER | —            | the ordinary case                                  |
| 0500000002 | LESSOR | —            | has units and a bank account                       |
| 0500000003 | LESSOR | —            | `mobileVerifiedAt: null` — lands on `/auth/verify` |
| 0500000004 | ADMIN  | SYSTEM_ADMIN | everything                                         |
| 0500000005 | RENTER | —            | `SUSPENDED` — 403 `ACCOUNT_SUSPENDED`              |
| 0500000006 | ADMIN  | OPERATIONS   | units and complaints, no money                     |
| 0500000007 | ADMIN  | FINANCE      | transfers and refunds, no units                    |

Seven states, not seven people. The database is shared: five wrong passwords
lock an account for fifteen minutes, so tell the backend rather than waiting it
out. Run `npm run db:seed:dev` on the server after pulling.

## What is actually shipped

Everything else in `api-endpoints.ts` answers **404** and is named only so the
screen that will call it has somewhere to point.

```
auth      11 endpoints — terms, register, verify-mobile, resend-otp, login,
                         refresh, logout, logout-all, forgot/reset-password, me
public     5 — categories, cities (districts nested), prohibited-items,
               units (search), units/:id
me        10 — GET /me, PATCH /me
               bank-accounts: list, add, make-default, remove
               notifications: list, read one, read all
lessor    11 — dashboard, earnings,
               units: list, create, detail, patch, images (post/delete),
                      submit, archive, blocks (post/delete)
admin     11 — units: list, detail, approve, reject
               payouts: eligible, list, approve, detail, paid, failed, retry
```

`GET /lessor/units/:id` returns the images, the pin and the calendar nested, so
the detail is **one** request, not three. `GET /lessor/dashboard` is the same
idea for the landing screen: counts, money and the unread badge in one call.

Two responses wrap their payload in a named key rather than sending it bare —
`{ dashboard: … }` and `{ earnings: … }`, the way `/auth/me` sends `{ user }`.

## Verified segregation of duties

The API refuses, not the guard. Straight from curl:

```
FINANCE     → GET  /admin/units              403
FINANCE     → POST /admin/units/:id/approve  403
OPERATIONS  → GET  /admin/units              200

OPERATIONS  → GET  /admin/payouts/eligible   403
FINANCE     → GET  /admin/payouts/eligible   200
```

The second pair is the mirror of the first, and together they are the whole
point of splitting the console: neither administrator can reach the other's
work, and the refusal is the server's.

A hidden button is not access control. The client's guards exist only so a
control that would be refused is never offered.

## Settled

All three of the earlier discrepancies were fixed on the server, and the roles
question was answered better than either option put to it.

- **Lists** nest rows and counts together inside `data`. No `meta` key.
- **`limit` is now a 422**, naming the parameters it will accept. An unknown
  *query* parameter is an error; an unknown *body* field is stripped in silence,
  which is the mass-assignment guard and is deliberate — verified by posting
  `{"role":"ADMIN"}` to `POST /lessor/units` and watching it vanish.
- **Notifications can be marked read.** `PUT /me/notifications/:id/read` and
  `/read-all` both answer with the fresh `unreadCount`, so the badge is
  corrected by the same response that did the work — no second request, and no
  window where the two disagree. This closed an earlier open item.
- **`hasNextPage` and `hasPrevPage`** are sent. The client reads them and no
  longer derives anything: two rules for one fact is one rule that drifts.
- **Roles** are now three fields, each with one job:
  `role` (RENTER/LESSOR/ADMIN) routes, `adminRole`
  (SYSTEM_ADMIN/OPERATIONS/FINANCE) labels, and `permissions[]` decides. Guards
  read `permissions` only — see `core/constants/permissions.ts`.

The nine permissions the server issues:

```
units:review  users:manage  bookings:manage  complaints:manage
payouts:approve  refunds:issue  settings:manage  reports:view  cms:manage
```

A renter and a lessor come back with `permissions: []`: their capabilities
follow from `role`, and the client supplies those under a `client:` prefix so
the nav and the routes have one vocabulary.

## Open with the backend

**1. Two console screens have no permission.** The reference lists and the audit
trail are not covered by any of the nine, so both ride on `settings:manage` and
are system-administrator only — narrower than SRS §5, which gives reference data
to an operations supervisor. Under-granting is the safe direction to be wrong
in, and the routing spec asserts the narrowing so it stays deliberate. Needs
either `reference:manage` and `audit:view`, or a ruling that `settings:manage`
is the right home.

**2. The finance officer cannot configure commission.** `settings:manage` is
system-administrator only on the server; SRS §5 gives financial configuration to
the finance officer. One of the two is wrong.

**3. Dates go in plain and come back as instants.** `POST /lessor/units/:id/blocks`
refuses `2027-06-01T00:00:00.000Z` with "التاريخ يجب أن يكون بصيغة YYYY-MM-DD",
then answers with `"startDate": "2027-05-01T00:00:00.000Z"`. The client narrows
them back by taking the first ten characters — deliberately a string operation,
because parsing a UTC midnight and reading its local day is a day out anywhere
west of Greenwich. Symmetry would be better: send the date back as it was
accepted.

**5. Visiting hours are one window for the whole week.** The API stores
`visitHoursFrom`/`visitHoursTo` as minutes since midnight; FR-UNT-06 and the
design have a row per group of days. `unit-wire.ts` reduces a schedule to the
widest window on the way out and expands it back as "every day" on the way in.
A lessor who enters "Sunday to Thursday, 09:00–17:00" reads it back as "all
week" — the days were never stored. Needs either a repeating structure on the
wire, or a decision to drop the per-day table from the form.

**6. No `isFullyBooked` on a unit.** FR-MKT-10 wants a "محجوزة بالكامل" badge on
a search result. It cannot be derived client-side without fetching the
availability of every card on the page, so the flag is optional in the model and
the badge simply never appears against the real server.

**7. `/lessor/units` takes no search term.** It accepts `status`, `page` and
`pageSize` and answers 422 for anything else. With fifty-one spaces across five
pages the lessor's search box therefore filters the twelve on screen and not the
other thirty-nine. The screen says nothing about that, because the honest fix is
a `search` parameter, not a caption explaining a limitation.

**8. `/lessor/earnings/rows` is not shipped.** The dues table (LSR-07) shows a
row per booking with its commission and its transfer. `/lessor/earnings` gives
the three totals and nothing per booking, so the table renders its error state
against the real server while the buckets above it work. Needs the per-booking
projection, or a decision that the totals are enough.

**9. A booking's money has no status of its own.** The client models it as
`PENDING | RELEASABLE | PAID` — the same three buckets the summary uses —
because `PayoutStatus` describes a transfer, which covers several bookings and
does not exist until an operator approves one. Reusing it meant a booking could
read "APPROVED" before any payout covered it. Provisional until the rows
endpoint lands and says otherwise.

**10. The users list filter needs a decision.** The console filters by
مستأجر/مؤجر and by the three kinds of administrator in one control. The client
sends `role` for the first two and `adminRole` for the rest; `/admin/users` is
not shipped, so nothing has agreed to that yet.

**11. `q` works. The zeros were my probe, not the server.** Closed.

Re-run against the live server with the term written to a file as UTF-8 and
sent with `--data-urlencode "q@file"`, so the bytes were under my control:
مستودع، مكيّف، العليا، تخزين، نظيف — **25 each**.

The cause, captured with `-w '%{url_effective}'`, is worth writing down because
it will happen again. The same term passed inline on this Windows shell went out
as:

```
?q=%3f%3f%3f%3f%3f%3f      # six literal '?'
?q=%d9%85%d8%b3%d8%aa…     # the same term, read from a file
```

The shell replaced every Arabic character with `?` before curl ever saw the
argument — a codepage conversion, not double-encoding, and not the application.
So the search was answering a question nobody asked.

Two lessons, both cheap: **never pass a non-ASCII argument inline from this
shell** — write it to a file and use `q@file` — and **capture
`%{url_effective}` on any probe whose result is surprising**, because the URL is
the evidence and the term is not.

The application was never implicated: nothing calls `encodeURIComponent`,
`HttpParams` encodes once, and a spec pins it — a double-encoded term would
return zero with a 200, which looks like a broken search rather than a broken
client, so it is worth keeping pinned.

**12. 54 of 79 published units have no location, no images and no visiting
hours.** `location: null`, `coverUrl: null`, `images: []`, `visitHours: null`,
`maxDays: null` — the same 54, so it is one batch rather than a scattering.
`district` is `null` on all 79.

That should not be publishable by your own rules: `POST
/lessor/units/:id/submit` is refused with `UNIT_IMAGES_REQUIRED` under two
images, and FR-UNT requires a location. So either the seed wrote them straight
to `PUBLISHED` past the validation, or publishing does not check what submit
checks. Worth knowing which, because the second is a hole.

The client no longer assumes any of them: `area` is nullable, the results map
draws only the units it has a circle for and says how many it left out, and the
details page says the owner has not set a location rather than drawing a circle
centred on nothing. A circle at `undefined, undefined` was the alternative, and
it renders — in the sea.

**13. The catalogue's two extra routes are shipped.** `GET
/public/units/:id/availability?from=&to=` and `GET
/public/units/:id/similar?limit=` both answer now, and both are wired. See
"The public catalogue" below for the three things about availability that are
easy to get wrong quietly.

**14. Repeated `categoryId` is a 422.** The filter panel was built to tick
several categories at once. `categoryId` is a single string and repeating it is
rejected, so the panel is now one-at-a-time. Filtering the rest on the client
was the alternative and would have filtered the page rather than the catalogue.

**15. The CMS is not shipped, and four header links depend on it.**
`/content/pages/{how-it-works,faq,contact,about,terms,privacy,refund-policy}`,
`/content/terms/active` and `/content/contact` all answer 404. Those pages are
in the header and the footer of every screen, so a visitor's second click is
usually one of them. They are server-held on purpose (FR-CMS-01 — an operator
edits them without a release), so there is nothing sensible to hard-code.

The page used to answer this with "الصفحة غير متاحة — قد تكون أُزيلت أو تغيّر
رابطها", which denies a link the application itself had just drawn. It now
separates a slug it has never heard of from a fetch that failed.

Since then the seven documents ship in the bundle
(`core/constants/static-pages.ts`) and `ContentService` asks the server first,
falling back to them. So the pages read today, and the day this module lands an
administrator's published version takes over with no change on this side.

**16. The renter's own area is not shipped either.** Signed in as
`0500000001` (RENTER): `/me` and `/me/notifications` answer 200,
`/me/bank-accounts` correctly 403s a renter, and `/bookings/mine`,
`/bookings` and every `/account/*` route answer 404. So a renter can sign in,
read their profile and their notifications — and has no "حجوزاتي" and no
account screen.

**17. `returnUrl` rejects the domain your own note used.** `POST
/renter/bookings/:id/pay` with `https://app.hayzak.sa/bookings/return` — the
example in the handover — answers 422 «رابط العودة لازم يكون على نطاق
المنصة». Only `localhost:4200` and `192.168.1.12:4200` are accepted today, so
the allow-list is the dev origins and nothing else. The client sends
`window.location.origin + '/bookings/return'`, which is the right thing anyway
and works in both; but the production origin will need adding before it can.

**18. `redirectUrl` is built from the server's own idea of its host.** It comes
back as `http://localhost:4000/api/v1/webhooks/payments/fake/checkout/…` even
when the request arrived on `192.168.1.12:4000`. A browser on any other machine
follows that to nothing. Harmless with a real gateway, whose URL is absolute
and external — but for the fake provider it means the flow can only be walked
from the server's own machine.

**19. `CANNOT_BOOK_OWN_UNIT` was not reachable.** A lessor posting to
`/renter/bookings` is stopped by the role guard first — 403 `FORBIDDEN`, not
409. So the documented code needs an account that is both, or it is unreachable
and the "hide احجز on your own space" advice is the whole mitigation. The
client hides it either way.

**20. `goodsDescription` has an undocumented minimum.** Between 7 and 10
characters; «أثاث م» is refused, «أثاث منزلي» accepted, with a good message
(«اكتب وصفاً أوضح للبضاعة — ده اللي بيتراجع قبل تحويل المبلغ»). Worth stating
the number. The client's own floor is 20, deliberately stricter: a human reads
this before money moves.

Worth saying plainly, because it cost an hour: the specific booking codes only
surface once the *field* validation passes. A create with a short
`goodsDescription` and dates in the past answers `VALIDATION_ERROR`, not
`BOOKING_DATES_IN_PAST` — which reads as "the codes are not implemented" until
you send a longer description. They are all implemented.

## Shapes worth knowing

- `register` returns **no tokens** — the account is `PENDING_VERIFICATION` and
  `verify-mobile` is what mints the first pair.
- `reset-password` returns no tokens either: every session including this one is
  revoked, so the only correct next screen is sign-in.
- `logout` takes the **refresh** token, not a bearer.
- `GET /auth/me` and `GET /me` both answer `{ user }`, not a bare user.
- `login` succeeds for an unverified account. Read `mobileVerifiedAt` and route
  to `/auth/verify` — every transactional endpoint refuses them until then.
- Reference rows carry `nameAr` **and** `nameEn` together, so a language switch
  re-renders rather than re-fetching. `/public/cities` nests its districts, so
  there is no separate districts request.
- `devCode` comes back on OTP responses in development. Nothing branches on it.
- The mobile is normalised server-side: `0512345678` comes back
  `+966512345678`. The client sends what the user typed and validates nothing
  about its shape — a client-side check would only reject numbers the API takes.
- `pageSize` is capped at **50**. Asking for more is a 422.
- Unit statuses are `DRAFT PENDING_REVIEW REJECTED PUBLISHED SUSPENDED ARCHIVED`.
  There is no `FULLY_BOOKED` — see open item 6.
- There is **no `/admin/units/pending`**: `pending` is read as a unit identifier
  and answers 422. The queue is `/admin/units?status=PENDING_REVIEW`.
- There is **no `DELETE /lessor/units/:id`**. A unit is archived; bookings
  reference it.
- `POST /lessor/units/:id/submit` is refused with `UNIT_IMAGES_REQUIRED` under
  two images.
- Image upload is multipart under the field name **`images`** (several files per
  call), and answers with the unit's whole image list.
- Uploaded files are served from the API's **origin** — `http://host:4000/uploads/…`
  — not from under `/api/v1`. Appending them to `apiUrl` is a 404 that renders
  as a broken image.
- Availability blocks are **half-open**: a block ending on the 10th and one
  starting on the 10th are both accepted. Overlapping one is
  `UNIT_DATES_UNAVAILABLE`.
- `verificationStatus` is uppercase on the wire: `VERIFIED`, not `Verified`.
- A bank account's IBAN comes back as `ibanLast4` and nothing else. There is no
  endpoint that releases the rest, to anybody, including its owner — so there is
  no "reveal" control to build and nothing to design a screen around.
- `POST /me/bank-accounts` takes `accountHolderName` and `iban` only. Spaces and
  dashes in the IBAN are stripped server-side, and any `bankName` sent is
  ignored: the bank is read off the number. The response carries the resolved
  bank, which the screen shows afterwards — a transposed digit usually still
  passes some other bank's checksum, and the person who typed it is the only one
  who can tell.
- Rejected IBANs come back under **five** distinct codes, not the four the note
  listed: `IBAN_CHECKSUM_FAILED`, `IBAN_NOT_SAUDI`, `IBAN_INVALID_LENGTH`,
  `IBAN_INVALID_FORMAT` and `IBAN_ALREADY_REGISTERED`. Each `message` is already
  written in Arabic and is displayed as-is; only the code is branched on.
- Only the first bank account becomes the default. A second one needs
  `PUT /me/bank-accounts/:id/default`, and deleting the last is refused with
  `BANK_ACCOUNT_LAST_ONE`.
- `PATCH /me` **silently drops `mobile`** — the mass-assignment guard again.
  Changing the number is a separate flow with an OTP to the new number, so the
  profile form shows it read-only rather than offering a box that would appear
  to save and not.
- `locale` on the user is not a display preference: the same notifications go
  out by SMS in that language, so the screen must not disagree with the message
  already on somebody's phone. `PATCH /me { "locale": "en" }` changes both.
- Payout statuses are `APPROVED PAID FAILED` — three, not five. There is no
  "due" or "on hold" payout: money with no transfer yet lives in
  `/admin/payouts/eligible`, where a row carries `blocked` (`null`, or
  `NO_BANK_ACCOUNT`) instead of a status.
- `POST /admin/payouts/:id/paid` requires `bankReference` and
  `/failed` requires `reason`; both are 422 without.
- `POST /admin/payouts` with a lessor who has nothing releasable answers
  `PAYOUT_NOTHING_ELIGIBLE`, not an empty payout.
- A payout never carries a full IBAN — `ibanLast4` only.
- `releaseRule` on the earnings response names the policy
  (`after_booking_start_24h`) so the screen can explain why money is pending.
  An unrecognised rule renders nothing rather than a guessed sentence.
- `GET /me` nests `identity` with `idNumberLast4` — not the `idNumberMasked` the
  account screen models. That screen's endpoints are not shipped, so it has not
  been reconciled.

### The public catalogue

- `GET /public/units` returns results with **no parameters at all**, which is
  what lets the opening screen show something before anybody chooses anything.
- **`location` is not a location.** The point is displaced from the true one on
  purpose, the space is somewhere *inside* `radiusMeters` rather than at the
  centre, and there is no parameter anywhere that returns the real point — it is
  released after a confirmed booking (FR-UNT-11). So it is drawn as a circle,
  everywhere, and the client renames the field to `area` on the way in so that
  `[point]="unit.location"` is not a thing anybody can type by accident.
  The displacement is stable per unit, so the circle does not move between the
  list and the details page.
- `addressLine` and every means of contacting the lessor are absent by design,
  not omitted from the projection. FR-MKT-09 gives the details page one button.
- `minPrice`/`maxPrice` are **halalas**: `minPrice=1000` is ten riyals.
- `indicativeMonthlyHalalas` is `dailyPriceHalalas × 30`, computed and stored
  nowhere. Nothing is let by the month and nobody is charged it — every screen
  showing it labels it تقديري.
- `distanceMeters` is `null` without `lat`/`lng`, and **rounded to the nearest
  100 m** when present. Shown with a `~`.
- `visitHours` is `{ fromMinutes, toMinutes }` — minutes since midnight, Riyadh,
  a window repeated *daily*. Not an instant: formatted by arithmetic, never
  through a date library.
- **Five** combinations answer 422 rather than failing quietly, each a real
  mistake worth surfacing: `sort=nearest` with no point, `radiusKm` with no
  point, latitude and longitude transposed (caught by Saudi bounds),
  `minPrice > maxPrice`, and one end of a date range without the other. The
  client prevents the ones that come from its own controls rather than from the
  visitor, and shows the server's own Arabic sentence for the rest. All five
  re-verified against the live server.
- Anything not published answers `404 UNIT_NOT_FOUND`: draft, rejected,
  archived and "never existed" are indistinguishable, so a caller cannot probe
  what lessors are working on. A malformed id is a 422 on `params.unitId`.
- `pageSize` maxes at 50; `radiusKm` has a floor of 0.5 and defaults to 25.
- `radiusKm` **without** `lat`/`lng` is a 422 now — it used to be accepted and
  ignored. That is the better behaviour and the slider is visible again:
  moving it without a point asks for the location instead of hiding.
  The range is 0.5–200 km, defaulting to 25 when a point arrives without one,
  and both bounds now answer in Arabic («أقل نطاق بحث هو 0.5 كم»).
- The detail wraps its payload: `{ unit: … }`; `/similar` wraps its own in
  `{ items: [ … ] }`.

### Availability — three ways to get it wrong quietly

`GET /public/units/:id/availability?from=&to=` → `{ unitId, from, to, minDays,
maxDays, blocked: [{ startDate, endDate }] }`.

- **Half-open, like every other range here.** `endDate` is the first *free* day
  again. Greying it out as well loses one bookable day per booking, forever,
  and nobody would ever report it. `occupiedDays()` stops before the end, which
  is why this was already right.
- **`to` is the server's answer, not the question.** It has a default of 90 days
  and a ceiling of 365, so days beyond it were never described — unknown, not
  free. The client keeps it as `unknownFrom` and says on screen how far the
  calendar is speaking for.
- **Adjacent ranges arrive merged, and must stay merged.** Three consecutive
  bookings come back as one range. Splitting them lets "does the selection
  overlap a row?" pass a selection that sits across the seam.
- No `reason`, deliberately: a taken day is a confirmed booking, a lessor's own
  block, or somebody part-way through paying, and the calendar needs the same
  bit from all three. The distinction would hand a lessor's occupancy to their
  competitors, and "somebody is paying right now" invites a race.
- `maxDays` may be `null` — no upper bound on a stay. `minDays` is always a
  number.
- None of this replaces the server's check. A clashing booking is still refused
  at creation by a database constraint; what changed is whether the date was
  ever offered.

Verified rather than taken on trust: two adjacent blocks posted as `2026-10-05
→ 2026-10-08` and `2026-10-08 → 2026-10-11` came back from the public route as
a single `2026-10-05 → 2026-10-11`. That is the merge *and* the half-open rule
in one answer — the 8th being both an end and a start is what lets them join.
Both test blocks were deleted afterwards.

The `to` ceiling is real and worth handling: asking `from=2026-08-26` with
`to=2028-01-01` answers `to=2027-08-26`, exactly 365 days. Everything past it
was never described, which is why the client keeps `unknownFrom` rather than
assuming the rest of the year is free. No seeded unit has a blocked range, so
the greyed-out path only exists in the fixtures and in the one probe above.

### Similar spaces

`GET /public/units/:id/similar?limit=` (1–12, default 6 — `0` and `13` are both
422) → `{ items }`, the
same card shape as a search result, ordered same-city → same-district →
nearest → closest in price. Never the unit itself, never anything unpublished.

`distanceMeters` is always `null` here and that is deliberate: both units sit
behind approximate circles, so a distance between two of them is a second
independent measurement of the same geometry. Enough pairs, anchored by one
search from a point you control, and the real coordinates fall out. It orders
the rail and is never displayed.

No paging, by design — "page 2 of similar" is the catalogue filtered by
category, and that route already exists. The rail links to it instead.

### Bookings and payment

Verified end to end against the fake provider, including a declined card.

- The routes are **`/renter/bookings`** and **`/lessor/bookings`**, not
  `/bookings/*`. A lessor asking for the renter list gets 403, not an empty
  page, and the same the other way.
- **One create.** `POST /renter/bookings { unitId, startDate, endDate,
  goodsDescription, prohibitedAck }` → `201 { booking, holdExpiresAt }`, and
  the dates are already held. There is no draft, no separate confirm, and no
  quote endpoint — the answer carries the price it committed to.
- `holdExpiresAt` sits **beside** `booking`, not inside it, on create and on
  read alike, and is `null` once nothing is held. `GET /renter/bookings` (the
  list) does not carry it at all — only the detail does, which is why a card
  cannot show a countdown.
- **`daysCount` is nights.** 2028-03-01 → 2028-03-05 comes back as 4. The
  client renames it on the way in and every screen says "ليالٍ".
- `price` on a renter's booking has four fields. The lessor's has three more —
  `commissionRateBps`, `commissionHalalas`, `netToLessorHalalas` — and the
  renter's response carries none of them, which is why the client's model makes
  the commission a separate optional branch rather than optional fields.
  Defaulting them to zero would print "عمولة المنصة: 0.00" on a receipt.
- `contact` and `unit.addressLine` are `null` until `CONFIRMED` and populated
  after. Confirmed by walking a payment through: both appeared in the same
  response that flipped the status.
- `POST /renter/bookings/:id/pay { returnUrl }` → `{ redirectUrl }`. Idempotent:
  the same `chg_…` comes back on a second call. Send the **whole browser** —
  3-D Secure will not run in an iframe.
- The gateway returns `?status=paid|failed&charge=…`. **Do not read it.** The
  webhook that settles the payment races the redirect; the client polls the
  booking instead and treats `AWAITING_PAYMENT` as "still settling" for a few
  seconds before calling it unpaid.
- A declined card leaves the booking `AWAITING_PAYMENT` with the hold intact,
  and `pay` can be called again. Verified.
- `POST .../pay` on a confirmed booking is 409 `BOOKING_NOT_PAYABLE`.
- `GET /lessor/bookings/:id` exists (it was not in the handover) and answers
  `{ booking }` with **no** `holdExpiresAt` — which is right: the countdown is
  the renter's to act on. The lessor's list and detail both carry the
  commission.
- A hold that lapses moves the booking to `EXPIRED` on its own. Observed on a
  declined-card booking left for fifteen minutes.
- `BOOKING_DATES_UNAVAILABLE` is 409 and carries no `meta`. It is not a fault —
  it is what happens to the best space in the best week — so the client sends
  the visitor back to the calendar rather than showing an error and leaving
  them there.
- `BOOKING_DURATION_TOO_SHORT` / `_TOO_LONG` carry `meta.minDays` /
  `meta.maxDays` alongside `meta.requested`. `_IN_PAST` carries none.
- `prohibitedAck: false` is a field error on `prohibitedAck`, not a booking
  code.
