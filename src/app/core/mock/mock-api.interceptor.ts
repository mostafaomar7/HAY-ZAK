import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import { BookingStatus } from '../enums/booking-status.enum';
import { PayoutStatus } from '../enums/payment.enum';
import { AvailabilityBlockReason, UnitStatus } from '../enums/unit-status.enum';
import type { ApiSuccess, ListPayload, Pagination } from '../models/api-response.model';
import { accountFor } from './accounts';
import { toWireBlock, toWireUnit } from './wire';
import {
  MOCK_ADMIN_KPIS,
  MOCK_ADMIN_RENTER_DETAIL,
  MOCK_ADMIN_USERS,
  MOCK_ADMIN_USER_DETAIL,
  MOCK_AUDIT_DETAIL,
  MOCK_AUDIT_ROWS,
  MOCK_BOOKING_DETAIL,
  MOCK_BOOKING_QUEUE,
  MOCK_CMS_PAGES,
  MOCK_COMMISSION_EXCEPTIONS,
  MOCK_COMPLAINTS,
  MOCK_COMPLAINT_DETAIL,
  MOCK_REVIEW_UNITS,
  MOCK_PAYMENT_ROWS,
  MOCK_ELIGIBLE_PAYOUTS,
  MOCK_PAYOUTS,
  MOCK_REF_LISTS,
  MOCK_SETTINGS,
  MOCK_REPORT_BOOKINGS,
  MOCK_REPORT_OCCUPANCY,
  MOCK_REPORT_PAYOUTS,
  MOCK_REPORT_REVENUE,
  MOCK_TERMS_APPROVALS,
  MOCK_TERMS_VERSIONS,
} from './admin.fixtures';
import {
  MOCK_AVAILABILITY,
  MOCK_BANKS,
  MOCK_BANK_ACCOUNTS,
  MOCK_BOOKINGS,
  MOCK_CATEGORIES,
  MOCK_CITIES,
  MOCK_DISTRICTS,
  MOCK_EARNINGS,
  MOCK_LESSOR_EARNINGS,
  MOCK_LESSOR,
  MOCK_NOTIFICATIONS,
  MOCK_UNITS,
} from './lessor.fixtures';
import {
  MOCK_ALTERNATIVES,
  MOCK_BOOKING_HISTORY,
  MOCK_IDENTITY,
  MOCK_INVOICE,
  MOCK_MARKET_AVAILABILITY,
  MOCK_MARKET_UNITS,
  MOCK_NAFATH_SESSION,
  MOCK_PREFERENCES,
  MOCK_PROHIBITED_ITEMS,
  MOCK_RENTER_BOOKINGS,
  MOCK_RENTER_NOTIFICATIONS,
  MOCK_RENTER_PROFILE,
  MOCK_STATIC_PAGES,
} from './renter.fixtures';
import type { StaticPageSlug } from '../models/content.model';
import type { Unit } from '../models/unit.model';
import type { User } from '../models/user.model';
import { calculatePrice } from '../utils/money.utils';

