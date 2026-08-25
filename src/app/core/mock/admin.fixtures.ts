import { BookingStatus } from '../enums/booking-status.enum';
import { DisputeStatus, LegalDocumentType } from '../enums/operations.enum';
import { PayoutStatus } from '../enums/payment.enum';
import { AccountStatus, UserRole } from '../enums/user-role.enum';
import { TermsVersionStatus } from '../models/admin.model';
import type {
  AdminUserDetail,
  AdminUserRow,
  AuditDetail,
  AuditRow,
  BookingReviewDetail,
  BookingReviewRow,
  BookingsReportRow,
  CmsPageDetail,
  CommissionException,
  ComplaintDetail,
  ComplaintRow,
  LessorBankDetails,
  ListingReviewDetail,
  ListingReviewRow,
  OccupancyReportRow,
  PayoutGroup,
  PayoutReportRow,
  PaymentTrackingRow,
  ReferenceListRow,
  RevenueReportRow,
  TermsApprovalRow,
  TermsVersionRow,
} from '../models/admin.model';
import type { AdminDashboardKpis, PlatformSettings } from '../models/operations.model';
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
export const MOCK_ADMIN_USER: User = {
  id: 'usr-5',
  fullName: 'محمد الحربي',
  mobile: '0509001122',
  email: 'operations@hayzak.com',
  role: UserRole.SystemAdministrator,
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
  usersByRole: { Renter: 946, Lessor: 331, OperationsSupervisor: 4, FinanceOfficer: 2 },
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
    payoutStatus: PayoutStatus.Paid,
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
    payoutStatus: PayoutStatus.Processing,
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
    payoutStatus: PayoutStatus.OnHold,
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
    payoutStatus: PayoutStatus.Failed,
    bankReference: 'TRF-20260805',
  },
];

export const MOCK_PAYOUT_GROUPS: PayoutGroup[] = [
  {
    lessorId: 'lsr-1',
    lessorName: 'سعود العنزي',
    bankName: 'البنك الأهلي السعودي',
    accountHolder: 'سعود بن ناصر العنزي',
    ibanMasked: 'SA•• •••• •••• •••• 4523',
    totalDue: 1197,
    rowCount: 3,
    bankDetailsMissing: false,
    rows: [
      {
        id: 'po-1',
        bookingReferenceNo: 'HZ-2026-00981',
        unitTitle: 'مستودع مكيّف — النرجس',
        dueDate: '2026-08-13',
        netHalalas: 49875,
        status: PayoutStatus.Due,
      },
      {
        id: 'po-2',
        bookingReferenceNo: 'HZ-2026-01004',
        unitTitle: 'غرفة تخزين نظيفة — الياسمين',
        dueDate: '2026-08-14',
        netHalalas: 29925,
        status: PayoutStatus.Paid,
        bankReference: 'TRF-20260814',
      },
      {
        id: 'po-3',
        bookingReferenceNo: 'HZ-2026-01033',
        unitTitle: 'مستودع أرضي — الصحافة',
        dueDate: '2026-08-10',
        netHalalas: 39900,
        status: PayoutStatus.Failed,
        note: 'رفض البنك التحويل: اسم صاحب الحساب لا يطابق اسم المؤجر في السجل.',
      },
    ],
  },
  {
    lessorId: 'lsr-2',
    lessorName: 'فهد بن سعد العمري',
    totalDue: 798,
    rowCount: 2,
    bankDetailsMissing: true,
    rows: [
      {
        id: 'po-4',
        bookingReferenceNo: 'HZ-2026-01021',
        unitTitle: 'قراج مغلق — الملقا',
        dueDate: '2026-08-12',
        netHalalas: 39900,
        status: PayoutStatus.OnHold,
        note: 'مجمّد حتى إغلاق الشكوى CMP-2026-0042 المرتبطة بهذا الحجز.',
      },
      {
        id: 'po-5',
        bookingReferenceNo: 'HZ-2026-01044',
        unitTitle: 'قراج مغلق — الملقا',
        dueDate: '2026-08-15',
        netHalalas: 39900,
        status: PayoutStatus.Due,
        note: 'بيانات الحساب البنكي غير مكتملة لدى المؤجر.',
      },
    ],
  },
];

export const MOCK_BANK_DETAILS: LessorBankDetails = {
  bankName: 'البنك الأهلي السعودي',
  accountHolder: 'سعود بن ناصر العنزي',
  iban: 'SA44 2000 0001 2345 6789 4523',
};

// ── Reports ──────────────────────────────────────────────────────────────

