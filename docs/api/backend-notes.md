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
public     3 — categories, cities (districts nested), prohibited-items
me         2 — GET /me, PATCH /me, GET /me/notifications
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

**4. Nothing can mark a notification read.** `GET /me/notifications` carries
`readAt` and `unreadCount`, but `/me/notifications/:id/read` and `/read-all`
both 404, so `readAt` is set by nothing and the badge can never be cleared. The
client marks read locally and the state is lost on reload, which is at least
visibly wrong rather than invisibly wrong.

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