/**
 * Development-only stand-in for the backend, so the lessor screens can be
 * reviewed against the design before the API exists.
 *
 * Guarded twice: it returns immediately unless `environment.useMockApi` is set,
 * and that flag is false in the production environment file. Delete this folder
 * and the one provider line in app.config.ts once the real API is up.
 *
 * Requests it does not recognise fall through to the network untouched, so
 * pointing `apiUrl` at a partially built backend works — only the unimplemented
 * routes get faked.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMockApi) return next(req);

  const [path, query] = req.url.replace(environment.apiUrl, '').split('?');
  const body = route(path, query ?? '', req.method, req.body);

  if (body === undefined) return next(req);

  // A visible latency, so loading and skeleton states are actually exercised
  // rather than skipped over.
  return of(new HttpResponse({ status: 200, body })).pipe(delay(500));
};

function route(path: string, query: string, method: string, payload: unknown): unknown {
  // ── Session ────────────────────────────────────────────────────────────
  // Whoever signed in last stays signed in, so reloading the profile after an
  // administration login does not silently demote the session to a lessor.
  if (path === API_ENDPOINTS.auth.me) return ok(signedInUser);

  // ── Reference data ─────────────────────────────────────────────────────
  // The public trio, in the server's shape: `data.items`, and cities carry
  // their districts nested rather than behind a second request.
  if (path === API_ENDPOINTS.public.categories) return paginate(MOCK_CATEGORIES);
  if (path === API_ENDPOINTS.public.cities) {
    return paginate(MOCK_CITIES.map((city) => ({ ...city, districts: MOCK_DISTRICTS })));
  }
  if (path === API_ENDPOINTS.public.prohibitedItems) return paginate(MOCK_PROHIBITED_ITEMS);

  if (path === API_ENDPOINTS.reference.categories) return ok(MOCK_CATEGORIES);
  if (path === API_ENDPOINTS.reference.cities) return ok(MOCK_CITIES);
  if (path === API_ENDPOINTS.reference.banks) return ok(MOCK_BANKS);
  if (/^\/reference\/cities\/[^/]+\/districts$/.test(path)) return ok(MOCK_DISTRICTS);
  if (path === API_ENDPOINTS.reference.prohibitedItems) return ok(MOCK_PROHIBITED_ITEMS);

  // ── Renter marketplace (FR-MKT) ────────────────────────────────────────
  if (path === API_ENDPOINTS.marketplace.search) {
    return paginate(filterMarket(query).map(withheldAddress));
  }
  if (/^\/marketplace\/units\/[^/]+\/availability$/.test(path)) {
    return ok(MOCK_MARKET_AVAILABILITY);
  }
  if (/^\/marketplace\/units\/[^/]+\/similar$/.test(path)) {
    const id = path.split('/')[3];
    return ok(
      MOCK_MARKET_UNITS.filter((u) => u.id !== id)
        .slice(0, 4)
        .map(withheldAddress),
    );
  }
  if (/^\/marketplace\/units\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    return ok(withheldAddress(MOCK_MARKET_UNITS.find((u) => u.id === id) ?? MOCK_MARKET_UNITS[0]));
  }

  // ── Renter account (FR-AUTH, FR-NTF) ───────────────────────────────────
  if (path === API_ENDPOINTS.account.profile) return ok(MOCK_RENTER_PROFILE);
  if (path === API_ENDPOINTS.account.identity) return ok(MOCK_IDENTITY);
  if (path === API_ENDPOINTS.account.notificationPreferences) return ok(MOCK_PREFERENCES);
  if (path === API_ENDPOINTS.account.delete && method === 'DELETE') return ok(null);
  if (path === API_ENDPOINTS.auth.nafathStart) return ok(MOCK_NAFATH_SESSION);
  if (/^\/auth\/identity\/nafath\/[^/]+$/.test(path)) {
    // Flips to success after the first poll, so the happy path is reachable
    // without a real Nafath session.
    nafathPolls += 1;
    return ok({
      ...MOCK_NAFATH_SESSION,
      state: nafathPolls > 1 ? 'success' : 'awaiting',
      verifiedName: MOCK_RENTER_PROFILE.fullName,
    });
  }
  if (path === API_ENDPOINTS.auth.forgotPassword || path === API_ENDPOINTS.auth.resetPassword) {
    return ok(null);
  }

  // ── Renter bookings (FR-BKG, FR-PAY) ───────────────────────────────────
  if (path === API_ENDPOINTS.bookings.mine) return paginate(MOCK_RENTER_BOOKINGS);
  if (/^\/bookings\/[^/]+\/complaints$/.test(path) && method === 'POST') return ok(null);
  if (path === API_ENDPOINTS.bookings.quote) return ok(quote(query));
  if (path === API_ENDPOINTS.bookings.base && method === 'POST') {
    return ok(MOCK_RENTER_BOOKINGS[4]);
  }
  if (/^\/bookings\/[^/]+\/confirm$/.test(path)) {
    return ok({
      ...MOCK_RENTER_BOOKINGS[3],
      holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  }
  if (/^\/bookings\/[^/]+\/payment-intent$/.test(path)) {
    return ok({
      bookingId: path.split('/')[2],
      gatewayReference: 'mock-intent',
      clientSecret: 'mock-secret',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  }
  if (/^\/bookings\/[^/]+\/alternative-periods$/.test(path)) return ok(MOCK_ALTERNATIVES);
  if (/^\/bookings\/[^/]+\/history$/.test(path)) return ok(MOCK_BOOKING_HISTORY);
  if (/^\/bookings\/[^/]+\/invoice$/.test(path)) return ok(MOCK_INVOICE);
  if (/^\/bookings\/[^/]+\/cancel$/.test(path)) {
    return ok({ ...MOCK_RENTER_BOOKINGS[7] });
  }

  // ── Admin panel (FR-ADM, FR-RPT) ───────────────────────────────────────
  // A decision verb returns the row it acted on rather than a bare 204: the
  // table refreshes from the response, so the screen and the server cannot
  // disagree about what the new state is.
  if (path === API_ENDPOINTS.admin.dashboard) return ok(MOCK_ADMIN_KPIS);

  if (/^\/admin\/units\/[^/]+\/(approve|reject)$/.test(path)) return ok(null);
  if (/^\/admin\/units\/[^/]+$/.test(path) && method === 'GET') {
    const id = path.split('/')[3];
    const unit = MOCK_REVIEW_UNITS.find((u) => u.id === id) ?? MOCK_REVIEW_UNITS[0];
    return ok(toWireUnit(unit, { detail: true, availability: MOCK_AVAILABILITY }));
  }
  // The queue is this endpoint filtered — there is no /admin/units/pending, and
  // asking for one answers 422 with `pending` read as a unit identifier.
  if (path === API_ENDPOINTS.admin.units && method === 'GET') {
    const status = new URLSearchParams(query).get('status');
    const units = status
      ? MOCK_REVIEW_UNITS.filter((unit) => unit.status === status)
      : MOCK_REVIEW_UNITS;
    return paginate(units.map((unit) => toWireUnit(unit)));
  }

  if (/^\/admin\/bookings\/[^/]+\/review-detail$/.test(path)) {
    const id = path.split('/')[3];
    const row = MOCK_BOOKING_QUEUE.find((r) => r.id === id);
    return ok(row ? { ...MOCK_BOOKING_DETAIL, ...row } : MOCK_BOOKING_DETAIL);
  }
  if (/^\/admin\/bookings\/[^/]+\/(approve|reject)$/.test(path)) return ok(null);

  if (path === API_ENDPOINTS.payments.tracking) return paginate(MOCK_PAYMENT_ROWS);
  if (path === API_ENDPOINTS.payments.eligiblePayouts) return paginate(MOCK_ELIGIBLE_PAYOUTS);
  // Approving answers with the payout it created, so the screen refreshes from
  // the response rather than guessing what the server made.
  if (path === API_ENDPOINTS.payments.payouts && method === 'POST') {
    return ok({ ...MOCK_PAYOUTS[0], id: `po-${MOCK_PAYOUTS.length + 1}` });
  }
  if (path === API_ENDPOINTS.payments.payouts) {
    const status = new URLSearchParams(query).get('status');
    const rows = status ? MOCK_PAYOUTS.filter((p) => p.status === status) : MOCK_PAYOUTS;
    return paginate(rows);
  }
  if (/^\/admin\/payouts\/[^/]+\/paid$/.test(path)) {
    const body = (payload ?? {}) as { bankReference: string };
    return ok({ ...payoutById(path.split('/')[3]), status: PayoutStatus.Paid, ...body });
  }
  if (/^\/admin\/payouts\/[^/]+\/failed$/.test(path)) {
    const body = (payload ?? {}) as { reason: string };
    return ok({
      ...payoutById(path.split('/')[3]),
      status: PayoutStatus.Failed,
      failureReason: body.reason,
    });
  }
  if (/^\/admin\/payouts\/[^/]+\/retry$/.test(path)) {
    return ok({ ...payoutById(path.split('/')[3]), status: PayoutStatus.Approved });
  }
  if (/^\/admin\/payouts\/[^/]+$/.test(path)) return ok(payoutById(path.split('/')[3]));
  if (/^\/admin\/lessors\/[^/]+\/bank-details-demand$/.test(path)) return ok(null);

  if (path === API_ENDPOINTS.reports.bookings) return ok(MOCK_REPORT_BOOKINGS);
  if (path === API_ENDPOINTS.reports.revenue) return ok(MOCK_REPORT_REVENUE);
  if (path === API_ENDPOINTS.reports.payouts) return ok(MOCK_REPORT_PAYOUTS);
  if (path === API_ENDPOINTS.reports.occupancy) return ok(MOCK_REPORT_OCCUPANCY);

  if (path === API_ENDPOINTS.admin.commissionExceptions) {
    if (method === 'GET') return ok(MOCK_COMMISSION_EXCEPTIONS);
    if (method === 'POST') return ok(MOCK_COMMISSION_EXCEPTIONS[0]);
  }
  if (/^\/admin\/settings\/commission-exceptions\/[^/]+$/.test(path)) return ok(null);
  if (path === API_ENDPOINTS.admin.settings && method === 'PUT') return ok(MOCK_SETTINGS);
  if (path === API_ENDPOINTS.admin.settings) return ok(MOCK_SETTINGS);

  if (path === API_ENDPOINTS.admin.users) return paginate(MOCK_ADMIN_USERS);
  if (/^\/admin\/users\/[^/]+\/status$/.test(path)) return ok(null);
  if (/^\/admin\/users\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    const detail = id === MOCK_ADMIN_RENTER_DETAIL.id ? MOCK_ADMIN_RENTER_DETAIL : undefined;
    const row = MOCK_ADMIN_USERS.find((u) => u.id === id);
    return ok(detail ?? (row ? { ...MOCK_ADMIN_USER_DETAIL, ...row } : MOCK_ADMIN_USER_DETAIL));
  }

  if (/^\/admin\/reference\/[^/]+\/order$/.test(path)) return ok(null);
  if (/^\/admin\/reference\/[^/]+\/[^/]+$/.test(path)) return ok(null);
  if (/^\/admin\/reference\/[^/]+$/.test(path)) {
    const kind = path.split('/')[3];
    if (method === 'GET') return ok(MOCK_REF_LISTS[kind] ?? []);
    return ok(null);
  }

  if (path === API_ENDPOINTS.admin.cmsPages) return ok(MOCK_CMS_PAGES);
  if (/^\/admin\/cms\/pages\/[^/]+$/.test(path)) {
    const slug = path.split('/')[4];
    if (method === 'PUT') return ok(null);
    return ok(MOCK_CMS_PAGES.find((p) => p.slug === slug) ?? MOCK_CMS_PAGES[0]);
  }

  if (/^\/admin\/terms\/[^/]+\/approvals$/.test(path)) return ok(MOCK_TERMS_APPROVALS);
  if (/^\/admin\/terms\/[^/]+\/(publish|archive)$/.test(path)) return ok(null);
  if (path === API_ENDPOINTS.admin.termsVersions) {
    if (method === 'GET') return ok(MOCK_TERMS_VERSIONS);
    return ok(MOCK_TERMS_VERSIONS[0]);
  }

  if (path === API_ENDPOINTS.admin.auditLog) return paginate(MOCK_AUDIT_ROWS);
  if (/^\/admin\/audit-log\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    const row = MOCK_AUDIT_ROWS.find((r) => r.id === id);
    return ok(row ? { ...MOCK_AUDIT_DETAIL, ...row } : MOCK_AUDIT_DETAIL);
  }

  if (/^\/admin\/disputes\/[^/]+\/resolve$/.test(path)) return ok(null);
  if (path === API_ENDPOINTS.admin.disputes) return paginate(MOCK_COMPLAINTS);
  if (/^\/admin\/disputes\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    const row = MOCK_COMPLAINTS.find((c) => c.id === id);
    return ok(row ? { ...MOCK_COMPLAINT_DETAIL, ...row } : MOCK_COMPLAINT_DETAIL);
  }

  // ── Content (FR-CMS) ───────────────────────────────────────────────────
  if (/^\/content\/pages\/[^/]+$/.test(path)) {
    const slug = path.split('/')[3] as StaticPageSlug;
    return MOCK_STATIC_PAGES[slug] ? ok(MOCK_STATIC_PAGES[slug]) : undefined;
  }
  if (path === API_ENDPOINTS.content.contact && method === 'POST') {
    return ok({ ticketNo: 'SR-2026-00714' });
  }

  // ── Lessor ─────────────────────────────────────────────────────────────
  if (path === API_ENDPOINTS.lessor.earningsTable) return ok(MOCK_EARNINGS);
  if (path === API_ENDPOINTS.lessor.earnings) {
    return ok({ earnings: MOCK_LESSOR_EARNINGS });
  }
  if (path === API_ENDPOINTS.lessor.dashboard) return ok({ dashboard: dashboard() });

  if (path.startsWith(API_ENDPOINTS.lessor.bankAccounts)) {
    if (method === 'GET') return ok(MOCK_BANK_ACCOUNTS);
    if (method === 'POST' || method === 'PUT') return ok(MOCK_BANK_ACCOUNTS[0]);
  }

  // ── Auth ───────────────────────────────────────────────────────────────
  if (path === API_ENDPOINTS.auth.login || path === API_ENDPOINTS.auth.register) {
    signedInUser = userFor(payload);
    return ok(mockTokens(signedInUser));
  }
  if (path === API_ENDPOINTS.auth.resendOtp) return ok(mockChallenge());
  if (path === API_ENDPOINTS.auth.verifyMobile) {
    return ok(mockTokens(signedInUser));
  }
  if (path === API_ENDPOINTS.auth.changePassword) return ok(null);
  if (path.startsWith(API_ENDPOINTS.auth.me) && method !== 'GET') return ok(null);

  // ── The lessor's own spaces ────────────────────────────────────────────
  // Every one of these is a route the server actually serves, answering in the
  // shape it actually answers in: `unit-wire.ts` is exercised here or nowhere.
  if (/^\/lessor\/units\/[^/]+\/(submit|archive)$/.test(path) && method === 'POST') {
    const unit = unitById(path.split('/')[3]);
    const status = path.endsWith('/archive') ? UnitStatus.Archived : UnitStatus.PendingReview;
    return ok(toWireUnit({ ...unit, status }, { detail: true }));
  }
  if (/^\/lessor\/units\/[^/]+\/blocks\/[^/]+$/.test(path) && method === 'DELETE') {
    return ok(null);
  }
  if (/^\/lessor\/units\/[^/]+\/blocks$/.test(path) && method === 'POST') {
    const block = (payload ?? {}) as { startDate: string; endDate: string; note?: string };
    return ok(
      toWireBlock({
        id: `blk-${block.startDate}`,
        startDate: block.startDate,
        endDate: block.endDate,
        reason: AvailabilityBlockReason.ManualBlock,
        note: block.note ?? null,
      }),
    );
  }
  if (/^\/lessor\/units\/[^/]+\/images\/[^/]+$/.test(path) && method === 'DELETE') {
    return ok(null);
  }
  if (/^\/lessor\/units\/[^/]+\/images$/.test(path) && method === 'POST') {
    // The endpoint answers with the unit's whole image list, not just the new
    // rows — the client reads the order the server assigned.
    return ok({ images: toWireUnit(unitById(path.split('/')[3]), { detail: true }).images ?? [] });
  }
  if (/^\/lessor\/units\/[^/]+$/.test(path) && (method === 'GET' || method === 'PATCH')) {
    const unit = unitById(path.split('/')[3]);
    return ok(toWireUnit(unit, { detail: true, availability: MOCK_AVAILABILITY }));
  }
  if (path === API_ENDPOINTS.lessor.units) {
    // A create answers with the detail shape — pin and images included, the
    // latter empty. The list shape here would hand the form a unit with no
    // `images` array to append the uploads to.
    if (method === 'POST') {
      return ok(toWireUnit({ ...MOCK_UNITS[4], status: UnitStatus.Draft }, { detail: true }));
    }
    if (method === 'GET') return paginate(filterUnits(query).map((unit) => toWireUnit(unit)));
  }
  if (path.startsWith(API_ENDPOINTS.lessor.units) && path.includes('publish-eligibility')) {
    return ok({ allowed: true, reasons: [] });
  }

  if (path.startsWith(API_ENDPOINTS.lessor.bookingRequests) && method === 'GET') {
    return paginate(MOCK_BOOKINGS);
  }

  // ── Notifications ──────────────────────────────────────────────────────
  // Both inboxes are served from the same route; the renter fixtures win when a
  // renter session is active, which in development is the seeded one.
  // Rows and the badge in one response, as the server sends them — a mock that
  // answered with a bare array would let the badge be wired to the wrong number
  // and still look right here.
  if (path === API_ENDPOINTS.me.notifications) {
    const items = [...MOCK_RENTER_NOTIFICATIONS, ...MOCK_NOTIFICATIONS].map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      reference: n.targetUrl ? referenceFor(n.targetUrl) : null,
      readAt: n.isRead ? n.createdAt : null,
      createdAt: n.createdAt,
    }));

    return ok({ items, unreadCount: items.filter((n) => !n.readAt).length });
  }

  // ── Units ──────────────────────────────────────────────────────────────
  // FR-LSR-07 — the screen exists, the endpoint does not yet. Answered here so
  // the demo is whole; against the real server it is a 404.
  if (/^\/lessor\/units\/[^/]+\/suspension-request$/.test(path)) return ok(null);

  // ── Bookings ───────────────────────────────────────────────────────────
  if (/^\/bookings\/[^/]+$/.test(path) && method === 'GET') {
    const id = path.split('/')[2];
    return ok(
      MOCK_RENTER_BOOKINGS.find((b) => b.id === id) ??
        MOCK_BOOKINGS.find((b) => b.id === id) ??
        MOCK_RENTER_BOOKINGS[0],
    );
  }

  return undefined;
}

/** Counts polls so the Nafath card can reach its success state in development. */
let nafathPolls = 0;

