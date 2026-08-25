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

| Mobile     | Role   | What it is for                                     |
| ---------- | ------ | -------------------------------------------------- |
| 0500000001 | RENTER | the ordinary case                                  |
| 0500000002 | LESSOR | has a bank account                                 |
| 0500000003 | LESSOR | `mobileVerifiedAt: null` — lands on `/auth/verify` |
| 0500000004 | ADMIN  | the console                                        |
| 0500000005 | RENTER | `SUSPENDED` — 403 `ACCOUNT_SUSPENDED`              |

Five states, not five people. The database is shared: five wrong passwords lock
an account for fifteen minutes, so tell the backend rather than waiting it out.

## Three places the server differs from the written guide

These are not opinions — they are what the responses contain.

**1. Lists nest everything inside `data`.** The guide says rows in `data` and
counts in `meta.pagination`. The server sends:

```json
{ "success": true, "data": { "items": [...], "pagination": {...} } }
```

There is no `meta` key at all. `ApiService.list()` reads the server's shape and
tolerates a bare array, so whichever way this is settled the client keeps
working.

**2. The page-size parameter is `pageSize`, not `limit`.** `?limit=2` is
silently ignored and twelve rows come back. Sending an ignored parameter is
worse than an error: the page looks like it worked.

**3. `pagination` has no `hasNextPage` or `hasPrevPage`.** The guide says to
drive infinite scroll from `hasNextPage`. The client derives it from
`page < totalPages`, which is the same fact.

## One conflict worth a decision before launch

**The server has one `ADMIN` role; the console needs three.** The client's
permission matrix distinguishes مدير النظام, مشرف العمليات and المسؤول المالي,
and the console's navigation, its route guards and its screens are all built on
that distinction — the client asked for the three by name.

Until the API splits them, everyone the server calls `ADMIN` is mapped to
`SystemAdministrator`, which is the widest of the three, so nobody is locked
out of a screen they should have. That is a **deliberate over-grant**: an
operations supervisor currently holds finance permissions, which is a real
segregation-of-duties problem rather than a cosmetic one. It needs either three
role values on the wire or a permissions array on the user.

## Shapes worth knowing

- `register` returns **no tokens** — the account is `PENDING_VERIFICATION` and
  `verify-mobile` is what mints the first pair.
- `reset-password` returns no tokens either: every session including this one is
  revoked, so the only correct next screen is sign-in.
- `logout` takes the **refresh** token, not a bearer.
- `GET /auth/me` answers `{ user }`, not a bare user.
- `login` succeeds for an unverified account. Read `mobileVerifiedAt` and route
  to `/auth/verify` — every transactional endpoint refuses them until then.
- Reference rows carry `nameAr` **and** `nameEn` together, so a language switch
  re-renders rather than re-fetching. `/public/cities` nests its districts, so
  there is no separate districts request.
- `devCode` comes back on OTP responses in development. Nothing branches on it.
- The mobile is normalised server-side: `0512345678` comes back
  `+966512345678`. The client sends what the user typed and validates nothing
  about its shape — a client-side check would only reject numbers the API takes.
