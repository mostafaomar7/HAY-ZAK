import { BookingStatus } from '../enums/booking-status.enum';
import { ComplaintCategory, ComplaintStatus } from '../enums/complaint.enum';
import { LegalDocumentType } from '../enums/operations.enum';
import { PayoutStatus } from '../enums/payment.enum';
import { UnitStatus } from '../enums/unit-status.enum';
import { AccountStatus, AdminRole, UserRole } from '../enums/user-role.enum';
import { TermsVersionStatus } from '../models/admin.model';
import type {
  AdminUserDetail,
  AdminUserRow,
  BookingReviewDetail,
  BookingReviewRow,
  LessorBankDetails,
  ListingReviewDetail,
  ListingReviewRow,
  WireAdminBooking,
  TermsApprovalRow,
  TermsVersionRow,
} from '../models/admin.model';
import type { WireComplaint, WireComplaintDetail } from '../models/complaint';
import type { WireAuditEntry } from '../models/audit';
import type {
  AdminOverview,
  BookingsReport,
  LessorReportRow,
  RevenueReport,
} from '../models/admin-reports';
import type { WirePlatformSetting } from '../models/platform-setting';
import type { WireReferenceData } from '../models/reference-admin';
import type { WireCmsPage } from '../models/cms-page';
import type { AdminDashboardKpis } from '../models/operations.model';
import type { EligiblePayout, Payout } from '../models/payment.model';
import type { WireUnit } from '../models/unit-wire';
import type { User } from '../models/user.model';

/**
 * Development fixtures for the admin panel, transcribed from the design's own
 * sample data so a screen review compares like with like.
 *
 * Dates are literals rather than computed from `new Date()`: a fixture that
 * moves with the clock makes "26 hours waiting" read differently every time the
 * page is opened, and makes a screenshot impossible to compare against last
 * week's.
 */

/**
 * The console's system-administrator account, and usr-5 in the user list below.
 * `accounts.ts` holds the whole sign-in directory, including the supervisor and
 * the finance officer, so all three console roles can be demonstrated.
 */
/**
 * What the API issues to each kind of administrator, copied from the running
 * server rather than invented here.
 *
 * The mock exists to make the console walkable before the backend is reachable,
 * so a demo that granted more than the server does would be a demo of a product
 * that does not exist — the finance officer's console must be missing the same
 * screens here as it is there.
 */
export const SEEDED_ADMIN_PERMISSIONS: Readonly<Record<AdminRole, readonly string[]>> = {
  [AdminRole.SystemAdmin]: [
    'units:review',
    'users:manage',
    'bookings:manage',
    'complaints:manage',
    'payouts:approve',
    'refunds:issue',
    'settings:manage',
    'settings:financial',
    'reference:manage',
    'audit:view',
    'reports:view',
    'cms:manage',
    'admins:manage',
  ],
  [AdminRole.Operations]: [
    'units:review',
    'users:manage',
    'bookings:manage',
    'complaints:manage',
    'reference:manage',
    'reports:view',
    'cms:manage',
  ],
  [AdminRole.Finance]: ['payouts:approve', 'refunds:issue', 'settings:financial', 'reports:view'],
};

export const MOCK_ADMIN_USER: User = {
  id: 'usr-5',
  fullName: 'محمد الحربي',
  mobile: '0509001122',
  email: 'operations@hayzak.com',
  role: UserRole.Admin,
  adminRole: AdminRole.SystemAdmin,
  permissions: SEEDED_ADMIN_PERMISSIONS[AdminRole.SystemAdmin],
  status: AccountStatus.Active,
  mobileVerifiedAt: '2026-01-04T09:00:00Z',
  createdAt: '2026-01-04T09:00:00Z',
};

// ── Review queues ────────────────────────────────────────────────────────

export const MOCK_LISTING_QUEUE: ListingReviewRow[] = [
  {
    id: 'unit-r1',
    unitTitle: 'مستودع مكيّف — النرجس',
    ownerName: 'سعود العنزي',
    categoryName: 'مستودع',
    cityName: 'الرياض',
    dailyPriceHalalas: 7500,
    areaSqm: 35,
    submittedAt: '2026-08-12T09:20:00Z',
    slaDueAt: '2026-08-12T13:20:00Z',
    isOverdue: true,
    waitingHours: 26,
    isEdit: false,
  },
  {
    id: 'unit-r2',
    unitTitle: 'غرفة تخزين نظيفة — الياسمين',
    ownerName: 'سعود العنزي',
    categoryName: 'غرفة',
    cityName: 'الرياض',
    dailyPriceHalalas: 4500,
    areaSqm: 18,
    submittedAt: '2026-08-12T16:05:00Z',
    slaDueAt: '2026-08-12T20:05:00Z',
    isOverdue: true,
    waitingHours: 19,
    isEdit: true,
  },
  {
    id: 'unit-r3',
    unitTitle: 'قراج مغلق — الملقا',
    ownerName: 'فهد بن سعد العمري',
    categoryName: 'قراج',
    cityName: 'الرياض',
    dailyPriceHalalas: 6000,
    areaSqm: 22,
    submittedAt: '2026-08-11T18:40:00Z',
    slaDueAt: '2026-08-11T22:40:00Z',
    isOverdue: true,
    waitingHours: 41,
    isEdit: false,
  },
  {
    id: 'unit-r4',
    unitTitle: 'مستودع أرضي — الصحافة',
    ownerName: 'سعود العنزي',
    categoryName: 'مستودع',
    cityName: 'الرياض',
    dailyPriceHalalas: 9500,
    areaSqm: 50,
    submittedAt: '2026-08-13T03:10:00Z',
    // Still inside the four-hour window when the fixture was written — the one
    // row that is not late, so the red is visibly a state and not the default.
    slaDueAt: '2026-08-13T07:10:00Z',
    isOverdue: false,
    waitingHours: 8,
    isEdit: false,
  },
];

