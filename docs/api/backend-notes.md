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
  _query_ parameter is an error; an unknown _body_ field is stripped in silence,
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

**1 & 2. The permissions are thirteen now — settled.** ~~Two console screens
have no permission~~ / ~~the finance officer cannot configure commission~~. The
vocabulary read off the running server on 2026-08-26:

| Permission           | Held by                       |
| -------------------- | ----------------------------- |
| `settings:financial` | `SYSTEM_ADMIN` + `FINANCE`    |
| `reference:manage`   | `SYSTEM_ADMIN` + `OPERATIONS` |
| `audit:view`         | `SYSTEM_ADMIN`                |
| `admins:manage`      | `SYSTEM_ADMIN`                |

So the matrix is SRS §5's again: the operations supervisor holds the reference
lists, and the finance officer holds the commission and the VAT rate.
`settings:manage` stays with the system administrator and now means what is
left — integration keys and system limits — so **it no longer opens the
financial screen**, and guarding that screen on it would lock out the one
officer whose screen it is. `admins:manage` has no screen yet; it is in the
enum because that enum is the wire's whole vocabulary, and a permission the
client has never heard of is one `WIRE_PERMISSIONS` would silently drop.

`audit:view` being the system administrator's alone is right and worth saying
why: the audit trail records what every administrator did, including whoever is
reading it.

**3. Dates — fixed, and symmetrical.** ~~Go in plain and come back as
instants.~~ `POST /lessor/units/:id/blocks { "startDate": "2027-07-01" }` now
answers `"startDate": "2027-07-01"`, on `unit_availability` and on bookings, and
an instant on the way in is still a 422. Verified 2026-08-26.

The client's ten-character slice is **gone** rather than kept as a guard: a
coercion that silently accepts the wrong shape is how a broken contract stays
invisible. `unit-wire.spec.ts` asserts the block dates are carried through
untouched, so nothing reintroduces a conversion.

**5. Visiting hours — the form now says what is stored. Awaiting the client's
ruling.** The API holds `visitHoursFrom`/`visitHoursTo` as minutes since
midnight: one window, no days. FR-UNT-06 and the design have a row per group of
days, and the editor used to offer exactly that — day toggles, several rows, an
"add another period" button — all of which read back as "all week" whatever was
entered, because the days were never saved.

The editor is now a single window labelled **"مواعيد الزيارة (يوميًا)"**. A
simpler form that is true beats a richer one that promises storage there is
none of. If the client rules that per-day windows are required, this needs a
repeating structure on the wire and the table comes back; until then the form
does not lie to the lessor.

**6. `isFullyBooked` — shipped.** On every card in `/public/units`, always a
boolean, never absent. It means "no free day in the next thirty". Already
non-optional in the client's model, so nothing needed changing; the badge
appears now. Note it is always `false` when `startDate`/`endDate` are sent,
which is correct — a booked unit is not in those results at all.

**7. `/lessor/units?search=` — shipped, and wired.** It matches the title and
the short description across every page, combines with `status`/`page`/
`pageSize`, and answers 422 above 120 characters (`query.search`, «نص البحث
طويل جدًا»).

The lessor's box used to filter the loaded page in the browser — twelve rows
searched out of the 174 this account has, while the pager went on counting all
of them. The term now goes to the server, a changed term resets to page one,
and the input carries `maxlength=120` so the ceiling cannot be typed past:
truncating on the way out would search for something other than what is on
screen, and holding the request back would show every row and look like the
search did nothing.

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

**10. The users list filter — agreed.** Two separate parameters, `role` and
`adminRole`, which is what the client already sends. `/admin/users` itself is
in the next batch.

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

**16. The renter's own area — mostly shipped now.** ~~Not shipped either.~~
`/renter/bookings` and its detail, payment, and invoice all answer, and are
wired; "حجوزاتي" works. What is still 404 is the `/account/*` family, which
duplicates `/me/*` — that needs a ruling on which name wins before either side
builds more on it.

**A standing correction to how this file reads.** A route answering **401 is
not a route that is missing.** Several items above were written from probes run
without a token and said "not shipped" about paths that were only asking to be
signed in. The server has ~62 routes; `api-endpoints.ts` names about half.
Before writing "not shipped" here again: send a token, and quote the status
code.

