# features

One folder per SRS module, each lazy-loaded from its own `*.routes.ts`.

| Folder | SRS module | Covers |
| --- | --- | --- |
| `auth/` | FR-AUTH | register (role selection), login, OTP, password reset, terms acceptance |
| `marketplace/` | FR-MKT | landing page, search + filters, map/list views, unit details |
| `booking/` | FR-BKG, FR-PAY | the four-step wizard, payment result, "My bookings", booking details, invoice, cancellation |
| `account/` | FR-AUTH, FR-NTF | the renter's own profile, identity verification, notification preferences, inbox |
| `lessor/` | FR-LSR, FR-UNT | dashboard, my spaces, add/edit unit, requests, earnings, bank details |
| `admin/` | FR-ADM, FR-RPT | the operations console — KPIs, listing + booking review, complaints, payments, payouts, the four reports, financial settings, users, reference lists, CMS, legal versions, audit trail |
| `content/` | FR-CMS | static pages, how it works, FAQ, terms, privacy, contact |

Each folder holds:

```
pages/        routed components
components/   sub-components used only by this feature
services/     feature-scoped services (call ApiService, never HttpClient directly)
models/       feature-scoped view models
<name>.routes.ts
```

Rule: a feature never imports from another feature — lift the shared piece into
`shared` or `core` instead.

## Route map

Derived from the permission matrix (SRS §5). See
[route-map.md](../../../docs/route-map.md) for the full table with guards.