export const MOCK_LISTING_DETAIL: ListingReviewDetail = {
  ...MOCK_LISTING_QUEUE[0],
  districtName: 'حي النرجس',
  description:
    'مستودع مكيّف بمدخل واسع يسمح بدخول عربات النقل، مزوّد بنظام تكييف يعمل على مدار الساعة وإضاءة كاملة، ومناسب للأثاث والأجهزة الحساسة للحرارة.',
  imageUrls: [],
  owner: {
    name: 'سعود العنزي',
    mobile: '+966 50 123 4567',
    email: 'saud@example.com',
    isVerified: true,
  },
};

/**
 * The review queue as the API sends it: units, not review rows.
 *
 * `/admin/units?status=PENDING_REVIEW` answers with the same unit shape every
 * other endpoint uses, and the console's row is a projection the client makes.
 * Deriving these from the queue fixtures rather than replacing them keeps the
 * eighteen rows the design's board shows while the mock still answers in the
 * shape the server answers in — the demo would otherwise be a demo of a
 * response nobody sends.
 *
 * `WireUnit`, not `Unit`: this is what goes over the wire, and typing it as the
 * domain object let `submittedAt` be smuggled in as `publishedAt` for as long
 * as the server had no column of its own.
 */
export const MOCK_REVIEW_UNITS: WireUnit[] = MOCK_LISTING_QUEUE.map((row) => ({
  id: row.id,
  lessorId: `lsr-${row.id}`,
  lessorName: row.ownerName,
  categoryId: row.categoryName,
  category: { id: row.categoryName, nameAr: row.categoryName, nameEn: row.categoryName },
  cityId: row.cityName,
  city: { id: row.cityName, nameAr: row.cityName, nameEn: row.cityName },
  districtId: MOCK_LISTING_DETAIL.districtName,
  district: {
    id: MOCK_LISTING_DETAIL.districtName,
    nameAr: MOCK_LISTING_DETAIL.districtName,
    nameEn: MOCK_LISTING_DETAIL.districtName,
  },
  title: row.unitTitle,
  description: MOCK_LISTING_DETAIL.description,
  areaSqm: row.areaSqm,
  dailyPriceHalalas: row.dailyPriceHalalas,
  location: { latitude: 24.7136, longitude: 46.6753 },
  addressLine: 'الرياض — حي النرجس، شارع أنس بن مالك',
  // Minutes since midnight — 09:00 to 21:00, as the API stores them.
  visitHoursFrom: 540,
  visitHoursTo: 1260,
  minDays: 1,
  maxDays: 365,
  images: [],
  status: UnitStatus.PendingReview,
  // Its own field now, rather than smuggled in as `publishedAt`. Nothing
  // waiting for review has been published, so that one is null.
  submittedAt: row.submittedAt,
  slaDueAt: row.slaDueAt,
  isOverdue: row.isOverdue,
  publishedAt: null,
  rejectionReason: null,
  // A re-submission is one that has been reviewed before.
  reviewedAt: row.isEdit ? row.submittedAt : null,
  createdAt: row.submittedAt ?? '',
  updatedAt: row.submittedAt ?? '',
}));

export const MOCK_BOOKING_QUEUE: BookingReviewRow[] = [
  {
    id: 'bk-r1',
    referenceNo: 'HZ-2026-01042',
    renterName: 'عبدالله القحطاني',
    lessorName: 'سعود العنزي',
    unitTitle: 'مستودع مكيّف — النرجس',
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    totalHalalas: 52500,
    waitingHours: 52,
  },
  {
    id: 'bk-r2',
    referenceNo: 'HZ-2026-01078',
    renterName: 'سارة العتيبي',
    lessorName: 'سعود العنزي',
    unitTitle: 'مستودع مكيّف — النرجس',
    startDate: '2026-08-20',
    endDate: '2026-08-27',
    totalHalalas: 52500,
    waitingHours: 31,
  },
  {
    id: 'bk-r3',
    referenceNo: 'HZ-2026-01091',
    renterName: 'نورة الشمري',
    lessorName: 'فهد بن سعد العمري',
    unitTitle: 'قراج مغلق — الملقا',
    startDate: '2026-08-18',
    endDate: '2026-08-25',
    totalHalalas: 42000,
    waitingHours: 14,
  },
  {
    id: 'bk-r4',
    referenceNo: 'HZ-2026-01103',
    renterName: 'ماجد الدوسري',
    lessorName: 'سعود العنزي',
    unitTitle: 'غرفة تخزين نظيفة — الياسمين',
    startDate: '2026-08-22',
    endDate: '2026-08-29',
    totalHalalas: 31500,
    waitingHours: 6,
  },
];

