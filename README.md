# HAY-ZAK — حَيِّزك

Storage-space rental marketplace for the Kingdom of Saudi Arabia.
Angular 20 — standalone components, signals, lazy-loaded features.

Built against **HAY-ZAK SRS v1.0 (EN)**. Requirement identifiers (`FR-BKG-05`,
`NFR-SEC-02`, …) appear in code comments wherever a rule comes straight from the
spec, so any behaviour can be traced back to the clause that demanded it.

## Requirements

- Node **≥ 20.19** (repo pins 22 via `.nvmrc`)
- npm ≥ 10

## Getting started

```bash
npm install
npm start          # http://localhost:4200
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Dev server (uses `environment.development.ts`) |
| `npm run build` | Production build |
| `npm test` / `npm run test:ci` | Unit tests (Karma + Jasmine) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run analyze` | Production build with `stats.json` |

## Structure

```
src/
  app/
    core/        # singletons: services, guards, interceptors, models, utils
    shared/      # reusable components, directives, pipes, validators
    features/    # one lazy-loaded folder per SRS module
      auth/  marketplace/  booking/  lessor/  admin/  content/
    layout/      # public / dashboard / admin shells
  environments/  # per-configuration settings (swapped at build time)
  styles/        # abstracts, base, themes
docs/
  route-map.md   # planned routing tree with guards, derived from SRS §5
```

### Dependency rules

- `core` and `shared` never import from `features` — enforced by ESLint.
- A feature never imports from another feature; lift shared code up instead.
- `shared` holds no business logic and makes no HTTP calls.

## Path aliases

`@app/*`, `@core/*`, `@shared/*`, `@features/*`, `@layout/*`, `@env/*`, `@assets/*`

```ts
import { AuthService } from '@core/services/auth.service';
import { calculatePrice } from '@core/utils/money.utils';
```

## Domain layer

The parts of the SRS that will not change when the design lands are already
encoded and unit-tested:

| Concern | Where | Spec |
| --- | --- | --- |
| Booking state machine | [booking-transitions.ts](src/app/core/constants/booking-transitions.ts) | §6 |
| Permission matrix | [permissions.ts](src/app/core/constants/permissions.ts) | §5 |
| Price / commission / VAT | [money.utils.ts](src/app/core/utils/money.utils.ts) | FR-BKG-02, FR-PAY-04 |
| Entities and API contracts | [core/models/](src/app/core/models/) | §7 ERDs |
| Endpoint map | [api-endpoints.ts](src/app/core/constants/api-endpoints.ts) | §4 |
| Business constants | [app.constants.ts](src/app/core/constants/app.constants.ts) | §2.4, FR-BKG-05, FR-UNT-02 |
| Saudi validators (IBAN, mobile, ID) | [saudi.validators.ts](src/app/shared/validators/saudi.validators.ts) | FR-LSR-02, FR-AUTH-02 |

The state machine is the one to read first — SRS §6 calls it the heart of the
system, and every state-changing action must go through `canTransition()`.

## HTTP

Call the backend through `ApiService`, which prefixes `environment.apiUrl`,
cleans query params and unwraps the `ApiResponse<T>` envelope.

Three interceptors run on every request — global spinner, bearer token, error
normalisation. Opt out per request with an `HttpContext` token:

```ts
this.api.get<Unit[]>(API_ENDPOINTS.marketplace.search, {
  context: new HttpContext().set(SKIP_LOADING, true).set(SKIP_ERROR_TOAST, true),
});
```

## Localisation

Arabic is the default and the document direction is RTL (`LOCALE_ID: 'ar-SA'`,
`DEFAULT_CURRENCY_CODE: 'SAR'`). English is a functionally identical version,
not an abridged one (SRS §2.5) — but whether it ships in Phase 1 is still an
open client decision (§15 item 9). Translation files live in
[src/assets/i18n/](src/assets/i18n/); no i18n library is wired up yet, pending
that decision.

## Styling

Global tokens live in [src/styles/](src/styles/); `src/styles` is on the SCSS
include path, so from any component:

```scss
@use 'abstracts' as a;

.card {
  @include a.card;
  padding: a.$space-4;
}
```

Colours are CSS custom properties so `ThemeService` can flip light/dark at
runtime. **The palette is a placeholder** — final brand identity is open
(§15 item 11); swapping the six brand tokens in
[_tokens.scss](src/styles/themes/_tokens.scss) re-skins the whole app.

