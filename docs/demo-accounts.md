# Demo accounts and screen map

Everything below works against the mock API (`environment.useMockApi`), before
any backend exists. **The password is not checked** — type anything. What
decides which account you get is the email or the mobile you sign in with.

The directory is `src/app/core/mock/accounts.ts`. Each account holds exactly one
role, because the product allows exactly one role per account (FR-AUTH-12) — a
demo that showed everything from a single login would be showing something the
platform does not do.

## The five accounts

| Role            | Email                    | Mobile     | Person      | Signs in at    |
| --------------- | ------------------------ | ---------- | ----------- | -------------- |
| مؤجّر (Lessor)  | `saud@example.com`       | 0512345678 | سعود العنزي | `/auth/login`  |
| مستأجر (Renter) | `f.aldosari@example.com` | 0552104478 | فهد الدوسري | `/auth/login`  |
| مدير النظام     | `operations@hayzak.com`  | 0509001122 | محمد الحربي | `/admin/login` |
| مشرف العمليات   | `nouf@hayzak.com`        | 0542208891 | نوف السالم  | `/admin/login` |
| المسؤول المالي  | `reem@hayzak.com`        | 0556403312 | ريم الغامدي | `/admin/login` |

The public login takes the email or the mobile in one field; both resolve to the
same person. The console login takes the email only, as its screen is drawn.

**Any other address signs you in as the lessor.** That is deliberate: a
demonstrator typing a made-up address should still land somewhere, and a mock
that rejected credentials would only be pretending to authenticate.

These five are the same people the console's **المستخدمون** screen lists, so
that screen doubles as the credential list.

## Switching between them

**A login screen only opens when nobody is signed in.** `guestGuard` sends a
signed-in visitor to their own portal instead — the production rule, and the
reason `/admin/login` bounces you into the lessor portal while a lessor session
is live. So switching account is always: sign out, then sign in.

Sign out lives on the account screen of each portal, not in the top bar:

| Signed in as   | Sign out at            |
| -------------- | ---------------------- |
| مستأجر / زائر  | `/account`             |
| مؤجّر          | `/lessor/account`      |
| any admin role | top bar of the console |

**The first load of a fresh browser seeds a lessor session** so the portal can
be walked before anyone types a password (`core/mock/dev-session.ts`). It fires
**once** and records that it has. Sign out and you stay out — reloading does not
hand the session back.

To get all the way back to a blank slate: clear site data for the origin and
reload. That removes the marker too, so the seeded lessor returns.

**The console session expires after 30 minutes**, warned at 28
(`AdminSessionService`). It is admin-only and intentional; if a demo is left
open over a break, expect to sign in again.

## Where each account can go

### Public / renter — `/auth/login` as `f.aldosari@example.com`

| Screen              | Route                      | Needs sign-in |
| ------------------- | -------------------------- | ------------- |
| الرئيسية            | `/`                        | no            |
| نتائج البحث         | `/units`                   | no            |
| تفاصيل المساحة      | `/units/:id`               | no            |
| الصفحات التعريفية   | `/pages/about`             | no            |
| حجز جديد            | `/booking/new/:unitId`     | yes           |
| وصف البضاعة         | `/booking/:id/goods`       | yes           |
| توثيق الهوية (نفاذ) | `/booking/:id/identity`    | yes           |
| الدفع               | `/booking/:id/pay`         | yes           |
| نتيجة الحجز         | `/booking/:id/result`      | yes           |
| حجوزاتي             | `/my-bookings`             | yes           |
| تفاصيل الحجز        | `/my-bookings/:id`         | yes           |
| الفاتورة            | `/my-bookings/:id/invoice` | yes           |
| إلغاء الحجز         | `/my-bookings/:id/cancel`  | yes           |
| حسابي               | `/account`                 | yes           |
| الإشعارات           | `/account/notifications`   | yes           |

### Lessor — `/auth/login` as `saud@example.com`

| Screen        | Route                    |
| ------------- | ------------------------ |
| لوحة المؤجّر  | `/lessor/dashboard`      |
| مساحاتي       | `/lessor/units`          |
| إضافة مساحة   | `/lessor/units/new`      |
| تعديل مساحة   | `/lessor/units/:id/edit` |
| تفاصيل مساحة  | `/lessor/units/:id`      |
| طلبات الحجز   | `/lessor/requests`       |
| تفاصيل الطلب  | `/lessor/requests/:id`   |
| الأرباح       | `/lessor/earnings`       |
| الحساب البنكي | `/lessor/bank-account`   |
| الحساب        | `/lessor/account`        |
| الإشعارات     | `/lessor/notifications`  |

### Console — `/admin/login`

The sidebar shows a role only what it may open, and the route refuses the rest
with `/forbidden`. Both come from the same permission table, so they cannot
disagree.

| Screen              | Route                       | مدير النظام | مشرف العمليات | المسؤول المالي |
| ------------------- | --------------------------- | :---------: | :-----------: | :------------: |
| لوحة التحكم         | `/admin/dashboard`          |      ✓      |       ✓       |       ✓        |
| مراجعة المساحات     | `/admin/listings`           |      ✓      |       ✓       |       —        |
| مراجعة الحجوزات     | `/admin/bookings`           |      ✓      |       ✓       |       —        |
| الشكاوى والنزاعات   | `/admin/complaints`         |      ✓      |       ✓       |       —        |
| متابعة المدفوعات    | `/admin/payments`           |      ✓      |       ✓       |       ✓        |
| التحويلات للمؤجّرين | `/admin/transfers`          |      ✓      |       —       |       ✓        |
| التقارير            | `/admin/reports`            |      ✓      |       ✓       |       ✓        |
| الإعدادات المالية   | `/admin/financial-settings` |      ✓      |       —       |       ✓        |
| المستخدمون          | `/admin/users`              |      ✓      |       ✓       |       —        |
| القوائم المرجعية    | `/admin/reference-lists`    |      ✓      |       ✓       |       —        |
| إدارة المحتوى       | `/admin/content`            |      ✓      |       —       |       —        |
| الشروط والأحكام     | `/admin/terms`              |      ✓      |       —       |       —        |
| سجل التدقيق         | `/admin/audit`              |      ✓      |       —       |       —        |
| مكتبة المكوّنات     | `/admin/library`            |      ✓      |       —       |       —        |

`admin.routing.spec.ts` signs in as each of the three roles and asserts both
halves of that table — that the ticked screens open, and that the others
redirect and are not linked to.

## What is mocked, and what a demonstrator should not promise

- **The OTP accepts any six digits.** No SMS is sent.
- **Nafath completes on its own** after a few seconds of polling. No real
  identity is checked.
- **Payment always succeeds.** There is no gateway behind it.
- **Report export** downloads nothing — the file is the backend's to produce
  (`API_ENDPOINTS.reports.export`).
- **بحث شامل** in the console top bar is not wired to a results screen; the
  design does not contain one. See `docs/design/admin-plan.md` #3.
- **Fixture dates are literals**, not computed from today, so "26 ساعة انتظار"
  reads the same in every screenshot. It will not tick during a demo.