export const MOCK_REPORT_BOOKINGS: BookingsReportRow[] = [
  { month: '2026-04-01', count: 62, totalValue: 31_400 },
  { month: '2026-05-01', count: 78, totalValue: 40_120 },
  { month: '2026-06-01', count: 95, totalValue: 51_880 },
  { month: '2026-07-01', count: 121, totalValue: 66_950 },
  { month: '2026-08-01', count: 148, totalValue: 86_420 },
];

export const MOCK_REPORT_REVENUE: RevenueReportRow[] = MOCK_REPORT_BOOKINGS.map((row) => {
  const commission = Math.round(row.totalValue * 0.05 * 100) / 100;
  const vat = Math.round(commission * 0.15 * 100) / 100;
  return {
    month: row.month,
    revenue: row.totalValue,
    commission,
    vat,
    netToLessors: Math.round((row.totalValue - commission) * 100) / 100,
  };
});

export const MOCK_REPORT_PAYOUTS: PayoutReportRow[] = [
  {
    lessorId: 'lsr-1',
    lessorName: 'سعود العنزي',
    totalDue: 12_480,
    transferred: 10_982,
    remaining: 1498,
  },
  {
    lessorId: 'lsr-2',
    lessorName: 'فهد بن سعد العمري',
    totalDue: 7940,
    transferred: 4160,
    remaining: 3780,
  },
];

export const MOCK_REPORT_OCCUPANCY: OccupancyReportRow[] = [
  {
    cityName: 'الرياض',
    categoryName: 'مستودع',
    unitCount: 96,
    bookedDays: 2184,
    occupancyRate: 74,
  },
  {
    cityName: 'الرياض',
    categoryName: 'غرفة تخزين',
    unitCount: 71,
    bookedDays: 1320,
    occupancyRate: 61,
  },
  { cityName: 'الرياض', categoryName: 'قراج', unitCount: 34, bookedDays: 512, occupancyRate: 49 },
  {
    cityName: 'الرياض',
    categoryName: 'مكان مكشوف',
    unitCount: 13,
    bookedDays: 148,
    occupancyRate: 37,
  },
];

// ── Financial settings ───────────────────────────────────────────────────

/**
 * The runtime configuration FR-ADM-06 exposes. The commission rate here is the
 * design's 5%, which disagrees with `FINANCIAL_DEFAULTS.commissionRateBps` — that
 * disagreement is an open client decision (SRS §15 item 3) and is recorded in
 * docs/design/admin-plan.md rather than silently reconciled.
 */
export const MOCK_SETTINGS: PlatformSettings = {
  commissionRateBps: 500,
  commissionBearer: 'lessor',
  vatRateBps: 1500,
  vatBase: 'commission',
  payoutCycleHours: 168,
  approvalSlaHours: 24,
  autoApproveBookings: false,
  cancellationPolicy: [
    { minDaysBeforeStart: 7, refundPercentage: 1 },
    { minDaysBeforeStart: 3, refundPercentage: 0.5 },
    { minDaysBeforeStart: 0, refundPercentage: 0 },
  ],
};