## Lessor portal — implemented screens

The whole of the first design file (`docs/design/lessor-portal-spaces-requests.html`)
is built:

| Screen | Route | Design ref |
| --- | --- | --- |
| المساحات المسجّلة | `/lessor/units` | LSR-02 |
| إضافة / تعديل مساحة (3 خطوات) | `/lessor/units/new`, `/lessor/units/:id/edit` | LSR-03 |
| تفاصيل المساحة | `/lessor/units/:id` | — |
| الطلبات الواردة | `/lessor/requests` | LSR-05 |
| تفاصيل الطلب | `/lessor/requests/:id` | LSR-06 |
| المستحقات | `/lessor/earnings` | LSR-07 |
| الإشعارات | `/lessor/notifications` | LSR-10 |

And the whole of the second file (`docs/design/lessor-portal-login-account.html`):

| Screen | Route | Design ref |
| --- | --- | --- |
| لوحة التحكم | `/lessor/dashboard` | LSR-01 |
| البيانات البنكية | `/lessor/bank-account` | LSR-08 |
| الملف الشخصي والإعدادات | `/lessor/account` | LSR-09 |
| تسجيل مؤجر جديد | `/auth/register` | LSR-00أ |
| التحقق برمز OTP | `/auth/verify` | LSR-00ب |
| تسجيل الدخول | `/auth/login` | LSR-00ج |

Both design files are complete. Still stubbed: `/auth/forgot-password`,
`/auth/reset-password` and the CMS pages the footers link to (`/pages/:slug`) —
they have no design yet.

## Design copy corrected

The design has a few duplicated or truncated strings that read as slips rather
than intent. Corrected in the implementation, listed here so the designer can
confirm:

- "تسجيل تسجيل دخول المؤجر" → "تسجيل دخول المؤجر"
- "تسجيل الدخولك بحساب المؤجر" → "ادخل إلى حسابك…"
- "ما لديك حساب بالفعل؟" on the login screen → "ليس لديك حساب؟"

## Design-vs-SRS discrepancies found while building

Recorded rather than silently resolved. Each needs a one-line decision.

1. **Commission rate** — the design shows **5%**; `FINANCIAL_DEFAULTS.commissionRate`
   is 10%. Neither is confirmed (§15 #3), so the number stays configurable and
   the mock uses the design's 5% to match the reviewed figures.
2. **VAT on the lessor's side** — the design's amount breakdown is
   `قيمة الحجز − عمولة = صافي المستحقات` with **no VAT line at all**, while SRS §10
   charges 15% VAT on the service. The models carry `vatAmount` either way; what
   the lessor *sees* follows the design.
3. **Payout statuses** — the design renders three (`محوّل` / `قيد التنفيذ` / `مجمّد`);
   `PayoutStatus` has five, adding `Due` and `Failed`. Kept all five, because the
   design's own note says the rows were dropped to keep the mock totals
   consistent, not to remove the states.
4. **Extra unit fields** — the design's step 1 has `الدور` and `مزايا المساحة`,
   absent from SRS §4.3. Added as optional (`Unit.floor`, `Unit.perks`).
5. **Category spelling** — the design writes both `قراج` and `جراج`. The UI reads
   categories from the API, so this only matters for the seed data (§15 #8).

## Open items that affect this code

These are unresolved in SRS §15 and are wired as configuration rather than
hard-coded, so settling them is a config change:

1. **Commission rate and who bears it** (§15 #3) — `FINANCIAL_DEFAULTS.commissionBearer`
   supports `lessor` / `renter` / `shared`; all three are tested.
2. **VAT base** — SRS §10 says "VAT on the service" while the ERD carries
   `vat_on_commission`; `FINANCIAL_DEFAULTS.vatBase` supports both readings.
3. **Authorize-then-capture vs pay-then-approve** (§6 critical failure point,
   §15 #2) — `Payment` carries `authorizedAt` and `capturedAt` separately so
   either model fits without a schema change.
4. **Auto-approval** (§15 #7) — `PlatformSettings.autoApproveBookings` exists
   from day one, as SRS §2.1 insists.
5. **Category list** (§15 #8) — `UnitCategoryCode.Garage` is the SRS's reading of
   the transcribed term "qarashi"; awaiting written confirmation.
6. **Renter "My bookings" page** (§15 #12) — treated as in Phase 1, per the
   SRS recommendation.