export const MOCK_BOOKING_DETAIL: BookingReviewDetail = {
  ...MOCK_BOOKING_QUEUE[0],
  daysCount: 7,
  goodsDescription:
    'أثاث منزلي مفكك وصناديق كتب، لا تتضمن مواد قابلة للاشتعال أو أي صنف من قائمة الممنوعات.',
  commissionHalalas: 2625,
  vatHalalas: 394,
  netToLessorHalalas: 49875,
  paidAt: '2026-08-11T07:30:00Z',
  renter: { name: 'عبدالله القحطاني', mobile: '+966 55 401 2288', isVerified: true },
  lessor: {
    name: 'سعود العنزي',
    mobile: '+966 50 123 4567',
    email: 'saud@hayzak.com',
    isVerified: true,
  },
};

// ── Dashboard ────────────────────────────────────────────────────────────

export const MOCK_ADMIN_KPIS: AdminDashboardKpis = {
  usersByRole: { Renter: 946, Lessor: 331, Operations: 4, Finance: 2 },
  unitsByStatus: { Published: 214, PendingReview: 12, Rejected: 9, Suspended: 3 },
  bookingsCount: 148,
  grossCollection: 86_420,
  totalCommission: 4321,
  occupancyRate: 63,
  pendingListings: MOCK_LISTING_QUEUE.length,
  slaBreaches: 2,
};

// ── Payments and payouts ─────────────────────────────────────────────────

/**
 * What `/admin/bookings` sends, in the wire shape — `daysCount`, the parties
 * nested, `payoutHeld` — so the adapter is exercised rather than bypassed.
 *
 * The three cover the states payment tracking is read for: money collected and
 * free, money collected and frozen behind a complaint, and a booking that never
 * paid at all.
 */
export const MOCK_ADMIN_BOOKINGS: WireAdminBooking[] = [
  {
    id: 'bk-1',
    referenceNo: 'HZ-2026-00981',
    status: BookingStatus.Completed,
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    daysCount: 7,
    totalHalalas: 52500,
    commissionHalalas: 2625,
    netToLessorHalalas: 49875,
    payoutHeld: false,
    unit: { id: 'u-1', title: 'مستودع مكيّف — النرجس' },
    renter: { id: 'r-1', fullName: 'عبدالله القحطاني', mobile: '+966500000001' },
    lessor: { id: 'l-1', fullName: 'سعود العنزي', mobile: '+966500000002' },
    createdAt: '2026-08-04T09:00:00.000Z',
    confirmedAt: '2026-08-04T09:04:00.000Z',
  },
  {
    id: 'bk-2',
    referenceNo: 'HZ-2026-01004',
    status: BookingStatus.Active,
    startDate: '2026-08-20',
    endDate: '2026-08-27',
    daysCount: 7,
    totalHalalas: 31500,
    commissionHalalas: 1575,
    netToLessorHalalas: 29925,
    // Frozen behind an open complaint — the one thing on a row somebody acts on.
    payoutHeld: true,
    unit: { id: 'u-2', title: 'غرفة تخزين نظيفة — الياسمين' },
    renter: { id: 'r-2', fullName: 'سارة العتيبي', mobile: '+966500000005' },
    lessor: { id: 'l-1', fullName: 'سعود العنزي', mobile: '+966500000002' },
    createdAt: '2026-08-19T11:00:00.000Z',
    confirmedAt: '2026-08-19T11:06:00.000Z',
  },
  {
    id: 'bk-3',
    referenceNo: 'HZ-2026-01021',
    status: BookingStatus.Expired,
    startDate: '2026-09-01',
    endDate: '2026-09-08',
    daysCount: 7,
    totalHalalas: 42000,
    commissionHalalas: 2100,
    netToLessorHalalas: 39900,
    payoutHeld: false,
    unit: { id: 'u-3', title: 'قراج مغلق — الملقا' },
    renter: { id: 'r-3', fullName: 'نورة الشمري', mobile: '+966500000006' },
    lessor: { id: 'l-2', fullName: 'فهد بن سعد العمري', mobile: '+966500000007' },
    createdAt: '2026-08-29T14:00:00.000Z',
    // Never paid for, so never confirmed — payment is what confirms.
    confirmedAt: null,
  },
];

/**
 * Money that is releasable and has no payout yet, one row per lessor.
 *
 * `blocked` is the whole point of the second row: an operator sees the obstacle
 * on the row rather than discovering it when the button fails.
 */
export const MOCK_ELIGIBLE_PAYOUTS: EligiblePayout[] = [
  {
    lessorId: 'lsr-1',
    lessorName: 'سعود بن ناصر العنزي',
    totalHalalas: 119700,
    bookingsCount: 3,
    ibanLast4: '4523',
    blocked: null,
  },
  {
    lessorId: 'lsr-2',
    lessorName: 'فهد بن سعد العمري',
    totalHalalas: 79800,
    bookingsCount: 2,
    blocked: 'NO_BANK_ACCOUNT',
  },
];

