import { API_ENDPOINTS } from '../constants/api-endpoints';
import { BookingStatus } from '../enums/booking-status.enum';
import { NotificationChannel, NotificationType } from '../enums/operations.enum';
import { UnitStatus } from '../enums/unit-status.enum';
import { VerificationStatus } from '../enums/user-role.enum';
import type { Booking, BookingStatusHistoryEntry } from '../models/booking.model';
import type { IdentityVerification, NafathSession } from '../models/identity.model';
import type { AppNotification } from '../models/operations.model';
import type { WireTaxInvoice } from '../models/tax-invoice';
import type {
  AlternativePeriod,
  NotificationPreference,
  RenterProfile,
} from '../models/renter.model';
import type { ReferenceItem, Unit, UnitAvailabilityBlock } from '../models/unit.model';
import { sarToHalalas } from '../utils/money.utils';

/**
 * Renter-side fixtures, transcribed from the Claude Design export so the screens
 * render the same content the designer reviewed — including the states that are
 * awkward to reach by hand (a booked space, a rejected refund, an expired hold).
 *
 * Development only. See mock-api.interceptor.ts.
 */

const RIYADH: ReferenceItem = { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' };

const district = (nameAr: string, nameEn: string): ReferenceItem => ({
  id: nameEn.toLowerCase(),
  nameAr,
  nameEn,
});

const category = (id: string, nameAr: string, nameEn: string): ReferenceItem => ({
  id,
  nameAr,
  nameEn,
});

const WAREHOUSE = category('warehouse', 'مستودع', 'Warehouse');
const ROOM = category('room', 'غرفة', 'Room');
const GARAGE = category('garage', 'قراج', 'Garage');
// OPEN: the lessor form calls this "مساحة مفتوحة" and the renter prototype calls
// it "مكان مكشوف". The designer's wording is used here; see docs/design/renter-plan.md.
const OPEN_SPACE = category('open_space', 'مكان مكشوف', 'Open space');

/**
 * The stock photographs the design's prototype used, by their Unsplash id.
 *
 * They are placeholders standing in for what lessors will upload, and they are
 * here so a demo shows the catalogue the way the design draws it rather than a
 * grid of empty grey boxes. `images.unsplash.com` is allowed by the CSP in
 * public/.htaccess for the same reason — take both out together once real
 * photographs are being served.
 */
const photo = (unsplashId: string, width = 900): string =>
  `https://images.unsplash.com/${unsplashId}?auto=format&fit=crop&w=${width}&q=75`;

function marketUnit(
  id: string,
  title: string,
  cat: ReferenceItem,
  districtName: [string, string],
  areaSqm: number,
  /** Riyals — see `lessor.fixtures.ts`; converted on the way into the model. */
  dailyPriceSar: number,
  distanceKm: number,
  latitude: number,
  longitude: number,
  perks: string[],
  photos: string[],
  status: UnitStatus = UnitStatus.Published,
  isFullyBooked = false,
): Unit {
  return {
    id,
    lessorId: 'lessor-1',
    categoryId: cat.id,
    category: cat,
    cityId: RIYADH.id,
    city: RIYADH,
    districtId: districtName[1].toLowerCase(),
    district: district(districtName[0], districtName[1]),
    title,
    description:
      'مساحة نظيفة بمدخل واسع وأرضية إسمنتية مستوية، مناسبة للأثاث المنزلي والكراتين ومستلزمات المكاتب. يوجد إضاءة داخلية، والدخول بالتنسيق المسبق مع صاحب المساحة داخل أوقات الزيارة.',
    areaSqm,
    dailyPriceHalalas: sarToHalalas(dailyPriceSar),
    indicativeMonthlyPriceHalalas: sarToHalalas(dailyPriceSar) * 30,
    location: { latitude, longitude },
    isApproximateLocation: true,
    distanceKm,
    // The exact address is present on the fixture; the interceptor strips it
    // from the public catalogue, mirroring what the API does (FR-UNT-11).
    addressLine: `الرياض — ${districtName[0]}، شارع الأمير سلطان، مبنى 42`,
    postalCode: '13323',
    visitSchedule: [
      { days: [0, 1, 2, 3, 4], from: '09:00', to: '21:00' },
      { days: [5], from: '16:00', to: '21:00' },
      { days: [6], from: '10:00', to: '20:00' },
    ],
    minDays: 3,
    maxDays: 90,
    floor: 'ground',
    perks,
    images: photos.map((unsplashId, index) => ({
      id: `${id}-img-${index + 1}`,
      url: photo(unsplashId),
      sortOrder: index + 1,
      // The real figure comes from the upload; nothing on screen reads it.
      sizeBytes: 0,
    })),
    status,
    isFullyBooked,
    createdAt: '2026-07-28T09:00:00Z',
  };
}

/** The six spaces on the design's results board, plus one fully booked. */
export const MOCK_MARKET_UNITS: Unit[] = [
  marketUnit(
    'm-1',
    'مستودع مكيّف — النرجس',
    WAREHOUSE,
    ['حي النرجس', 'Narjis'],
    35,
    75,
    2.4,
    24.83,
    46.64,
    ['مكيّفة', 'مدخل واسع'],
    [
      'photo-1553413077-190dd305871c',
      'photo-1586528116311-ad8dd3c8310d',
      'photo-1601598851547-4302969d0614',
    ],
  ),
  marketUnit(
    'm-2',
    'غرفة تخزين نظيفة — الياسمين',
    ROOM,
    ['حي الياسمين', 'Yasmin'],
    18,
    45,
    3.1,
    24.81,
    46.66,
    ['مدخل مستقل', 'إضاءة داخلية'],
    [
      'photo-1493809842364-78817add7ffb',
      'photo-1558618666-fcd25c85cd64',
      'photo-1553413077-190dd305871c',
    ],
  ),
  marketUnit(
    'm-3',
    'قراج مغلق — الملقا',
    GARAGE,
    ['حي الملقا', 'Malqa'],
    22,
    60,
    1.8,
    24.79,
    46.61,
    ['باب أوتوماتيكي', 'قريبة من الشارع'],
    [
      'photo-1667878604760-ea68d0fd321f',
      'photo-1553413077-190dd305871c',
      'photo-1601598851547-4302969d0614',
    ],
  ),
  marketUnit(
    'm-4',
    'مستودع أرضي — الصحافة',
    WAREHOUSE,
    ['حي الصحافة', 'Sahafa'],
    50,
    95,
    4.2,
    24.82,
    46.68,
    ['أرضية إسمنتية', 'مدخل واسع'],
    [
      'photo-1586528116311-ad8dd3c8310d',
      'photo-1553413077-190dd305871c',
      'photo-1601598851547-4302969d0614',
    ],
  ),
  marketUnit(
    'm-5',
    'مستودع كبير — حطين',
    WAREHOUSE,
    ['حي حطين', 'Hittin'],
    120,
    150,
    7.1,
    24.77,
    46.59,
    ['أرضية إسمنتية', 'إضاءة داخلية'],
    [
      'photo-1587293852726-70cdb56c2866',
      'photo-1586528116311-ad8dd3c8310d',
      'photo-1553413077-190dd305871c',
    ],
  ),
  marketUnit(
    'm-6',
    'مساحة مكشوفة — العارض',
    OPEN_SPACE,
    ['حي العارض', 'Arid'],
    40,
    55,
    9.3,
    24.88,
    46.71,
    ['قريبة من الشارع', 'أرضية إسمنتية'],
    [
      'photo-1524230572899-a752b3835840',
      'photo-1487958449943-2429e8be8625',
      'photo-1586528116311-ad8dd3c8310d',
    ],
  ),
  marketUnit(
    'm-7',
    'مستودع مكيّف — القيروان',
    WAREHOUSE,
    ['حي القيروان', 'Qairawan'],
    28,
    70,
    5.5,
    24.85,
    46.62,
    ['مكيّفة'],
    ['photo-1587293852726-70cdb56c2866', 'photo-1553413077-190dd305871c'],
    // FR-MKT-10 — a booked unit is still listed but cannot be booked now. It
    // stays PUBLISHED: having no free dates is a fact about the calendar.
    UnitStatus.Published,
    true,
  ),
];

/** FR-UNT-08 — five booked days in September, matching the design's calendar. */
export const MOCK_MARKET_AVAILABILITY: UnitAvailabilityBlock[] = [
  {
    id: 'blk-1',
    startDate: '2026-09-20',
    endDate: '2026-09-24',
    reason: 'Booking' as UnitAvailabilityBlock['reason'],
    bookingId: 'rb-9',
  },
];

export const MOCK_PROHIBITED_ITEMS: ReferenceItem[] = [
  {
    id: 'flammable',
    nameAr: 'مواد قابلة للاشتعال أو الانفجار',
    nameEn: 'Flammable or explosive materials',
  },
  { id: 'chemical', nameAr: 'مواد كيميائية خطرة', nameEn: 'Hazardous chemicals' },
  { id: 'illegal', nameAr: 'ممنوعات قانونية', nameEn: 'Legally prohibited items' },
  { id: 'animals', nameAr: 'حيوانات حية', nameEn: 'Live animals' },
  { id: 'perishable', nameAr: 'مواد سريعة التلف', nameEn: 'Perishable goods' },
];

export const MOCK_RENTER_PROFILE: RenterProfile = {
  fullName: 'فهد الدوسري',
  idNumberMasked: '••••••6421',
  address: 'الرياض — حي الملقا، شارع الثمامة، مبنى 42',
  mobile: '0552104478',
  mobileVerifiedAt: '2026-07-24T09:00:00Z',
  email: 'f.aldosari@example.com',
  emailVerifiedAt: '2026-07-24T09:05:00Z',
};

export const MOCK_IDENTITY: IdentityVerification = {
  idNumberMasked: '•••••••1234',
  status: VerificationStatus.Verified,
  verifiedAt: '2026-07-24',
};

export const MOCK_NAFATH_SESSION: NafathSession = {
  requestId: 'nafath-1',
  confirmationNumber: '47',
  state: 'awaiting',
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
};

export const MOCK_PREFERENCES: NotificationPreference[] = [
  { key: 'bookingStatus', enabled: true },
  { key: 'paymentsAndInvoices', enabled: true },
  { key: 'endOfTermReminder', enabled: true },
  { key: 'email', enabled: false },
];

function renterBooking(
  id: string,
  referenceNo: string,
  unit: Unit,
  startDate: string,
  endDate: string,
  daysCount: number,
  status: BookingStatus,
): Booking {
  const subtotalHalalas = unit.dailyPriceHalalas * daysCount;
  const commissionHalalas = Math.round(subtotalHalalas * 0.05 * 100) / 100;

  return {
    id,
    referenceNo,
    unitId: unit.id,
    unit: {
      id: unit.id,
      title: unit.title,
      images: unit.images,
      city: unit.city,
      district: unit.district,
      visitSchedule: unit.visitSchedule,
      // FR-UNT-11 — the address travels with the booking only once approved.
      addressLine:
        status === BookingStatus.Confirmed ||
        status === BookingStatus.Active ||
        status === BookingStatus.Completed
          ? unit.addressLine
          : undefined,
      postalCode:
        status === BookingStatus.Confirmed ||
        status === BookingStatus.Active ||
        status === BookingStatus.Completed
          ? unit.postalCode
          : undefined,
    },
    renterId: 'renter-1',
    startDate,
    endDate,
    daysCount,
    dailyPriceSnapshotHalalas: unit.dailyPriceHalalas,
    subtotalHalalas,
    commissionHalalas,
    // The renter pays the listed rent; commission and its VAT come out of the
    // owner's share, which is what the design's "—" line means.
    vatHalalas: Math.round(commissionHalalas * 0.15 * 100) / 100,
    totalHalalas: subtotalHalalas,
    netToLessorHalalas: Math.round((subtotalHalalas - commissionHalalas * 1.15) * 100) / 100,
    goodsDescription:
      'أثاث منزلي مفكّك يتضمّن غرفة نوم وطاولة طعام وستة كراسي، مع اثني عشر صندوقًا من الأدوات المنزلية والكتب. لا توجد أجهزة تعمل بالوقود.',
    prohibitedAck: true,
    status,
    counterpartyContact:
      status === BookingStatus.Confirmed || status === BookingStatus.Active
        ? { fullName: 'فهد الدوسري', mobile: '0552104478' }
        : undefined,
    holdExpiresAt:
      status === BookingStatus.AwaitingPayment
        ? new Date(Date.now() + 14 * 60_000).toISOString()
        : undefined,
    createdAt: '2026-08-12T09:14:00Z',
  };
}

/** The nine states of the design's "حالات الحجز التسع" board. */
export const MOCK_RENTER_BOOKINGS: Booking[] = [
  renterBooking(
    'rb-1',
    'HZ-2026-04871',
    MOCK_MARKET_UNITS[2],
    '2026-08-12',
    '2026-09-11',
    30,
    BookingStatus.Confirmed,
  ),
  renterBooking(
    'rb-2',
    'HZ-2026-04688',
    MOCK_MARKET_UNITS[0],
    '2026-08-01',
    '2026-08-30',
    29,
    BookingStatus.Active,
  ),
  renterBooking(
    'rb-3',
    'HZ-2026-04903',
    MOCK_MARKET_UNITS[1],
    '2026-08-20',
    '2026-09-03',
    15,
    BookingStatus.Confirmed,
  ),
  renterBooking(
    'rb-4',
    'HZ-2026-04512',
    MOCK_MARKET_UNITS[3],
    '2026-09-05',
    '2026-10-04',
    30,
    BookingStatus.AwaitingPayment,
  ),
  renterBooking(
    'rb-5',
    'HZ-2026-04390',
    MOCK_MARKET_UNITS[5],
    '2026-09-15',
    '2026-09-25',
    10,
    BookingStatus.Draft,
  ),
  renterBooking(
    'rb-6',
    'HZ-2026-04277',
    MOCK_MARKET_UNITS[3],
    '2026-05-01',
    '2026-06-30',
    60,
    BookingStatus.Completed,
  ),
  renterBooking(
    'rb-7',
    'HZ-2026-04155',
    MOCK_MARKET_UNITS[1],
    '2026-06-12',
    '2026-06-26',
    14,
    BookingStatus.Cancelled,
  ),
  renterBooking(
    'rb-8',
    'HZ-2026-03998',
    MOCK_MARKET_UNITS[2],
    '2026-04-03',
    '2026-05-02',
    29,
    BookingStatus.Cancelled,
  ),
  renterBooking(
    'rb-9',
    'HZ-2026-03871',
    MOCK_MARKET_UNITS[4],
    '2026-03-20',
    '2026-03-30',
    10,
    BookingStatus.Expired,
  ),
];

export const MOCK_BOOKING_HISTORY: BookingStatusHistoryEntry[] = [
  { fromStatus: null, toStatus: BookingStatus.Draft, changedAt: '2026-08-12T09:14:00Z' },
  {
    fromStatus: BookingStatus.AwaitingPayment,
    toStatus: BookingStatus.Confirmed,
    changedAt: '2026-08-12T09:26:00Z',
  },
  {
    fromStatus: BookingStatus.Confirmed,
    toStatus: BookingStatus.Confirmed,
    changedBy: 'ops-1',
    changedAt: '2026-08-12T13:40:00Z',
  },
];

/**
 * The wire shape, not the domain one — the interceptor stands in for the
 * server, so it has to send `daysCount` and the nested booking exactly as
 * `/renter/bookings/:id/invoice` does, or the adapter is never exercised.
 */
export const MOCK_INVOICE: WireTaxInvoice = {
  id: 'inv-1',
  invoiceNo: 'INV-2026-04871',
  issuedAt: '2026-08-12T09:20:00.000Z',
  taxableHalalas: 180000,
  vatHalalas: 0,
  totalHalalas: 180000,
  // Zero on the running server too — the platform is not charging VAT on rent.
  vatRateBps: 0,
  // Null as the server sends it; the QR is not generated yet.
  qrCode: null,
  booking: {
    id: 'rb-1',
    referenceNo: 'HZ-2026-000481',
    startDate: '2026-08-12',
    endDate: '2026-09-11',
    daysCount: 30,
    unit: { id: 'u-1', title: 'مستودع مكيّف في حي العليا' },
  },
};

export const MOCK_ALTERNATIVES: AlternativePeriod[] = [
  { startDate: '2026-09-15', endDate: '2026-10-14', daysCount: 30, totalHalalas: 225000 },
  { startDate: '2026-09-20', endDate: '2026-10-04', daysCount: 15, totalHalalas: 112500 },
  { startDate: '2026-10-01', endDate: '2026-12-30', daysCount: 90, totalHalalas: 765000 },
];

export const MOCK_RENTER_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'rn-1',
    type: NotificationType.BookingApproved,
    title: 'اعتُمد حجزك في قراج الملقا',
    body: 'ظهر العنوان الدقيق في تفاصيل الحجز، وتبدأ المدة اليوم.',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/my-bookings/rb-1',
    createdAt: '2026-08-12T13:40:00Z',
  },
  {
    id: 'rn-2',
    type: NotificationType.BookingPaid,
    title: 'استُلم مبلغ 1,800.00 ر.س',
    body: 'صدرت الفاتورة INV-2026-04871 وأصبحت متاحة للتحميل.',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/my-bookings/rb-1/invoice',
    createdAt: '2026-08-12T09:26:00Z',
  },
  {
    id: 'rn-3',
    type: NotificationType.BookingStartReminder,
    title: 'حجز بانتظار الدفع في مستودع الصحافة',
    body: 'أكمل الدفع لتثبيت الفترة من 5 سبتمبر إلى 4 أكتوبر 2026.',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/booking/rb-4/pay',
    createdAt: '2026-08-11T19:15:00Z',
  },
  {
    id: 'rn-4',
    type: NotificationType.BookingRejected,
    title: 'رُفض حجزك في غرفة الياسمين',
    body: 'أُعيد مبلغ 630.00 ر.س كاملًا إلى بطاقة مدى المنتهية بـ 8130.',
    channel: NotificationChannel.InApp,
    isRead: true,
    targetUrl: '/my-bookings/rb-7',
    createdAt: '2026-06-14T10:05:00Z',
  },
];

// ── Static pages ─────────────────────────────────────────────────────────
// Not fixtures. The seven pages are real launch copy and ship in the bundle —
// see features/content/content.pages.ts for why. Re-exported under the old
// name so the interceptor keeps answering /content/pages/:slug with the same
// documents the application falls back to, rather than a second copy that
// could drift from it.
export { BUNDLED_PAGES as MOCK_STATIC_PAGES } from '../constants/static-pages';

/** Route paths this fixture set answers, for the interceptor's own reference. */
export const RENTER_MOCK_ROUTES = {
  search: API_ENDPOINTS.public.units,
  bookingsMine: API_ENDPOINTS.bookings.mine,
} as const;