/** Survives for the life of the tab, like a real session would. */
let signedInUser: User = MOCK_LESSOR;

/**
 * FR-UNT-11 — the public catalogue never carries the exact address.
 *
 * Enforced here rather than left to the templates, because that is where the
 * real API enforces it: a screen that renders whatever it is handed cannot leak
 * a field it was never sent. Deleting the key, not blanking it, so the type's
 * `undefined` really does mean "not released".
 */
function withheldAddress(unit: Unit): Unit {
  const { addressLine: _addressLine, postalCode: _postalCode, ...rest } = unit;
  return rest;
}

/** FR-MKT-03 → FR-MKT-06 — enough of the filter set to exercise the screen. */
function filterMarket(query: string) {
  const params = new URLSearchParams(query);
  const categories = params.getAll('categoryIds');
  const minPriceHalalas = Number(params.get('minPriceHalalas') ?? 0);
  const maxPriceHalalas = Number(params.get('maxPriceHalalas') ?? Number.MAX_SAFE_INTEGER);
  const minArea = Number(params.get('minArea') ?? 0);
  const maxArea = Number(params.get('maxArea') ?? Number.MAX_SAFE_INTEGER);
  const radiusKm = Number(params.get('radiusKm') ?? Number.MAX_SAFE_INTEGER);
  const sortBy = params.get('sortBy');

  const matched = MOCK_MARKET_UNITS.filter(
    (unit) =>
      (categories.length === 0 || categories.includes(unit.categoryId)) &&
      unit.dailyPriceHalalas >= minPriceHalalas &&
      unit.dailyPriceHalalas <= maxPriceHalalas &&
      unit.areaSqm >= minArea &&
      unit.areaSqm <= maxArea &&
      (unit.distanceKm ?? 0) <= radiusKm,
  );

  if (sortBy === 'priceAsc')
    return [...matched].sort((a, b) => a.dailyPriceHalalas - b.dailyPriceHalalas);
  if (sortBy === 'nearest') {
    return [...matched].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }
  return matched;
}