export const MOCK_COMMISSION_EXCEPTIONS: CommissionException[] = [
  {
    id: 'ex-1',
    scope: 'unit',
    targetId: 'unit-r2',
    targetName: 'غرفة تخزين نظيفة — الياسمين',
    rateBps: 300,
  },
  { id: 'ex-2', scope: 'lessor', targetId: 'lsr-2', targetName: 'فهد بن سعد العمري', rateBps: 700 },
];

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
    role: UserRole.SystemAdministrator,
    mobile: '+966 50 900 1122',
    email: 'operations@hayzak.com',
    registeredAt: '2026-01-04',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-6',
    fullName: 'نوف السالم',
    role: UserRole.OperationsSupervisor,
    mobile: '+966 54 220 8891',
    email: 'nouf@hayzak.com',
    registeredAt: '2026-01-19',
    status: AccountStatus.Active,
  },
  {
    id: 'usr-7',
    fullName: 'ريم الغامدي',
    role: UserRole.FinanceOfficer,
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

export const MOCK_REF_LISTS: Record<string, ReferenceListRow[]> = {
  categories: [
    { id: 'cat-1', nameAr: 'مستودع', nameEn: 'Warehouse', sortOrder: 1, linkedCount: 96 },
    { id: 'cat-2', nameAr: 'غرفة تخزين', nameEn: 'Storage room', sortOrder: 2, linkedCount: 71 },
    { id: 'cat-3', nameAr: 'قراج', nameEn: 'Garage', sortOrder: 3, linkedCount: 34 },
    { id: 'cat-4', nameAr: 'مكان مكشوف', nameEn: 'Open space', sortOrder: 4, linkedCount: 13 },
  ],
  cities: [
    { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh', sortOrder: 1, linkedCount: 214 },
    { id: 'city-2', nameAr: 'جدة', nameEn: 'Jeddah', sortOrder: 2, linkedCount: 0 },
    { id: 'city-3', nameAr: 'الدمام', nameEn: 'Dammam', sortOrder: 3, linkedCount: 0 },
  ],
  districts: [
    { id: 'dst-1', nameAr: 'حي النرجس', nameEn: 'Al Narjis', sortOrder: 1, linkedCount: 42 },
    { id: 'dst-2', nameAr: 'حي الياسمين', nameEn: 'Al Yasmin', sortOrder: 2, linkedCount: 37 },
    { id: 'dst-3', nameAr: 'حي الملقا', nameEn: 'Al Malqa', sortOrder: 3, linkedCount: 28 },
    { id: 'dst-4', nameAr: 'حي الصحافة', nameEn: 'Al Sahafah', sortOrder: 4, linkedCount: 19 },
  ],
  prohibitedItems: [
    {
      id: 'prh-1',
      nameAr: 'المواد القابلة للاشتعال',
      nameEn: 'Flammable materials',
      sortOrder: 1,
      linkedCount: 0,
    },
    {
      id: 'prh-2',
      nameAr: 'المواد الكيميائية الخطرة',
      nameEn: 'Hazardous chemicals',
      sortOrder: 2,
      linkedCount: 0,
    },
    {
      id: 'prh-3',
      nameAr: 'الأسلحة والذخائر',
      nameEn: 'Weapons and ammunition',
      sortOrder: 3,
      linkedCount: 0,
    },
    {
      id: 'prh-4',
      nameAr: 'المواد الغذائية سريعة التلف',
      nameEn: 'Perishable food',
      sortOrder: 4,
      linkedCount: 0,
    },
    {
      id: 'prh-5',
      nameAr: 'الحيوانات الحية',
      nameEn: 'Live animals',
      sortOrder: 5,
      linkedCount: 0,
    },
  ],
};

// ── CMS ──────────────────────────────────────────────────────────────────

export const MOCK_CMS_PAGES: CmsPageDetail[] = [
  {
    slug: 'about',
    titleAr: 'من نحن',
    titleEn: 'About us',
    bodyAr:
      'حيزك منصة سعودية تربط من يملك مساحة تخزين غير مستغلة بمن يحتاجها، بعقد واضح وسعر معروض قبل أي خطوة.',
    bodyEn: '',
    seoTitle: 'من نحن — حيزك',
    seoDescription: 'تعرّف على منصة حيزك ودورها في تأجير مساحات التخزين في السعودية.',
    updatedAt: '2026-08-02',
  },
  {
    slug: 'how-it-works',
    titleAr: 'كيف تعمل المنصة',
    titleEn: 'How it works',
    bodyAr: 'ثلاث خطوات: ابحث واختر المساحة، احجز وادفع، ثم استلم المساحة بعد اعتماد الطلب.',
    bodyEn: '',
    seoTitle: 'كيف تعمل منصة حيزك',
    seoDescription: 'خطوات الحجز في حيزك من البحث حتى استلام المساحة.',
    updatedAt: '2026-07-28',
  },
  {
    slug: 'faq',
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'FAQ',
    bodyAr: 'إجابات عن أكثر الأسئلة تكرارًا حول الحجز والدفع والإلغاء.',
    bodyEn: '',
    seoTitle: 'الأسئلة الشائعة — حيزك',
    seoDescription: 'إجابات عن الحجز والدفع والإلغاء والاسترداد في منصة حيزك.',
    updatedAt: '2026-08-11',
  },
  {
    slug: 'terms',
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms',
    bodyAr: 'تحكم هذه الشروط استخدام المنصة من المؤجرين والمستأجرين.',
    bodyEn: '',
    seoTitle: 'الشروط والأحكام — حيزك',
    seoDescription: 'الشروط والأحكام المنظمة لاستخدام منصة حيزك.',
    updatedAt: '2026-06-15',
  },
  {
    slug: 'privacy',
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy policy',
    bodyAr: 'نوضّح هنا البيانات التي نجمعها وكيف تُستخدم وتُحفظ.',
    bodyEn: '',
    seoTitle: 'سياسة الخصوصية — حيزك',
    seoDescription: 'كيف تجمع منصة حيزك البيانات الشخصية وتحميها.',
    updatedAt: '2026-06-15',
  },
  {
    slug: 'refund-policy',
    titleAr: 'سياسة الإلغاء والاسترداد',
    titleEn: 'Refund policy',
    bodyAr: 'تعتمد نسبة الاسترداد على المدة المتبقية قبل بداية الحجز.',
    bodyEn: '',
    seoTitle: 'سياسة الإلغاء والاسترداد — حيزك',
    seoDescription: 'نسب الاسترداد حسب موعد الإلغاء قبل بداية الحجز.',
    updatedAt: '2026-07-04',
  },
  {
    slug: 'contact',
    titleAr: 'التواصل معنا',
    titleEn: 'Contact us',
    bodyAr: 'فريق الدعم متاح من الأحد إلى الخميس، من التاسعة صباحًا حتى الخامسة مساءً.',
    bodyEn: '',
    seoTitle: 'التواصل معنا — حيزك',
    seoDescription: 'قنوات التواصل مع فريق دعم منصة حيزك.',
    updatedAt: '2026-08-09',
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

export const MOCK_COMPLAINTS: ComplaintRow[] = [
  {
    id: 'cmp-1',
    referenceNo: 'CMP-2026-0042',
    bookingReferenceNo: 'HZ-2026-01021',
    raisedByName: 'نورة الشمري',
    subject: 'الوحدة غير مطابقة للوصف المنشور',
    status: DisputeStatus.UnderReview,
    openedAt: '2026-07-18',
  },
  {
    id: 'cmp-2',
    referenceNo: 'CMP-2026-0051',
    bookingReferenceNo: 'HZ-2026-01033',
    raisedByName: 'ماجد الدوسري',
    subject: 'تأخر تسليم مفاتيح المستودع',
    status: DisputeStatus.Open,
    openedAt: '2026-08-04',
  },
  {
    id: 'cmp-3',
    referenceNo: 'CMP-2026-0038',
    bookingReferenceNo: 'HZ-2026-00981',
    raisedByName: 'سعود العنزي',
    subject: 'بضاعة مخالفة لقائمة الممنوعات',
    status: DisputeStatus.Closed,
    openedAt: '2026-07-02',
  },
];

export const MOCK_COMPLAINT_DETAIL: ComplaintDetail = {
  ...MOCK_COMPLAINTS[0],
  bookingId: 'bk-r3',
  raisedByRole: UserRole.Renter,
  bookingHalalas: 42000,
  payoutFrozen: true,
  messages: [
    {
      id: 'msg-1',
      authorName: 'نورة الشمري',
      body: 'المساحة الفعلية أصغر من المعلن، ولا يوجد تكييف كما ورد في الوصف.',
      sentAt: '2026-07-18T09:10:00Z',
    },
    {
      id: 'msg-2',
      authorName: 'فهد بن سعد العمري',
      body: 'التكييف متوقف مؤقتًا للصيانة، والمساحة مطابقة للمخطط المرفق.',
      sentAt: '2026-07-19T13:40:00Z',
    },
    {
      id: 'msg-3',
      authorName: 'نوف السالم — مشرف العمليات',
      body: 'طُلب من المؤجر إرفاق صور محدّثة، وجُمّد التحويل حتى إغلاق الشكوى.',
      sentAt: '2026-07-20T08:05:00Z',
    },
  ],
};

// ── Audit trail ──────────────────────────────────────────────────────────

export const MOCK_AUDIT_ROWS: AuditRow[] = [
  {
    id: 'aud-1',
    actorName: 'محمد الحربي',
    actorRole: UserRole.SystemAdministrator,
    action: 'تعديل الإعدادات المالية — نسبة العمولة',
    occurredAt: '2026-08-13T10:22:00Z',
    oldValue: '10 بالمئة',
    newValue: '5 بالمئة',
  },
  {
    id: 'aud-2',
    actorName: 'نوف السالم',
    actorRole: UserRole.OperationsSupervisor,
    action: 'اعتماد إعلان — مستودع مكيّف، النرجس',
    occurredAt: '2026-08-13T08:41:00Z',
    oldValue: 'قيد المراجعة',
    newValue: 'منشورة',
  },
  {
    id: 'aud-3',
    actorName: 'ريم الغامدي',
    actorRole: UserRole.FinanceOfficer,
    action: 'تنفيذ تحويل مالي — HZ-2026-01004',
    occurredAt: '2026-08-12T14:07:00Z',
    oldValue: 'مستحق',
    newValue: 'محوّل — TRF-20260814',
  },
  {
    id: 'aud-4',
    actorName: 'نوف السالم',
    actorRole: UserRole.OperationsSupervisor,
    action: 'رفض حجز — HZ-2026-00964',
    occurredAt: '2026-08-11T17:55:00Z',
    oldValue: 'مدفوع — بانتظار الموافقة',
    newValue: 'مرفوض ومُسترد',
  },
  {
    id: 'aud-5',
    actorName: 'محمد الحربي',
    actorRole: UserRole.SystemAdministrator,
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