**17. `returnUrl` — settled, and the fault was ours.** ~~Rejects the domain
your own note used.~~ The allow-list is the `WEB_URL`/`APP_URL` hosts plus any
local origin outside production, and `https://app.hayzak.sa` is simply not one
of them in a development configuration. The 422 now names the host it wants
(«رابط العودة لازم يكون على نطاق المنصة (localhost:3000).»), and
`window.location.origin + '/bookings/return'` is accepted from
`192.168.1.12:4200` — verified 2026-08-26.

**One thing to carry to deployment:** `WEB_URL` must be the real production
origin before launch. Left on a development value, _every_ payment is refused
with this 422 — the flow does not degrade, it stops.

**18. `redirectUrl` — fixed.** ~~Built from the server's own idea of its
host.~~ It is now built from the address the request actually arrived on:
posting to `192.168.1.12:4000` answers
`http://192.168.1.12:4000/api/v1/webhooks/payments/fake/checkout/…`, so the
fake gateway can be walked from any machine on the network. A forged `Host:
evil.example.com` falls back to the configured `APP_URL` rather than being
reflected. Verified 2026-08-26.

Treat `redirectUrl` as **opaque and absolute** — never reassemble it from
parts. With a real gateway it is Tap's own page; with the fake provider it is
ours; `window.location.assign()` handles both with one line.

**19. `CANNOT_BOOK_OWN_UNIT` is unreachable, and stays in the server on
purpose.** A lessor posting to `/renter/bookings` is stopped by the role guard
first — 403 `FORBIDDEN`, not 409 — because a user has exactly one role today.
The backend is keeping the check anyway: if roles stop being exclusive (someone
who lets a space and also has one to fill), its absence would let an owner
block their own dates off-market for free and cycle money through the
platform's own commission. Nothing to build on this side, and no UI for a code
that cannot arrive — **hiding «احجز» on your own space remains the only real
guard**, and the client does.

**20. `goodsDescription` minimum is 10 characters** after trimming — 9 is a
422, 10 is a 201. Now documented on their side. The client's own floor is 20,
deliberately stricter: a human reads this before money moves.

Worth keeping in mind, because it cost an hour and is by design rather than a
bug: **a request must be well-formed before the rules about its meaning
apply.** A create with a short `goodsDescription` _and_ dates in the past
answers `VALIDATION_ERROR`, not `BOOKING_DATES_IN_PAST`. If every fixture
carries the same malformed field, every booking code looks unimplemented. They
are all implemented and all reachable — fix the fixture and they appear.

**21. There is no invoice PDF.** `GET /renter/bookings/:id/invoice` with
`Accept: application/pdf` answers the same JSON, `content-type:
application/json`. The client no longer offers "تحميل" — a button that saved
JSON under a `.pdf` name is worse than its absence — and renders the document
itself, printing through the browser. FR-PAY-09 wants a durable artefact, so
this is still owed.

**22. `qrCode` is `null` and `vatRateBps` is `0`.** Neither is wrong today: the
platform is not charging VAT on rent, and the ZATCA QR is not generated yet.
The client prints "يُضاف رمز الاستجابة السريعة عند اعتماد الفاتورة" rather than
an empty square, and takes the rate off the invoice rather than off
configuration, so a re-opened invoice states the rate it was issued under.

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
  purpose, the space is somewhere _inside_ `radiusMeters` rather than at the
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
  a window repeated _daily_. Not an instant: formatted by arithmetic, never
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

- **Half-open, like every other range here.** `endDate` is the first _free_ day
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
a single `2026-10-05 → 2026-10-11`. That is the merge _and_ the half-open rule
in one answer — the 8th being both an end and a start is what lets them join.
Both test blocks were deleted afterwards.

The `to` ceiling is real and worth handling: asking `from=2026-08-26` with
`to=2028-01-01` answers `to=2027-08-26`, exactly 365 days. Everything past it
was never described, which is why the client keeps `unknownFrom` rather than
assuming the rest of the year is free. No seeded unit has a blocked range, so
the greyed-out path only exists in the fixtures and in the one probe above.

### Similar spaces

`GET /public/units/:id/similar?limit=` (1–12, default 6 — `0` and `13` are both 422) → `{ items }`, the
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
- On a booking that has already `EXPIRED`, `holdExpiresAt` is **absent** rather
  than `null`. The adapter coerces it, because `undefined` reaching a countdown
  reads as "no deadline" in one place and as a deadline of `NaN` in another.

### The tax invoice