function quote(query: string) {
  const params = new URLSearchParams(query);
  const unit = MOCK_MARKET_UNITS.find((u) => u.id === params.get('unitId')) ?? MOCK_MARKET_UNITS[0];
  return calculatePrice(unit.dailyPriceHalalas, Number(params.get('daysCount') ?? 1));
}

function filterUnits(query: string) {
  const status = new URLSearchParams(query).get('status');
  return status ? MOCK_UNITS.filter((u) => u.status === status) : MOCK_UNITS;
}

/**
 * What a notification is about, read back out of the fixture's deep link.
 *
 * The API sends the reference and the client builds the URL; the fixtures were
 * written the other way round, so this reverses them rather than rewriting
 * thirty rows to say the same thing twice.
 */
function referenceFor(targetUrl: string): { type: string; id: string } | null {
  const unit = /\/units\/([^/]+)/.exec(targetUrl);
  if (unit) return { type: 'unit', id: unit[1] };

  const booking = /\/(?:my-bookings|booking|requests)\/([^/]+)/.exec(targetUrl);
  return booking ? { type: 'booking', id: booking[1] } : null;
}

/** An unknown id falls back to the first fixture, so no route dead-ends. */
function payoutById(id: string) {
  return MOCK_PAYOUTS.find((payout) => payout.id === id) ?? MOCK_PAYOUTS[0];
}

