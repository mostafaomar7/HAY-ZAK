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
  AuditDetail,
  AuditRow,
  BookingReviewDetail,
  BookingReviewRow,
  LessorBankDetails,
  ListingReviewDetail,
  ListingReviewRow,
  PaymentTrackingRow,
  TermsApprovalRow,
  TermsVersionRow,
} from '../models/admin.model';
import type { WireComplaint, WireComplaintDetail } from '../models/complaint';
import type {
  AdminOverview,
  BookingsReport,
  LessorReportRow,
  RevenueReport,
} from '../models/admin-reports';
import type { WirePlatformSetting } from '../models/platform-setting';
import type { ReferenceData } from '../models/reference-admin';
import type { WireCmsPage } from '../models/cms-page';
import type { AdminDashboardKpis } from '../models/operations.model';
import type { EligiblePayout, Payout } from '../models/payment.model';
import type { Unit } from '../models/unit.model';
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
 */
export const MOCK_REVIEW_UNITS: Unit[] = MOCK_LISTING_QUEUE.map((row) => ({
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
  isApproximateLocation: false,
  addressLine: 'الرياض — حي النرجس، شارع أنس بن مالك',
  visitSchedule: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '09:00', to: '21:00' }],
  images: [],
  status: UnitStatus.PendingReview,
  // `submittedAt` is the last touch before review, which is what the client
  // reads `updatedAt` as; a re-submission is one that has been reviewed before.
  publishedAt: row.submittedAt,
  reviewedAt: row.isEdit ? row.submittedAt : undefined,
  createdAt: row.submittedAt,
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

export const MOCK_PAYMENT_ROWS: PaymentTrackingRow[] = [
  {
    id: 'pay-1',
    bookingReferenceNo: 'HZ-2026-00981',
    renterName: 'عبدالله القحطاني',
    lessorName: 'سعود العنزي',
    unitTitle: 'مستودع مكيّف — النرجس',
    totalHalalas: 52500,
    commissionHalalas: 2625,
    netHalalas: 49875,
    isRefunded: false,
    bucket: 'PAID',
    bankReference: 'TRF-20260812',
  },
  {
    id: 'pay-2',
    bookingReferenceNo: 'HZ-2026-01004',
    renterName: 'سارة العتيبي',
    lessorName: 'سعود العنزي',
    unitTitle: 'غرفة تخزين نظيفة — الياسمين',
    totalHalalas: 31500,
    commissionHalalas: 1575,
    netHalalas: 29925,
    isRefunded: false,
    bucket: 'RELEASABLE',
  },
  {
    id: 'pay-3',
    bookingReferenceNo: 'HZ-2026-01021',
    renterName: 'نورة الشمري',
    lessorName: 'فهد بن سعد العمري',
    unitTitle: 'قراج مغلق — الملقا',
    totalHalalas: 42000,
    commissionHalalas: 2100,
    netHalalas: 39900,
    isRefunded: false,
    bucket: 'PENDING',
  },
  {
    id: 'pay-4',
    bookingReferenceNo: 'HZ-2026-01033',
    renterName: 'ماجد الدوسري',
    lessorName: 'فهد بن سعد العمري',
    unitTitle: 'مستودع أرضي — الصحافة',
    totalHalalas: 66500,
    commissionHalalas: 3325,
    netHalalas: 63175,
    isRefunded: true,
    bucket: 'PENDING',
    bankReference: 'TRF-20260805',
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
    byRole: {
      [UserRole.Guest]: 0,
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
  count: 148,
  // What renters paid. Not revenue — see the commission below.
  grossHalalas: 8_642_000,
  byStatus: {
    [BookingStatus.Draft]: 0,
    [BookingStatus.AwaitingPayment]: 4,
    [BookingStatus.Confirmed]: 38,
    [BookingStatus.Active]: 12,
    [BookingStatus.Completed]: 91,
    [BookingStatus.Expired]: 2,
    [BookingStatus.Cancelled]: 1,
  },
};

/**
 * The revenue, and the two liabilities beside it.
 *
 * `commissionHalalas` is 5% of the gross above, less refunds, which is what
 * makes the arithmetic on the screen checkable by eye — a fixture where the
 * numbers do not relate would let a mislabelled figure look plausible.
 */
export const MOCK_REPORT_REVENUE: RevenueReport = {
  netCashHalalas: 1_240_000,
  commissionHalalas: 424_100,
  owedToLessorsHalalas: 7_912_900,
  vatPayableHalalas: 63_615,
  refundedHalalas: 88_000,
  paidOutHalalas: 7_402_000,
};

export const MOCK_REPORT_LESSORS: LessorReportRow[] = [
  {
    lessorId: 'lsr-1',
    lessorName: 'سعود العنزي',
    unitsCount: 9,
    bookingsCount: 41,
    grossHalalas: 2_480_000,
    commissionHalalas: 124_000,
    netToLessorHalalas: 2_356_000,
  },
  {
    lessorId: 'lsr-2',
    lessorName: 'فهد بن سعد العمري',
    unitsCount: 5,
    bookingsCount: 27,
    grossHalalas: 1_610_000,
    commissionHalalas: 80_500,
    netToLessorHalalas: 1_529_500,
  },
  {
    lessorId: 'lsr-3',
    lessorName: 'منى الحربي',
    unitsCount: 3,
    bookingsCount: 12,
    grossHalalas: 740_000,
    commissionHalalas: 37_000,
    netToLessorHalalas: 703_000,
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
    key: 'finance.commission_rate_bps',
    // A string, as the wire sends it. A fixture with a real number would let a
    // screen bind an input to one and still look correct here.
    value: '500',
    dataType: 'number',
    group: 'financial',
    labelAr: 'نسبة عمولة المنصة',
    labelEn: 'Platform commission rate',
    hintAr: 'تُخصم من المؤجّر ولا تُضاف على المستأجر. القيمة بالنقاط الأساسية — 500 تعني 5%.',
    hintEn: 'Deducted from the lessor, not added to the renter. In basis points — 500 is 5%.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'finance.vat_rate_bps',
    value: '1500',
    dataType: 'number',
    group: 'financial',
    labelAr: 'نسبة ضريبة القيمة المضافة',
    labelEn: 'VAT rate',
    hintAr: 'تُطبَّق على العمولة. 1500 تعني 15%.',
    hintEn: 'Applied to the commission. 1500 is 15%.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'finance.payout_cycle_hours',
    value: '168',
    dataType: 'number',
    group: 'financial',
    labelAr: 'دورة التحويل',
    labelEn: 'Payout cycle',
    hintAr: 'المدة بين دورتي صرف المستحقات، بالساعات.',
    hintEn: 'Hours between payout runs.',
    isEditable: true,
    isPublic: false,
  },
  {
    key: 'operations.approval_sla_hours',
    value: '24',
    dataType: 'number',
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
    dataType: 'number',
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
    dataType: 'number',
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
    dataType: 'string',
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
 * All four lists in one object, with `isActive` on every row — the shape
 * `GET /admin/reference` answers with.
 *
 * One entry is deactivated on purpose: a fixture where everything is on would
 * demo a screen whose only real action never shows its effect.
 */
export const MOCK_REFERENCE_DATA: ReferenceData = {
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
  cities: [
    { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh', sortOrder: 1, isActive: true },
    { id: 'city-2', nameAr: 'جدة', nameEn: 'Jeddah', sortOrder: 2, isActive: true },
    { id: 'city-3', nameAr: 'الدمام', nameEn: 'Dammam', sortOrder: 3, isActive: true },
  ],
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
    booking: { id: 'bk-r3', referenceNo: 'HZ-2026-01021', unitTitle: 'مستودع مكيّف — النرجس' },
    category: ComplaintCategory.SpaceNotAsDescribed,
    subject: 'الوحدة غير مطابقة للوصف المنشور',
    status: ComplaintStatus.InProgress,
    slaDueAt: '2026-07-19T09:10:00Z',
    isOverdue: true,
    firstResponseAt: '2026-07-19T13:40:00Z',
    createdAt: '2026-07-18T09:10:00Z',
    updatedAt: '2026-07-20T08:05:00Z',
  },
  {
    id: 'cmp-2',
    referenceNo: 'CMP-2026-08-0051',
    booking: { id: 'bk-r4', referenceNo: 'HZ-2026-01033', unitTitle: 'غرفة تخزين — الياسمين' },
    category: ComplaintCategory.AccessProblem,
    subject: 'تأخر تسليم مفاتيح المستودع',
    status: ComplaintStatus.Open,
    slaDueAt: '2026-08-05T12:00:00Z',
    isOverdue: false,
    // Nobody has answered this one yet, which is a different thing from new.
    firstResponseAt: null,
    createdAt: '2026-08-04T11:20:00Z',
    updatedAt: '2026-08-04T11:20:00Z',
  },
  {
    id: 'cmp-3',
    referenceNo: 'CMP-2026-08-0038',
    booking: { id: 'bk-r5', referenceNo: 'HZ-2026-00981', unitTitle: 'مستودع صغير — الملقا' },
    category: ComplaintCategory.ProhibitedGoods,
    subject: 'بضاعة مخالفة لقائمة الممنوعات',
    status: ComplaintStatus.Resolved,
    slaDueAt: '2026-07-03T09:00:00Z',
    isOverdue: false,
    firstResponseAt: '2026-07-02T15:00:00Z',
    createdAt: '2026-07-02T08:00:00Z',
    updatedAt: '2026-07-04T10:00:00Z',
  },
];

export const MOCK_COMPLAINT_DETAIL: WireComplaintDetail = {
  ...MOCK_COMPLAINTS[0],
  description:
    'المساحة الفعلية أصغر من المعلن، ولا يوجد تكييف كما ورد في الوصف. زرت المكان يوم الأحد ووجدت الباب الداخلي مغلقًا.',
  attachments: [],
  resolution: null,
  resolutionNote: null,
  resolvedAt: null,
  assignedToName: 'نوف السالم',
  refunds: [],
  messages: [
    {
      id: 'msg-1',
      authorName: 'نورة الشمري',
      body: 'المساحة الفعلية أصغر من المعلن، ولا يوجد تكييف كما ورد في الوصف.',
      attachments: [],
      sentAt: '2026-07-18T09:10:00Z',
    },
    {
      // The other party to the booking answers in the same thread — the lessor
      // being complained about has to be able to speak for themselves.
      id: 'msg-2',
      authorName: 'فهد بن سعد العمري',
      body: 'التكييف متوقف مؤقتًا للصيانة، والمساحة مطابقة للمخطط المرفق.',
      attachments: [],
      sentAt: '2026-07-19T13:40:00Z',
    },
    {
      id: 'msg-3',
      authorName: 'نوف السالم — مشرف العمليات',
      body: 'طُلب من المؤجر إرفاق صور محدّثة، وجُمّد التحويل حتى حسم الشكوى.',
      attachments: [],
      sentAt: '2026-07-20T08:05:00Z',
    },
    {
      // Console only. `/me/complaints` never sends one of these, so the
      // interceptor strips it below — the same way the server does.
      id: 'msg-4',
      authorName: 'نوف السالم — مشرف العمليات',
      body: 'ملاحظة: نفس المؤجر عليه شكوى سابقة بنفس السبب.',
      attachments: [],
      isInternal: true,
      sentAt: '2026-07-20T08:07:00Z',
    },
  ],
};

// ── Audit trail ──────────────────────────────────────────────────────────

export const MOCK_AUDIT_ROWS: AuditRow[] = [
  {
    id: 'aud-1',
    actorName: 'محمد الحربي',
    actorRole: UserRole.Admin,
    actorAdminRole: AdminRole.SystemAdmin,
    action: 'تعديل الإعدادات المالية — نسبة العمولة',
    occurredAt: '2026-08-13T10:22:00Z',
    oldValue: '10 بالمئة',
    newValue: '5 بالمئة',
  },
  {
    id: 'aud-2',
    actorName: 'نوف السالم',
    actorRole: UserRole.Admin,
    actorAdminRole: AdminRole.Operations,
    action: 'اعتماد إعلان — مستودع مكيّف، النرجس',
    occurredAt: '2026-08-13T08:41:00Z',
    oldValue: 'قيد المراجعة',
    newValue: 'منشورة',
  },
  {
    id: 'aud-3',
    actorName: 'ريم الغامدي',
    actorRole: UserRole.Admin,
    actorAdminRole: AdminRole.Finance,
    action: 'تنفيذ تحويل مالي — HZ-2026-01004',
    occurredAt: '2026-08-12T14:07:00Z',
    oldValue: 'مستحق',
    newValue: 'محوّل — TRF-20260814',
  },
  {
    id: 'aud-4',
    actorName: 'نوف السالم',
    actorRole: UserRole.Admin,
    actorAdminRole: AdminRole.Operations,
    action: 'رفض حجز — HZ-2026-00964',
    occurredAt: '2026-08-11T17:55:00Z',
    oldValue: 'مدفوع — بانتظار الموافقة',
    newValue: 'مرفوض ومُسترد',
  },
  {
    id: 'aud-5',
    actorName: 'محمد الحربي',
    actorRole: UserRole.Admin,
    actorAdminRole: AdminRole.SystemAdmin,
    action: 'إيقاف مستخدم — نورة الشمري',
    occurredAt: '2026-08-10T09:30:00Z',
    oldValue: 'نشط',
    newValue: 'موقوف',
  },
];

export const MOCK_AUDIT_DETAIL: AuditDetail = {
  ...MOCK_AUDIT_ROWS[0],
  entityType: 'PlatformSettings',
  entityId: 'commissionRate',
  ipAddress: '188.55.204.19',
  userAgent: 'Chrome 151 · Windows',
};