`GET /renter/bookings/:id/invoice` — 404 `INVOICE_NOT_FOUND` until the booking
is `CONFIRMED`, which is the screen's "not issued yet" state and not a failure
to report or retry.

```
{ invoice: {
    id, invoiceNo: "INV-2026-000041", issuedAt,   // an instant, not a plain date
    taxableHalalas, vatHalalas, totalHalalas, vatRateBps,
    qrCode: null,
    booking: { id, referenceNo, startDate, endDate, daysCount, unit: { id, title } },
} }
```

Three things to hold on to. It is **wrapped** in `invoice`. It counts nights
under the wire's word for days, exactly as a booking does. And it carries
enough of the booking to render without a second call — the daily rate is the
only figure it omits, so the client reads that from the booking and treats that
call's failure as costing a sub-line rather than the document.

The money on the page comes from the invoice, not from the booking. They agree
today; on the day they do not, the issued document is the one that is true.

The renter's name comes from the session. Not from `booking.contact` — on a
renter's booking that is the _counterparty_, so reading it there printed the
owner's name in the field labelled "المستأجر", on a document whose whole point
is that it does not identify them (SRS §5).

### The lifecycle runs on its own now

`CONFIRMED → ACTIVE → COMPLETED` advances without anybody pressing anything, so
no screen may assume a paid booking stays `CONFIRMED`. Nothing needed changing
here: `BookingStatus` has carried all seven states since the enum was written,
`TERMINAL_BOOKING_STATUSES` puts `COMPLETED`, `CANCELLED` and `EXPIRED` in
"السابقة", and `bookingPrimaryAction` offers the invoice from `CONFIRMED`
onward — which is right, because payment is what issues it.

### Complaints — the only exception path

There is no cancel button in the product, no self-service refund, and no
editing a booking after payment. Every exception — "I want out", "the space was
locked", "it was nothing like the listing" — is a complaint, and an
administrator decides the outcome. That is why `ComplaintResolution` carries
actions like cancelling a booking and suspending a listing: it is not a status
vocabulary, it is the whole set of things the platform can do about a problem.

**Both `POST`s are `multipart/form-data` and refuse JSON**, even with nothing
attached. The file field is literally `attachments`, and a typo there uploads
nothing while still answering 201 — `complaint.spec.ts` pins the field names
for that reason.

```
POST /me/complaints                          bookingId, category, subject(≥5),
                                             description(≥20), attachments(0-5)
GET  /me/complaints?status=&page=
GET  /me/complaints/:id
POST /me/complaints/:id/messages             body (optional with files), attachments
```

`description` has a floor of 20 characters and it is the point: a person reads
this and decides something with money attached.

An empty reply with no files is a 422 `COMPLAINT_MESSAGE_EMPTY`, so the send
button is off until there is text or a file.

**409 `COMPLAINT_ALREADY_OPEN` carries `meta.complaintId`.** The answer to "you
already have one of these" is a link to it, not an error message — the screen
reads the id and offers "افتح الشكوى الحالية".

`OPEN → IN_PROGRESS ⇄ AWAITING_USER → RESOLVED | CLOSED`. Replying while
`AWAITING_USER` returns it to `IN_PROGRESS` **on its own**; nothing on this side
tries to, and every write answers with the whole complaint so the badge learns
the new status from the same response.

**Both parties read and answer the same thread.** The lessor being complained
about sees it, deliberately, because they have to answer for themselves. So the
complaint screens are top-level at `/my-complaints` and guarded on `authGuard`
alone — not under `my-bookings`, which a lessor has no version of.

**`isInternal` messages never reach `/me`.** The client does not filter them:
the thread component renders one with a visible "ظهرت بالخطأ" marker instead,
because a `.filter()` here would hide exactly the leak worth catching. The mock
strips them the way the server does, and the routing spec asserts the operator's
note in the fixture does not reach a user's screen.

#### The console, and the permission split inside `resolve`

```
GET  /admin/complaints?status=&category=&overdue=true&assignedToId=
GET  /admin/complaints/:id
POST /admin/complaints/:id/messages    multipart; isInternal is the string "true"
POST /admin/complaints/:id/assign
POST /admin/complaints/:id/resolve     final — a second attempt is 409
POST /admin/complaints/:id/close       note ≥ 10
```

The queue is ordered by `slaDueAt`, most overdue first, and **no column offers
to re-sort it** — "who has waited longest for an answer we promised" is the
question the screen exists to answer. Every row carries `isOverdue`, which the
adapter defaults to `false` rather than letting `undefined` reach a template
that paints a row red.