/** Payouts an operator has already approved — the three states, one each. */
export const MOCK_PAYOUTS: Payout[] = [
  {
    id: 'po-1',
    lessorId: 'lsr-3',
    lessorName: 'منيرة بنت عبدالله القحطاني',
    ibanLast4: '8871',
    totalHalalas: 89775,
    status: PayoutStatus.Approved,
    createdAt: '2026-08-24T08:10:00Z',
    items: [
      { bookingId: 'bk-9', bookingReferenceNo: 'HZ-2026-01102', netHalalas: 49875 },
      { bookingId: 'bk-10', bookingReferenceNo: 'HZ-2026-01118', netHalalas: 39900 },
    ],
  },
  {
    id: 'po-2',
    lessorId: 'lsr-4',
    lessorName: 'عبدالرحمن بن خالد الشمري',
    ibanLast4: '2214',
    totalHalalas: 29925,
    status: PayoutStatus.Paid,
    bankReference: 'TRF-20260814',
    executedBy: 'ريم الغامدي',
    executedAt: '2026-08-14T11:02:00Z',
    createdAt: '2026-08-13T09:00:00Z',
    items: [{ bookingId: 'bk-11', bookingReferenceNo: 'HZ-2026-01004', netHalalas: 29925 }],
  },
  {
    id: 'po-3',
    lessorId: 'lsr-5',
    lessorName: 'نورة بنت سلطان الدوسري',
    ibanLast4: '9930',
    totalHalalas: 39900,
    status: PayoutStatus.Failed,
    failureReason: 'رفض البنك التحويل: اسم صاحب الحساب لا يطابق اسم المؤجّر في السجل.',
    executedBy: 'ريم الغامدي',
    executedAt: '2026-08-15T13:40:00Z',
    createdAt: '2026-08-15T09:20:00Z',
    items: [{ bookingId: 'bk-12', bookingReferenceNo: 'HZ-2026-01033', netHalalas: 39900 }],
  },
];

export const MOCK_BANK_DETAILS: LessorBankDetails = {
  bankName: 'البنك الأهلي السعودي',
  accountHolder: 'سعود بن ناصر العنزي',
  iban: 'SA44 2000 0001 2345 6789 4523',
};

// ── Reports ──────────────────────────────────────────────────────────────

/**
 * The overview, with **every** key present including the zeros.
 *
 * The server guarantees that, so nothing downstream needs a `?? 0` — and a
 * fixture with holes in it would teach exactly the defensive habit that hides
 * a block the server stopped sending.
 */
export const MOCK_OVERVIEW: AdminOverview = {
  users: {
    // No GUEST: the server sends only the roles that exist as accounts.
    byRole: {
      [UserRole.Renter]: 184,
      [UserRole.Lessor]: 62,
      [UserRole.Admin]: 4,
    },
    byStatus: {
      [AccountStatus.PendingVerification]: 9,
      [AccountStatus.Active]: 236,
      [AccountStatus.Suspended]: 5,
      [AccountStatus.Locked]: 1,
    },
  },
  units: {
    [UnitStatus.Draft]: 11,
    [UnitStatus.PendingReview]: 7,
    [UnitStatus.Published]: 79,
    [UnitStatus.Rejected]: 3,
    [UnitStatus.Suspended]: 2,
    [UnitStatus.Archived]: 6,
  },
  bookings: {
    [BookingStatus.Draft]: 0,
    [BookingStatus.AwaitingPayment]: 4,
    [BookingStatus.Confirmed]: 38,
    [BookingStatus.Active]: 12,
    [BookingStatus.Completed]: 141,
    [BookingStatus.Expired]: 17,
    [BookingStatus.Cancelled]: 3,
  },
  complaints: {
    [ComplaintStatus.Open]: 2,
    [ComplaintStatus.InProgress]: 3,
    [ComplaintStatus.AwaitingUser]: 1,
    [ComplaintStatus.Resolved]: 24,
    [ComplaintStatus.Closed]: 5,
    // Not one of the five above — an overdue complaint is also OPEN or
    // IN_PROGRESS, so it is counted separately and never added to them.
    overdue: 1,
  },
  payouts: {
    APPROVED: { count: 6, totalHalalas: 4_820_000 },
    PAID: { count: 41, totalHalalas: 38_610_000 },
    FAILED: { count: 1, totalHalalas: 92_000 },
  },
};

