# Backend integration — what the running server actually does

Verified by calling `http://192.168.1.12:4000/api/v1` on 25 Aug 2026, not
transcribed from the guide. Where the two disagree, the client follows the
server and the disagreement is listed below so the backend can settle it.

## Working against it

```
npm run start:api      # ng serve, pointed at the LAN server
npm start              # the fixtures, offline
```

`start:api` is a separate configuration because `npm start` also backs
`ng test`: a suite that pointed at a machine on the LAN would fail whenever
that machine was off, for reasons that are not the code's.

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

**11. `q` matches nothing.** `GET /public/units?q=…` accepts the parameter,
validates its length and then returns `total: 0` for every term tried —
including the exact title of a seeded unit, a single word from it, a word from
its description, its city name, and the same in English. Every other filter on
the endpoint works. Twelve terms, all zero; the search box is wired and shipped
because the parameter is real, but it currently returns an empty page for
anything typed into it.

**12. Two catalogue routes the details page needs are missing.**
`/public/units/:id/availability` and `/public/units/:id/similar` both 404. So
the booking calendar cannot grey out taken dates — it shows every day as free
and lets the server refuse at the draft step — and the "مساحات مشابهة" rail is
not rendered. The calendar one matters more: it turns a date clash into a
rejection one step later rather than a choice the visitor never had.

**13. Repeated `categoryId` is a 422.** The filter panel was built to tick
several categories at once. `categoryId` is a single string and repeating it is
rejected, so the panel is now one-at-a-time. Filtering the rest on the client
was the alternative and would have filtered the page rather than the catalogue.

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
- Four combinations answer 422 rather than failing quietly, and each is a real
  mistake worth surfacing: `sort=nearest` with no point, latitude and longitude
  transposed (caught by Saudi bounds), `minPrice > maxPrice`, and one end of a
  date range without the other. The client prevents the first and the last —
  they come from controls, not from the visitor — and shows the server's own
  Arabic sentence for the other two.
- Anything not published answers `404 UNIT_NOT_FOUND`: draft, rejected,
  archived and "never existed" are indistinguishable, so a caller cannot probe
  what lessors are working on. A malformed id is a 422 on `params.unitId`.
- `pageSize` maxes at 50; `radiusKm` has a floor of 0.5 and defaults to 25.
- `radiusKm` **without** `lat`/`lng` is accepted and ignored, so the radius
  slider is hidden until a location is shared rather than shown doing nothing.
- The detail wraps its payload: `{ unit: … }`.