`complaints:manage` opens all of it — **except** a resolution that moves money:

| Resolution                           | Needs                                 |
| ------------------------------------ | ------------------------------------- |
| `NO_ACTION` `PAYOUT_HOLD`            | `complaints:manage`                   |
| `BOOKING_CANCELLED` `UNIT_SUSPENDED` | `complaints:manage`                   |
| `REFUND` `REFUND_AND_CANCEL`         | `complaints:manage` + `refunds:issue` |

So the operations supervisor can cancel a booking, suspend a listing and freeze
a transfer, and cannot move a single halala. Practically only `SYSTEM_ADMIN`
holds both. The two refunding options are **disabled in the select** rather than
offered — the server refuses them regardless, but meeting a 403 after typing an
amount, a method and a bank reference is not the same as being told at the start.

The finance officer, who _does_ hold `refunds:issue`, is refused the queue
outright: holding half the pair opens nothing. Asserted in `admin.routing.spec`.

An **internal note does not stop the SLA clock** and does not move the status.
Only a real reply does — which is why the console re-reads the queue after a
reply and not after a note, and why the toggle says so on the control itself.

Refund failures all leave the complaint open with no money moved, so each ends
in a form that can be corrected:

- 422 `REFUND_EXCEEDS_PAYMENT` carries `meta.remaining` — put on screen, which
  turns a rejection into an instruction.
- 422 for a missing amount, or `MANUAL_TRANSFER` with no `refundReference`.
- 409 `REFUND_NO_CAPTURED_PAYMENT`.
- 502 `REFUND_GATEWAY_FAILED` — "حاول مرة أخرى", never "تم".

`close` is a separate call from `resolve`, not a resolution value. "How many
complaints did we settle" is a question a report will be asked, and closing a
duplicate settled nothing.

### Notifications are actually sent now

The bell and SMS, both from the same event. **Both writes are `PUT`, not
`POST`** — a `POST` is a 404, which is worth writing down because it looks
exactly like an unshipped endpoint.

```
GET /me/notifications?unreadOnly=true&page=1&pageSize=20
PUT /me/notifications/:id/read      → { read: true, unreadCount: 2 }
PUT /me/notifications/read-all      → { read: 5,    unreadCount: 0 }
```

**`unreadCount` comes back on every call**, including the two writes, so the
badge is corrected by the same response that did the work. The client keeps a
local copy only so the number moves the instant somebody opens a notification —
and every path out of that ends on the server's figure, **including the failing
one**. A rollback was missing there: the docstring claimed one and the code did
not have it, so a failed mark-read left the badge holding a number nobody sent
until the next load. Fixed, with a spec.

`title` and `body` are translated into the account's **stored** locale, not
`Accept-Language`, so changing the language re-translates the whole history.
Nothing is cached on this side, and a language change re-reads the list rather
than re-rendering it — otherwise Arabic titles sit under an English page.

`reference` is what the notification is _about_, and the client builds the URL:

| `type`      | goes to              |
| ----------- | -------------------- |
| `booking`   | `/my-bookings/:id`   |
| `complaint` | `/my-complaints/:id` |
| `unit`      | `/lessor/units/:id`  |
| `payout`    | `/lessor/earnings`   |

A unit notification is only ever sent to a lessor — approved, rejected,
suspended, reinstated — so it goes to the owner's screen and not the public
listing. A payout has no page of its own; the transfer reference in the body is
matched up on the earnings screen.

`reference` can be `null`, and an unknown `type` gets **no link** rather than a
guessed one. Both used to fall back to `/my-bookings`, which sent a lessor whose
listing had just been approved to a screen they do not have. Those rows are now
a button that marks the notification read and goes nowhere.

Marking read twice is a 200; the client still skips the request for a row it
already knows is read, to save the round trip rather than to avoid a failure.

**The duplicate-row bug they fixed while writing the handover:** one event is
stored twice, once for the bell and once for the SMS, so a channel can fail on
its own. The bell was returning both. Nothing is de-duplicated on this side —
a short, SMS-shaped title turning up in the inbox is a server bug to report,
and hiding it here would make it invisible.

SMS is sent server-side; there is nothing to do for it. In development it only
prints to the server log.

### The console — every screen, and the permission on each