export const MOCK_REPORT_BOOKINGS: BookingsReport = {
  bookingsCount: 148,
  // What renters paid. Not revenue — see the commission below.
  grossHalalas: 8_642_000,
  // Before refunds, unlike the revenue report's figure.
  expectedCommissionHalalas: 432_100,
  lessorShareHalalas: 8_209_900,
  averageBookingHalalas: 58_392,
  averageDays: 3.3,
  // Only the statuses actually present, as the server sends it.
  byStatus: {
    [BookingStatus.Confirmed]: 38,
    [BookingStatus.Completed]: 91,
  },
  topCities: [
    { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh', bookings: 121, grossHalalas: 7_040_000 },
    { id: 'city-2', nameAr: 'جدة', nameEn: 'Jeddah', bookings: 27, grossHalalas: 1_602_000 },
  ],
};

/**
 * The revenue, and the two liabilities beside it.
 *
 * `commissionHalalas` is 5% of the gross above, less refunds, which is what
 * makes the arithmetic on the screen checkable by eye — a fixture where the
 * numbers do not relate would let a mislabelled figure look plausible.
 */
export const MOCK_REPORT_REVENUE: RevenueReport = {
  collectedHalalas: 8_642_000,
  netCashHalalas: 1_240_000,
  commissionHalalas: 424_100,
  owedToLessorsHalalas: 7_912_900,
  vatPayableHalalas: 63_615,
  refundedHalalas: 88_000,
  paidOutHalalas: 7_402_000,
};

export const MOCK_REPORT_LESSORS: LessorReportRow[] = [
  {
    lessor: { id: 'lsr-1', fullName: 'سعود العنزي' },
    units: 9,
    bookings: 41,
    grossHalalas: 2_480_000,
    earnedHalalas: 2_356_000,
  },
  {
    lessor: { id: 'lsr-2', fullName: 'فهد بن سعد العمري' },
    units: 5,
    bookings: 27,
    grossHalalas: 1_610_000,
    earnedHalalas: 1_529_500,
  },
];

/**
 * The runtime configuration FR-ADM-06 exposes. The commission rate here is the
 * design's 5%, which disagrees with `FINANCIAL_DEFAULTS.commissionRateBps` — that
 * disagreement is an open client decision (SRS §15 item 3) and is recorded in
 * docs/design/admin-plan.md rather than silently reconciled.
 */
export const MOCK_SETTINGS: WirePlatformSetting[] = [
  {
    key: 'commission.default_rate_bps',
    // A string, as the wire sends it. A fixture with a real number would let a
    // screen bind an input to one and still look correct here.
    value: '500',
    dataType: 'INTEGER',
    group: 'financial',
    labelAr: 'نسبة عمولة المنصة',
    labelEn: 'Platform commission rate',
    hintAr: 'تُخصم من المؤجّر ولا تُضاف على المستأجر. القيمة بالنقاط الأساسية — 500 تعني 5%.',
    hintEn: 'Deducted from the lessor, not added to the renter. In basis points — 500 is 5%.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'vat.rate_bps',
    value: '1500',
    dataType: 'INTEGER',
    group: 'financial',
    labelAr: 'نسبة ضريبة القيمة المضافة',
    labelEn: 'VAT rate',
    hintAr: 'تُطبَّق على العمولة. 1500 تعني 15%.',
    hintEn: 'Applied to the commission. 1500 is 15%.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'payout.eligible_after',
    value: '168',
    dataType: 'INTEGER',
    group: 'financial',
    labelAr: 'دورة التحويل',
    labelEn: 'Payout cycle',
    hintAr: 'المدة بين دورتي صرف المستحقات، بالساعات.',
    hintEn: 'Hours between payout runs.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'complaint.sla_hours',
    value: '24',
    dataType: 'INTEGER',
    group: 'operations',
    labelAr: 'مهلة مراجعة الإعلان',
    labelEn: 'Listing review deadline',
    hintAr: 'بعدها يُعدّ الإعلان متأخّرًا في طابور المراجعة.',
    hintEn: 'After this a listing counts as late in the review queue.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'booking.hold_minutes',
    value: '15',
    dataType: 'INTEGER',
    group: 'booking',
    labelAr: 'مهلة حجز التواريخ',
    labelEn: 'Date hold',
    hintAr: 'المدة التي تبقى فيها التواريخ محجوزة قبل الدفع.',
    hintEn: 'How long dates stay held before payment.',
    isEditable: true,
    isPublic: true,
  },
  {
    key: 'marketplace.page_size',
    value: '12',
    dataType: 'INTEGER',
    group: 'general',
    labelAr: 'عدد النتائج في الصفحة',
    labelEn: 'Results per page',
    hintAr: null,
    hintEn: null,
    isEditable: true,
    isPublic: true,
  },
  {
    key: 'general.platform_name',
    value: 'حيّزك',
    dataType: 'STRING',
    group: 'general',
    labelAr: 'اسم المنصة',
    labelEn: 'Platform name',
    hintAr: 'يظهر في الرسائل النصية والفواتير.',
    hintEn: 'Appears in SMS messages and on invoices.',
    // Read-only here so the screen's disabled state is exercised.
    isEditable: false,
    isPublic: true,
  },
];

/*
 * Commission exceptions are not shipped and have no endpoint. They were a
 * fixture for a screen that never had a server behind it; the settings above
 * are the shipped shape.
 */

// ── Users ────────────────────────────────────────────────────────────────

export const MOCK_ADMIN_USERS: AdminUserRow[] = [
  {
    id: 'usr-1',
    fullName: 'سعود العنزي',
    role: UserRole.Lessor,
    mobile: '+966 50 123 4567',
    email: 'saud@hayzak.com',
    registeredAt: '2026-02-14',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-2',
    fullName: 'عبدالله القحطاني',
    role: UserRole.Renter,
    mobile: '+966 55 401 2288',
    email: 'abdullah@example.com',
    registeredAt: '2026-05-02',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-3',
    fullName: 'فهد بن سعد العمري',
    role: UserRole.Lessor,
    mobile: '+966 53 777 1140',
    email: 'fahad@example.com',
    registeredAt: '2026-03-21',
    status: AccountStatus.PendingVerification,
  },
  {
    id: 'usr-4',
    fullName: 'نورة الشمري',
    role: UserRole.Renter,
    mobile: '+966 56 118 7743',
    email: 'noura@example.com',
    registeredAt: '2026-06-30',
    status: AccountStatus.Suspended,
  },
  {
    id: 'usr-5',
    fullName: 'محمد الحربي',
    role: UserRole.Admin,
    adminRole: AdminRole.SystemAdmin,
    mobile: '+966 50 900 1122',
    email: 'operations@hayzak.com',
    registeredAt: '2026-01-04',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-6',
    fullName: 'نوف السالم',
    role: UserRole.Admin,
    adminRole: AdminRole.Operations,
    mobile: '+966 54 220 8891',
    email: 'nouf@hayzak.com',
    registeredAt: '2026-01-19',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-7',
    fullName: 'ريم الغامدي',
    role: UserRole.Admin,
    adminRole: AdminRole.Finance,
    mobile: '+966 55 640 3312',
    email: 'reem@hayzak.com',
    registeredAt: '2026-02-02',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-8',
    fullName: 'فهد الدوسري',
    role: UserRole.Renter,
    mobile: '+966 55 210 4478',
    email: 'f.aldosari@example.com',
    registeredAt: '2026-07-24',
    status: AccountStatus.Active,
  },
];

export const MOCK_ADMIN_USER_DETAIL: AdminUserDetail = {
  ...MOCK_ADMIN_USERS[0],
  nationalId: '1098 4432 11',
  units: [
    { id: 'unit-r1', title: 'مستودع مكيّف — النرجس' },
    { id: 'unit-r2', title: 'غرفة تخزين نظيفة — الياسمين' },
    { id: 'unit-r4', title: 'مستودع أرضي — الصحافة' },
  ],
  bookings: [],
};

export const MOCK_ADMIN_RENTER_DETAIL: AdminUserDetail = {
  ...MOCK_ADMIN_USERS[1],
  nationalId: '1077 3311 09',
  units: [],
  bookings: [
    {
      id: 'bk-r1',
      referenceNo: 'HZ-2026-01042',
      unitTitle: 'مستودع مكيّف — النرجس',
      status: BookingStatus.Confirmed,
    },
  ],
};

// ── Reference lists ──────────────────────────────────────────────────────

/**
 * The **wire** shape `GET /admin/reference` answers with, `isActive` on every
 * row — three lists, with the districts nested inside their city. Not the
 * domain shape: a fixture in that one would never exercise the flattening.
 *
 * One entry is deactivated on purpose: a fixture where everything is on would
 * demo a screen whose only real action never shows its effect.
 */
export const MOCK_REFERENCE_DATA: WireReferenceData = {
  categories: [
    {
      id: 'cat-1',
      // The stable identifier. Renaming the category does not change it, which
      // is why saved filters and existing listings keep matching.
      slug: 'warehouse',
      nameAr: 'مستودع',
      nameEn: 'Warehouse',
      iconKey: 'box',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'cat-2',
      slug: 'storage-room',
      nameAr: 'غرفة تخزين',
      nameEn: 'Storage room',
      iconKey: null,
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'cat-3',
      slug: 'garage',
      nameAr: 'قراج',
      nameEn: 'Garage',
      iconKey: null,
      sortOrder: 3,
      isActive: true,
    },
    {
      id: 'cat-4',
      slug: 'open-space',
      nameAr: 'مكان مكشوف',
      nameEn: 'Open space',
      iconKey: null,
      sortOrder: 4,
      isActive: false,
    },
  ],
  // Districts nested inside their city, as the wire carries them — there is
  // no top-level key, and Jeddah having none is a real case: the adapter must
  // flatten to an empty list rather than to `undefined`.
  cities: [
    {
      id: 'city-1',
      nameAr: 'الرياض',
      nameEn: 'Riyadh',
      sortOrder: 1,
      isActive: true,
      districts: [
        {
          id: 'dst-1',
          cityId: 'city-1',
          nameAr: 'حي النرجس',
          nameEn: 'Al Narjis',
          sortOrder: 1,
          isActive: true,
        },
        {
          id: 'dst-2',
          cityId: 'city-1',
          nameAr: 'حي الياسمين',
          nameEn: 'Al Yasmin',
          sortOrder: 2,
          isActive: true,
        },
        {
          id: 'dst-3',
          cityId: 'city-1',
          nameAr: 'حي الملقا',
          nameEn: 'Al Malqa',
          sortOrder: 3,
          isActive: true,
        },
      ],
    },
    { id: 'city-2', nameAr: 'جدة', nameEn: 'Jeddah', sortOrder: 2, isActive: true },
    {
      id: 'city-3',
      nameAr: 'الدمام',
      nameEn: 'Dammam',
      sortOrder: 3,
      isActive: true,
      districts: [
        {
          id: 'dst-4',
          cityId: 'city-3',
          nameAr: 'حي الشاطئ',
          nameEn: 'Al Shati',
          sortOrder: 1,
          isActive: true,
        },
      ],
    },
  ],
  prohibitedItems: [
    {
      id: 'prh-1',
      nameAr: 'المواد القابلة للاشتعال',
      nameEn: 'Flammable materials',
      noteAr: 'تشمل الوقود والغاز والدهانات.',
      noteEn: 'Includes fuel, gas and paint.',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'prh-2',
      nameAr: 'المواد الغذائية سريعة التلف',
      nameEn: 'Perishable food',
      noteAr: null,
      noteEn: null,
      sortOrder: 2,
      isActive: true,
    },
  ],
};

// ── CMS ──────────────────────────────────────────────────────────────────

export const MOCK_CMS_PAGES: WireCmsPage[] = [
  {
    id: 'cms-1',
    slug: 'about',
    titleAr: 'من نحن',
    titleEn: 'About us',
    bodyAr:
      'حيزك منصة سعودية تربط من يملك مساحة تخزين غير مستغلة بمن يحتاجها، بعقد واضح وسعر معروض قبل أي خطوة.',
    bodyEn:
      'HAY-ZAK connects people with unused storage space to the people who need it, on a clear contract at a price shown up front.',
    metaTitleAr: 'من نحن — حيزك',
    metaDescriptionAr: 'تعرّف على منصة حيزك ودورها في تأجير مساحات التخزين في السعودية.',
    isPublished: true,
    sortOrder: 1,
    updatedAt: '2026-08-02T09:00:00Z',
  },
  {
    id: 'cms-2',
    slug: 'how-it-works',
    titleAr: 'كيف تعمل المنصة',
    titleEn: 'How it works',
    bodyAr: 'ثلاث خطوات: ابحث واختر المساحة، احجز وادفع، ثم استلم المساحة بعد اعتماد الطلب.',
    bodyEn: 'Three steps: find a space, book and pay, then collect the keys.',
    metaTitleAr: 'كيف تعمل منصة حيزك',
    metaDescriptionAr: 'خطوات الحجز في حيزك من البحث حتى استلام المساحة.',
    isPublished: true,
    sortOrder: 2,
    updatedAt: '2026-07-28T09:00:00Z',
  },
  {
    // Unpublished on purpose: the public route answers 404 for this one, not
    // 403, and the console is the only place it can be seen at all.
    id: 'cms-3',
    slug: 'refund-policy',
    titleAr: 'سياسة الاسترداد',
    titleEn: 'Refund policy',
    bodyAr: 'مسودّة قيد المراجعة.',
    bodyEn: 'Draft under review.',
    metaTitleAr: null,
    metaDescriptionAr: null,
    isPublished: false,
    sortOrder: 3,
    updatedAt: '2026-08-20T09:00:00Z',
  },
];

// ── Legal versions ───────────────────────────────────────────────────────

export const MOCK_TERMS_VERSIONS: TermsVersionRow[] = [
  {
    id: 'tv-4',
    documentType: LegalDocumentType.TermsOfUse,
    versionNo: '2.3',
    status: TermsVersionStatus.Draft,
    approvalCount: 0,
    changeNote: 'إضافة بند مسؤولية المستأجر عن مطابقة البضاعة لقائمة الممنوعات.',
  },
  {
    id: 'tv-3',
    documentType: LegalDocumentType.TermsOfUse,
    versionNo: '2.2',
    publishedAt: '2026-06-15',
    status: TermsVersionStatus.Published,
    approvalCount: 1284,
    changeNote: 'تحديث مدة مراجعة الحجز إلى أربع وعشرين ساعة من وقت الدفع.',
  },
  {
    id: 'tv-2',
    documentType: LegalDocumentType.TermsOfUse,
    versionNo: '2.1',
    publishedAt: '2026-03-02',
    status: TermsVersionStatus.Archived,
    approvalCount: 890,
    changeNote: 'توضيح آلية الاسترداد عند رفض الحجز من إدارة المنصة.',
  },
  {
    id: 'tv-1',
    documentType: LegalDocumentType.PrivacyPolicy,
    versionNo: '1.4',
    publishedAt: '2026-06-15',
    status: TermsVersionStatus.Published,
    approvalCount: 1284,
    changeNote: 'إضافة فقرة حفظ سجل التدقيق عشر سنوات.',
  },
];

export const MOCK_TERMS_APPROVALS: TermsApprovalRow[] = [
  {
    userId: 'usr-2',
    fullName: 'عبدالله القحطاني',
    role: UserRole.Renter,
    acceptedAt: '2026-08-11T07:12:00Z',
  },
  {
    userId: 'usr-1',
    fullName: 'سعود العنزي',
    role: UserRole.Lessor,
    acceptedAt: '2026-08-10T19:44:00Z',
  },
  {
    userId: 'usr-4',
    fullName: 'نورة الشمري',
    role: UserRole.Renter,
    acceptedAt: '2026-08-09T11:03:00Z',
  },
  {
    userId: 'usr-3',
    fullName: 'فهد بن سعد العمري',
    role: UserRole.Lessor,
    acceptedAt: '2026-08-08T15:20:00Z',
  },
];

// ── Complaints ───────────────────────────────────────────────────────────

/**
 * The wire shape, not the domain one — the interceptor stands in for the
 * server, so it sends `isOverdue`, the nested booking and the message
 * attachments exactly as `/admin/complaints` does. A fixture in the domain
 * shape would mean the adapter is never exercised.
 *
 * One of the three is overdue on purpose: the queue is ordered by `slaDueAt`
 * and paints an overdue row red, and a fixture where nothing is late would
 * demo a screen whose whole point never fires.
 */
export const MOCK_COMPLAINTS: WireComplaint[] = [
  {
    id: 'cmp-1',
    referenceNo: 'CMP-2026-08-0042',
    booking: {
      id: 'bk-r3',
      referenceNo: 'HZ-2026-01021',
      unit: { id: 'u-mock', title: 'مستودع مكيّف — النرجس' },
    },
    category: ComplaintCategory.SpaceNotAsDescribed,
    subject: 'الوحدة غير مطابقة للوصف المنشور',
    status: ComplaintStatus.InProgress,
    slaDueAt: '2026-07-19T09:10:00Z',
    firstResponseAt: '2026-07-19T13:40:00Z',
    isOverdue: false,
    createdAt: '2026-07-18T09:10:00Z',
    updatedAt: '2026-07-20T08:05:00Z',
  },
  {
    id: 'cmp-2',
    referenceNo: 'CMP-2026-08-0051',
    booking: {
      id: 'bk-r4',
      referenceNo: 'HZ-2026-01033',
      unit: { id: 'u-mock', title: 'غرفة تخزين — الياسمين' },
    },
    category: ComplaintCategory.AccessProblem,
    subject: 'تأخر تسليم مفاتيح المستودع',
    status: ComplaintStatus.Open,
    slaDueAt: '2026-08-05T12:00:00Z',
    // Nobody has answered this one yet, which is a different thing from new.
    firstResponseAt: null,
    isOverdue: true,
    createdAt: '2026-08-04T11:20:00Z',
    updatedAt: '2026-08-04T11:20:00Z',
  },
  {
    id: 'cmp-3',
    referenceNo: 'CMP-2026-08-0038',
    booking: {
      id: 'bk-r5',
      referenceNo: 'HZ-2026-00981',
      unit: { id: 'u-mock', title: 'مستودع صغير — الملقا' },
    },
    category: ComplaintCategory.ProhibitedGoods,
    subject: 'بضاعة مخالفة لقائمة الممنوعات',
    status: ComplaintStatus.Resolved,
    slaDueAt: '2026-07-03T09:00:00Z',
    firstResponseAt: '2026-07-02T15:00:00Z',
    isOverdue: false,
    createdAt: '2026-07-02T08:00:00Z',
    updatedAt: '2026-07-04T10:00:00Z',
  },
];

export const MOCK_COMPLAINT_DETAIL: WireComplaintDetail = {
  ...MOCK_COMPLAINTS[0],
  description:
    'المساحة الفعلية أصغر من المعلن، ولا يوجد تكييف كما ورد في الوصف. زرت المكان يوم الأحد ووجدت الباب الداخلي مغلقًا.',
  resolution: null,
  resolutionNote: null,
  resolvedAt: null,
  // Console only, and empty rather than absent: this one has not been refunded.
  // `/me/complaints/:id` sends no key at all, which the interceptor mirrors.
  refunds: [],
  messages: [
    {
      id: 'msg-1',
      senderType: 'RENTER',
      body: 'المساحة الفعلية أصغر من المعلن، ولا يوجد تكييف كما ورد في الوصف.',
      createdAt: '2026-07-18T09:10:00Z',
    },
    {
      // The other party to the booking answers in the same thread — the lessor
      // being complained about has to be able to speak for themselves.
      id: 'msg-2',
      senderType: 'LESSOR',
      body: 'التكييف متوقف مؤقتًا للصيانة، والمساحة مطابقة للمخطط المرفق.',
      createdAt: '2026-07-19T13:40:00Z',
    },
    {
      id: 'msg-3',
      senderType: 'ADMIN',
      body: 'طُلب من المؤجر إرفاق صور محدّثة، وجُمّد التحويل حتى حسم الشكوى.',
      createdAt: '2026-07-20T08:05:00Z',
    },
    {
      // Console only. `/me/complaints` never sends one of these, so the
      // interceptor strips it below — the same way the server does.
      id: 'msg-4',
      senderType: 'ADMIN',
      body: 'ملاحظة: نفس المؤجر عليه شكوى سابقة بنفس السبب.',
      isInternal: true,
      createdAt: '2026-07-20T08:07:00Z',
    },
  ],
};

// ── Audit trail ──────────────────────────────────────────────────────────

/**
 * The wire shape — `oldValue`/`newValue` are **objects**, `actor` is nested,
 * and one row has no actor at all.
 *
 * The last of those is the one worth having: a background job and a deleted
 * account both come back with `actor: null`, and a screen that assumed a name
 * would break on a row it can neither reproduce nor delete.
 */
export const MOCK_AUDIT_ROWS: WireAuditEntry[] = [
  {
    id: 'aud-1',
    action: 'settings.updated',
    entityType: 'setting',
    entityId: 'commission.default_rate_bps',
    oldValue: { value: '1000' },
    newValue: { value: '500' },
    actor: { id: 'usr-5', fullName: 'محمد الحربي', adminRole: AdminRole.SystemAdmin },
    actorType: 'ADMIN',
    ipAddress: '10.0.4.18',
    requestId: 'req-8814',
    createdAt: '2026-08-13T10:22:00Z',
  },
  {
    id: 'aud-2',
    action: 'unit.approved',
    entityType: 'unit',
    entityId: 'un-1',
    oldValue: { status: 'PENDING_REVIEW' },
    newValue: { status: 'PUBLISHED' },
    actor: { id: 'usr-6', fullName: 'نوف السالم', adminRole: AdminRole.Operations },
    actorType: 'ADMIN',
    ipAddress: '10.0.4.22',
    requestId: 'req-8790',
    createdAt: '2026-08-13T08:41:00Z',
  },
  {
    // No actor: the hold lapsed on its own. Every screen needs an answer for
    // this, and "—" is one where reaching into null is not.
    id: 'aud-3',
    action: 'booking.expired',
    entityType: 'booking',
    entityId: 'bk-r7',
    oldValue: { status: 'AWAITING_PAYMENT' },
    newValue: { status: 'EXPIRED' },
    actor: null,
    actorType: 'SYSTEM',
    ipAddress: null,
    requestId: 'req-8702',
    createdAt: '2026-08-12T19:05:00Z',
  },
];

/* There is no per-entry audit route: the list already carries every field. */