/** An unknown id falls back to the first fixture, so no route dead-ends. */
function unitById(id: string) {
  return MOCK_UNITS.find((unit) => unit.id === id) ?? MOCK_UNITS[0];
}

/**
 * The landing screen in the shape the server sends it.
 *
 * Every status key is present, zero included — the same promise the API makes,
 * so a screen that read one with `?? 0` would pass here and hide a real gap
 * there.
 */
function dashboard() {
  const units = countBy(Object.values(UnitStatus), MOCK_UNITS);

  return {
    units,
    bookings: countBy(Object.values(BookingStatus), MOCK_BOOKINGS),
    earnings: MOCK_LESSOR_EARNINGS,
    unreadNotifications: MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length,
  };
}

/** Zero for every key, then the ones that occur — never a missing key. */
function countBy<T extends string>(all: T[], rows: readonly { status: T }[]): Record<T, number> {
  const counts = Object.fromEntries(all.map((key) => [key, 0])) as Record<T, number>;
  for (const row of rows) if (row.status in counts) counts[row.status] += 1;
  return counts;
}

/** Which account a sign-in produces — see `accounts.ts` for the directory. */
function userFor(payload: unknown): User {
  return accountFor((payload as { identifier?: string } | null)?.identifier ?? '');
}

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

/**
 * A list, in the shape the backend sends one: the rows and the counts together
 * inside `data`. The fixtures are small enough to return whole, so this reports
 * a single page rather than pretending to slice.
 */
function paginate<T>(items: T[]): ApiSuccess<ListPayload<T>> {
  const pagination: Pagination = {
    page: 1,
    pageSize: items.length || 1,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  return { success: true, data: { items, pagination } };
}

/** The token block the real endpoints return. */
function mockTokens(user: User) {
  return {
    user,
    tokens: {
      accessToken: 'dev-mock-token',
      refreshToken: 'dev-mock-refresh',
      expiresIn: 1800,
      tokenType: 'Bearer' as const,
    },
  };
}

/** The OTP challenge a register or resend answers with, `devCode` included. */
function mockChallenge() {
  return {
    channel: 'SMS' as const,
    destination: '+9665****5678',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resendAfterSeconds: 60,
    devCode: '000000',
  };
}