**There is no single "is this an admin?" check on the router**, and there must
not be one: each group carries its own permission, so the three administrators
genuinely see three different consoles. The navigation is built from
`permissions[]`, never from `adminRole`.

| Route                       | Permission           | Held by                       |
| --------------------------- | -------------------- | ----------------------------- |
| `/admin/users`              | `users:manage`       | `SYSTEM_ADMIN` + `OPERATIONS` |
| `/admin/audit`              | `audit:view`         | `SYSTEM_ADMIN`                |
| `/admin/reports`            | `reports:view`       | all three                     |
| `/admin/reference-lists`    | `reference:manage`   | `SYSTEM_ADMIN` + `OPERATIONS` |
| `/admin/content`            | `cms:manage`         | `SYSTEM_ADMIN` + `OPERATIONS` |
| `/admin/financial-settings` | `settings:financial` | `SYSTEM_ADMIN` + `FINANCE`    |

#### Accounts

```
GET  /admin/users?role=&adminRole=&status=&verificationStatus=&search=&page=
GET  /admin/users/:id                    carries an `activity` block
POST /admin/users/:id/suspend            { reason, force? }
POST /admin/users/:id/activate           { reason }
POST /admin/users/:id/identity           { approve, reason? }
```

`search` covers the name, the mobile and the email. **Not the national id** —
encrypted, and partial search of it is impossible by design.

Three absences are the contract, not gaps: **nothing edits a name, a mobile or
an email**; an administrator cannot be suspended
(`ADMIN_CANNOT_SUSPEND_ADMIN`); and nobody can act on themselves
(`ADMIN_CANNOT_ACT_ON_SELF`). The console hides those buttons rather than
disabling them — a greyed control still reads as "one day".

Suspension **revokes every session immediately**, so the five `activity` counts
sit _above_ the button rather than in a confirmation after it. A dialog that
reveals the cost once the intent is formed asks somebody to change their mind;
showing it first lets them make it up.

While bookings are live the server refuses once — 409
`ADMIN_USER_HAS_ACTIVE_BOOKINGS` with `meta.liveBookings` — and only then is
`force` offered, which is what makes the second press a decision rather than a
retry. The client never sends `force` on the first attempt.

`verificationProvider` is `MANUAL` today and `NAFATH` later. It is shown, not
hidden: an identity a person approved by eye is a different assurance from one
Nafath returned.

#### The audit trail

`GET /admin/audit` (**not** `/admin/audit-log`) and `GET /admin/audit/actions`,
the latter read from the data so a newly-recorded action appears in the filter
without a release here.

`oldValue` → `newValue` are shown side by side, because that pair is the point:
"somebody changed the commission" is a rumour, "this person changed it from 15%
to 5% at 14:12" is a record. `actor` can be `null` — a background job, or an
account since removed — and the screen answers with a dash rather than
inventing a name.

`from`/`to` are plain `YYYY-MM-DD` and `to` covers its whole day. **No export**,
deliberately; ask before building one.

#### Reports — and the one number that must not be mislabelled

```
GET /admin/reports/overview            no date filter, on purpose
GET /admin/reports/bookings?from=&to=  grossHalalas  ← NOT revenue
GET /admin/reports/revenue?from=&to=   commissionHalalas ← revenue
GET /admin/reports/lessors?page=
```

`grossHalalas` is what renters paid. Most of it is owed to lessors, some is VAT
owed to ZATCA, and only the commission is income. The screen labels it "إجمالي
ما دفعه المستأجرون" with the caveat under it, and puts `commissionHalalas` in
its own card as "إيراد المنصة". `owedToLessorsHalalas` and `vatPayableHalalas`
are marked as liabilities rather than listed beside the income as though they
were more of it.

The overview carries **every** key with zeros, so nothing needs `?? 0` — and a
`?? 0` would hide a block the server stopped sending. `complaints.overdue` sits
in the same object as the five statuses and is **not** one of them: an overdue
complaint is also `OPEN` or `IN_PROGRESS`, so it is displayed separately or the
column stops adding up.

#### Settings

`GET /admin/settings?group=` · `PUT /admin/settings/:key { value }`.

**The value is always a string**, whatever the setting is: `"1500"`, `"true"`.
The server parses against `dataType` and 422s if it will not convert. The
client picks the input from `dataType` and sends the text back untouched —
converting here would mean converting back on the way in, and one more place
for a boolean to become the string `"false"` and then be truthy.

**The permission depends on the group, not the screen.** `financial` needs
`settings:financial`; every other group needs `settings:manage`; neither
contains the other. So the finance officer opens the page, reads all of it, and
can change one tab — and the system administrator can change the other four.
Read from the row (`settingWritePermission`), never from the tab or the URL.

`isEditable: false` renders read-only; writing anyway is a 409.

#### Reference data

`GET /admin/reference` returns all four lists at once, active and inactive
together — one call, so the districts on screen always belong to the city list
beside them.

**There is no delete, and no method for one.** Entries are deactivated, because
listings and bookings written years ago still point at them. A category with
published listings under it will not even deactivate: 409 `CATEGORY_IN_USE`
with `meta.requested`, and that number goes on screen — "٣١ إعلان منشور تحت هذا
التصنيف" tells an operator what to do next where "تعذّر التعطيل" does not.

A category's `slug` is the stable identifier: renaming "مستودعات" to "مخازن"
must not change what a saved filter matches.

#### Content, and the public side

`POST /admin/cms/pages` needs every field; `PUT /admin/cms/pages/:id` is a
partial, keyed by **id** rather than slug because the slug is editable and a
route keyed on an editable field renames itself.

Publishing is `{ "isPublished": true }` and nothing else. Sent as its own
button, not "save and publish": two people with the editor open would otherwise
have one publish a stale body over the other's correction.

`GET /public/pages`, `/public/pages/:slug`, `/public/settings` need no token.
An unpublished slug is **404, not 403** — anybody who can tell "exists but
hidden" from "does not exist" can learn what is being drafted. `ContentService`
already treats any failure the same way and falls back to the bundled copy.

`/public/settings` returns values **already converted** — numbers as numbers,
unlike the administrator's string-valued view. Read it instead of hard-coding a
page size or a hold length.

## Verified 2026-08-30 — where the handover and the server disagree

The server moved to `192.168.1.17:4000`. Everything below was probed live; the
security behaviour all held, and the shapes did not.

### What was right

`FINANCE` is refused the complaints queue (403) and `OPERATIONS` is not.
`OPERATIONS` resolving with `REFUND` is a 403 and with `NO_ACTION` is a 200 —
the permission split inside `resolve` works exactly as described. Resolving
twice is `COMPLAINT_ALREADY_RESOLVED`. `COMPLAINT_MESSAGE_EMPTY` on an empty
reply. The 409 on a second complaint carries `meta.complaintId` **and**
`meta.reference`. **An internal note does not reach `/me`** — checked directly,
and it is the one thing here worth checking directly.

Notifications are exactly as documented: `unreadOnly`, `unreadCount` on every
response including the writes, `PUT` (a `POST` is a 404), marking twice is a
200, and `reference.type: 'complaint'` deep-links.

### Ten places the shapes differ

1. **`POST .../messages` answers `{ message }`, not `{ complaint }`.** The
   client was reading `response.complaint` and would have thrown on the first
   reply anybody sent. Both services now re-read the complaint afterwards,
   which is needed anyway: the status the reply moves (`AWAITING_USER` back to
   `IN_PROGRESS`) is only visible on a re-read.
2. **Messages have `senderType`, not `authorName`**, and `createdAt`, not
   `sentAt`. No name at all — which is right rather than missing: a renter must
   not be shown which operator answered, and the owner's name is not theirs to
   see. The thread says "الدعم" / "المستأجر" / "المؤجّر".
3. **`booking.unit.title`**, nested — not a flat `unitTitle`. The booking also
   carries its status, dates and total.
4. **No `isOverdue`.** `?overdue=true` filters on it but the flag is not sent,
   so the console derives it: `slaDueAt` past with `firstResponseAt` still
   null. Keyed on the response and not the status, or every old open complaint
   would read as late forever. **This is the client's arithmetic** and the one
   field that could disagree with the server's filter.
5. **No complaint-level `attachments`.** Photos sent when raising it are on the
   **first message**. Attachment `url` is `/uploads/…`, relative to the API's
   origin — it needs the same prefixing as unit images.
6. **No `refunds[]`.** A refund reads as the resolution; nothing here invents a
   ledger the server does not keep. `assignedToId`, not a name — so a screen
   can say _whether_ it is assigned, not to whom.
7. **`multipart` is not mandatory.** JSON is accepted for both writes. The
   client still sends multipart always, so there is one path rather than two
   and only one of them exercised.
8. **Audit `oldValue`/`newValue` are objects**, not rendered text —
   `{status:'OPEN'}` → `{status:'RESOLVED', resolution:'NO_ACTION', …}`.
   `{{ oldValue }}` on one is `[object Object]`, so they are rendered as
   `field: value` lines. `/admin/audit/actions` likewise returns
   `{action, entityType}` objects, not strings. The route is `/admin/audit`,
   and there is no per-entry route — the list carries every field.
9. **Settings**: wrapped in `items`, `dataType` is `INTEGER`/`STRING`/
   `BOOLEAN` (uppercase, and `INTEGER` not `NUMBER`), and the keys are
   `commission.default_rate_bps`, `vat.rate_bps`, `complaint.sla_hours`,
   `booking.hold_minutes` — not the `finance.*` names guessed here. A key that
   does not match falls silently back to a compiled-in default, so the screen
   looks right while being stale. Groups present: `booking`, `financial`,
   `operations`.
10. **The overview buckets are partial**, not "every key with zeros": `GUEST`
    never appears under `byRole` and only the booking statuses that exist are
    listed. Every screen iterates what it is given. `/admin/reports/bookings`
    answers `bookingsCount` (not `count`) plus `expectedCommissionHalalas`,
    `lessorShareHalalas`, `averageBookingHalalas`, `averageDays` and
    `topCities`; `/admin/reports/lessors` rows are
    `{ lessor: {id, fullName}, units, bookings, grossHalalas, earnedHalalas }`.

### Smaller ones

- `/admin/users` rows carry a nested **`identity`** object
  (`idNumberLast4`, `verificationStatus`, `verificationProvider`,
  `rejectionReason`) rather than a flat `verificationStatus`, plus
  `suspendedReason` and the account's `permissions`. `activity` is on the
  detail only, as documented.
- **`/admin/reference` does not return `districts`** — only categories, cities
  and prohibited items, though the create and update routes for a district
  exist. Modelled as `null` rather than `[]`, because "the server has none" is
  a different claim from "the server did not say", and the screen says which.
- `/admin/cms/pages` and `/public/pages` answer `{ items }`, not `{ pages }`,
  and both are currently empty — so every content page is still served from the
  bundle.
- `/public/settings` is wrapped: `{ settings: { … } }`, values already
  converted (`booking.hold_minutes: 15` as a number).
- `expectedCommissionHalalas` on the bookings report is **before** refunds;
  `commissionHalalas` on the revenue report is net of them. They are different
  numbers and only the second is revenue.

### Still open

- No `operations.approval_sla_hours` and no payout-cycle setting, so the
  listing-review deadline and the transfers header run on compiled-in defaults.
- `isOverdue` would be better sent than derived — the client's answer and
  `?overdue=true` can disagree.
- A `senderName` is deliberately absent and should stay absent, but an operator
  reading the console cannot tell two colleagues apart in a thread.

## 2026-09-03 — the public host

The server moved off the LAN to `http://179.198.199.243/api/v1`, which is the
only line `environment.local-api.ts` should ever need to change.

Probed the day it arrived, and **it does not answer yet**: `/` serves the
default nginx welcome page and every `/api/v1/…` path is nginx's own 404, so
the reverse proxy is not routing to the application. Port 4000 refuses the
connection.

Three things follow from the origin, and each fails quietly rather than loudly:

- **`/uploads` is on the same origin.** `fileUrl()` builds it off the API's
  origin, not off `/api/v1`, so nginx has to serve both or every photo in the
  product is a broken image that reads as an upload fault.
- **It is `http`.** A client served over `https` cannot reach it at all — the
  browser blocks mixed content before the request is made and reports it only
  in the console. The token and the password also travel in the clear, which is
  acceptable for testing and not past it.
- **CORS has to name `http://localhost:4200`**, with `Authorization` allowed.

`environment.ts` still points at `https://api.hayzak.sa/api/v1`. It has been
left alone deliberately: an http IP is not what a production build should ship
against, and a build serving the app over https could not call it anyway.

### The return URL carries the booking id

`pay()` now sends `…/bookings/return?bookingId=<id>` rather than the bare path.

The return page does not believe the gateway's `status` — it reads the booking
and re-reads it while the webhook is in flight — so **without an id it has
nothing to read and renders its error state after the money has moved**. Tap
appends its own charge reference on the way back, never ours. The fixtures did
append `bookingId`, and the routing spec opened the URL with it already there,
which is why a flow that could not work in production had passing tests over it.
