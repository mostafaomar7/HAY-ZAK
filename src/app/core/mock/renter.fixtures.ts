import { API_ENDPOINTS } from '../constants/api-endpoints';
import { BookingStatus } from '../enums/booking-status.enum';
import { NotificationChannel, NotificationType } from '../enums/operations.enum';
import { UnitStatus } from '../enums/unit-status.enum';
import { VerificationStatus } from '../enums/user-role.enum';
import type { Booking, BookingStatusHistoryEntry } from '../models/booking.model';
import type { StaticPage, StaticPageSlug } from '../models/content.model';
import type { IdentityVerification, NafathSession } from '../models/identity.model';
import type { AppNotification } from '../models/operations.model';
import type { Invoice } from '../models/payment.model';
import type {
  AlternativePeriod,
  CancellationQuote,
  NotificationPreference,
  RenterProfile,
} from '../models/renter.model';
import type { ReferenceItem, Unit, UnitAvailabilityBlock } from '../models/unit.model';
import { LegalDocumentType } from '../enums/operations.enum';

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

function marketUnit(
  id: string,
  title: string,
  cat: ReferenceItem,
  districtName: [string, string],
  areaSqm: number,
  dailyPrice: number,
  distanceKm: number,
  latitude: number,
  longitude: number,
  perks: string[],
  status: UnitStatus = UnitStatus.Published,
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
    dailyPrice,
    indicativeMonthlyPrice: dailyPrice * 30,
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
    images: [],
    status,
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
    // FR-MKT-10 — a booked unit is still listed but cannot be booked now.
    UnitStatus.FullyBooked,
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
  const subtotal = unit.dailyPrice * daysCount;
  const commissionAmount = Math.round(subtotal * 0.05 * 100) / 100;

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
        status === BookingStatus.Approved ||
        status === BookingStatus.Active ||
        status === BookingStatus.Completed
          ? unit.addressLine
          : undefined,
      postalCode:
        status === BookingStatus.Approved ||
        status === BookingStatus.Active ||
        status === BookingStatus.Completed
          ? unit.postalCode
          : undefined,
    },
    renterId: 'renter-1',
    startDate,
    endDate,
    daysCount,
    dailyPriceSnapshot: unit.dailyPrice,
    subtotal,
    commissionAmount,
    // The renter pays the listed rent; commission and its VAT come out of the
    // owner's share, which is what the design's "—" line means.
    vatAmount: Math.round(commissionAmount * 0.15 * 100) / 100,
    totalAmount: subtotal,
    netToLessor: Math.round((subtotal - commissionAmount * 1.15) * 100) / 100,
    goodsDescription:
      'أثاث منزلي مفكّك يتضمّن غرفة نوم وطاولة طعام وستة كراسي، مع اثني عشر صندوقًا من الأدوات المنزلية والكتب. لا توجد أجهزة تعمل بالوقود.',
    prohibitedAck: true,
    status,
    counterpartyContact:
      status === BookingStatus.Approved || status === BookingStatus.Active
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
    BookingStatus.Approved,
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
    BookingStatus.PaidPendingApproval,
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
    BookingStatus.RejectedRefunded,
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
    toStatus: BookingStatus.PaidPendingApproval,
    changedAt: '2026-08-12T09:26:00Z',
  },
  {
    fromStatus: BookingStatus.PaidPendingApproval,
    toStatus: BookingStatus.Approved,
    changedBy: 'ops-1',
    changedAt: '2026-08-12T13:40:00Z',
  },
];

export const MOCK_INVOICE: Invoice = {
  id: 'inv-1',
  bookingId: 'rb-1',
  invoiceNo: 'INV-2026-04871',
  taxableAmount: 1800,
  vatAmount: 13.5,
  total: 1800,
  qrCode: 'zatca-qr-placeholder',
  pdfUrl: '/files/invoices/INV-2026-04871.pdf',
  issuedAt: '2026-08-12',
};

export const MOCK_CANCELLATION_QUOTE: CancellationQuote = {
  bookingId: 'rb-1',
  appliedRule: 'earlyCancellation',
  daysBeforeStart: 9,
  totalPaid: 1800,
  refundAmount: 1800,
  refundPercentage: 1,
  refundDestination: 'مدى ••8130',
  refundEtaBusinessDays: 10,
};

export const MOCK_ALTERNATIVES: AlternativePeriod[] = [
  { startDate: '2026-09-15', endDate: '2026-10-14', daysCount: 30, totalAmount: 2250 },
  { startDate: '2026-09-20', endDate: '2026-10-04', daysCount: 15, totalAmount: 1125 },
  { startDate: '2026-10-01', endDate: '2026-12-30', daysCount: 90, totalAmount: 7650 },
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
const PROHIBITED_TEXT = MOCK_PROHIBITED_ITEMS.map((item) => item.nameAr);

const ABOUT: StaticPage = {
  slug: 'about',
  title: 'من نحن',
  updatedAt: '2026-08-12',
  intro:
    'منصة حيزك سوق سعودي لتأجير مساحات التخزين بين الأفراد. تربط المنصة من يملك مساحة غير مستغلة — مستودعًا أو غرفة أو قراجًا أو مكانًا مكشوفًا — بمن يحتاج مساحة لتخزين بضاعته أو أمتعته لمدة محددة، وتدير العلاقة بينهما من العرض إلى الحجز إلى الفاتورة.',
  sections: [
    {
      id: 'idea',
      title: 'الفكرة',
      body: 'في كل حي مساحات فارغة لا تُستخدم: قراج معطّل، غرفة إضافية، ساحة مسوّرة خلف منزل. وفي المقابل هناك من يحتاج مساحة لأسبوعين أو لثلاثة أشهر ولا يجد إلا مستودعات كبيرة بعقود طويلة. حيزك تجعل هذا التبادل ممكنًا بحد أدنى ثلاثة أيام وسعر يومي معروض قبل أي خطوة.',
    },
    {
      id: 'relationship',
      title: 'كيف تعمل العلاقة',
      body: 'المؤجر يعرض مساحته ويحدد سعرها اليومي، وتراجع إدارة المنصة الإعلان قبل نشره. المستأجر يبحث ويحجز ويدفع داخل المنصة، ثم تراجع الإدارة الطلب قبل اعتماده. دور المنصة تنظيم الحجز والتحصيل وإصدار الفاتورة وتسوية مستحقات المؤجر.',
      items: [
        'المنصة وسيط في الحجز والتحصيل، ولا تتولّى نقل البضاعة ولا تفتيشها ولا حفظها.',
        'مسؤولية ما يُخزَّن وحالته تقع على الطرفين وفق الشروط والأحكام.',
        'قائمة الممنوعات ملزمة في كل حجز.',
      ],
    },
  ],
  commitments: [
    {
      title: 'سعر معروض قبل أي خطوة',
      body: 'السعر اليومي والعمولة والضريبة والإجمالي ظاهرة قبل الدفع، بلا مبالغ تظهر لاحقًا.',
    },
    {
      title: 'حجز موثّق داخل المنصة',
      body: 'كل حجز له رقم مرجعي وفاتورة ضريبية وسجل مراحل يمكن الرجوع إليه.',
    },
    {
      title: 'استرداد واضح',
      body: 'الاسترداد كامل عند رفض الطلب، ومحسوب ومعروض قبل تأكيد أي إلغاء.',
    },
    {
      title: 'قائمة ممنوعات ملزمة',
      body: 'خمسة أصناف ممنوعة في كل مساحة، ويُطلب الإقرار بها في كل حجز.',
    },
  ],
  coverage: [
    'الرياض — النرجس',
    'الرياض — الياسمين',
    'الرياض — الملقا',
    'الرياض — حطين',
    'الرياض — الصحافة',
    'جدة — الروضة',
    'جدة — الشاطئ',
    'جدة — السلامة',
    'الدمام — الفيصلية',
  ],
};

const HOW_IT_WORKS: StaticPage = {
  slug: 'how-it-works',
  title: 'كيف تعمل المنصة',
  subtitle: 'مسار المستأجر ومسار المؤجر خطوة بخطوة',
  sections: [
    {
      id: 'pricing',
      title: 'تفصيل السعر كما يُعرض دائمًا',
      body: 'قيمة الإيجار هي السعر اليومي مضروبًا في عدد الأيام. تستحق المنصة عمولتها من المؤجر، وتُطبَّق ضريبة القيمة المضافة وفق النظام. يُعرض الإجمالي المستحق على المستأجر كاملًا قبل الدفع.',
      items: [
        'الدفع يجري قبل مراجعة الإدارة.',
        'عند رفض الطلب يُستَرد المبلغ كاملًا إلى وسيلة الدفع نفسها.',
        'عند الإلغاء يُحسب المبلغ المسترد وفق السياسة ويُعرض قبل التأكيد.',
      ],
    },
  ],
  journeys: [
    {
      id: 'renter',
      title: 'إذا كنت تبحث عن مساحة',
      steps: [
        {
          number: '٠١',
          title: 'البحث والمقارنة',
          body: 'حدّد المدينة أو الحي والفئة وتاريخ البداية والمدة، وقارن بالسعر اليومي والمساحة والمسافة. الموقع يُعرض داخل دائرة نصف قطرها 300 متر قبل الاعتماد.',
        },
        {
          number: '٠٢',
          title: 'بيانات الحجز',
          body: 'اختر التواريخ من تقويم يمنع المحجوز والماضي، واكتب وصف البضاعة، وأقرّ بقائمة الممنوعات، ثم راجع تفصيل السعر.',
        },
        {
          number: '٠٣',
          title: 'الدفع والاعتماد',
          body: 'تُحجز التواريخ لك خمس عشرة دقيقة أثناء الدفع. بعد الدفع تراجع الإدارة الطلب، وعند الاعتماد يظهر العنوان الدقيق وتبدأ المدة.',
        },
      ],
    },
    {
      id: 'lessor',
      title: 'إذا كنت تملك مساحة',
      steps: [
        {
          number: '٠١',
          title: 'عرض المساحة',
          body: 'أدخل الفئة والعنوان والوصف والمساحة التقريبية والسعر اليومي، ويُعرض المكافئ الشهري الاسترشادي فورًا.',
        },
        {
          number: '٠٢',
          title: 'الموقع والصور',
          body: 'حدّد الموقع على الخريطة وأضف مواعيد المعاينة، وأرفق صورتين على الأقل للمساحة.',
        },
        {
          number: '٠٣',
          title: 'المراجعة والنشر',
          body: 'تراجع الإدارة الإعلان قبل نشره في السوق. الطلبات الواردة تُعرض عليك للمتابعة، وتُسوّى المستحقات على حسابك البنكي.',
        },
      ],
    },
  ],
};

const FAQ: StaticPage = {
  slug: 'faq',
  title: 'الأسئلة الشائعة',
  subtitle: 'أكثر ما يُسأل عنه في الحجز والدفع والاسترداد وعرض المساحات',
  sections: [],
  faqGroups: [
    {
      id: 'booking',
      title: 'الحجز والتواريخ',
      items: [
        {
          id: 'q-min',
          question: 'ما الحد الأدنى لمدة الحجز؟',
          answer:
            'ثلاثة أيام، والحد الأعلى تسعون يومًا في الحجز الواحد. يُحسب تاريخ الانتهاء تلقائيًا ويُعرض قبل المتابعة.',
        },
        {
          id: 'q-account',
          question: 'هل يمكنني الحجز دون إنشاء حساب؟',
          answer:
            'التصفح والبحث وعرض تفاصيل المساحات متاح بالكامل دون تسجيل. يُطلب إنشاء الحساب والتحقق من رقم الجوال عند الضغط على «احجز الآن» فقط، وتعود بعده إلى الخطوة نفسها بالبيانات المحفوظة.',
        },
        {
          id: 'q-hold',
          question: 'ماذا يحدث إذا انتهى الحجز المؤقت قبل الدفع؟',
          answer:
            'يصبح الحجز منتهي الصلاحية وتُحرَّر التواريخ للعملاء الآخرين، ولا يُخصم أي مبلغ. يمكنك إعادة بدء الحجز بالتواريخ نفسها إن كانت لا تزال متاحة.',
        },
      ],
    },
    {
      id: 'payments',
      title: 'الدفع والفواتير',
      items: [
        {
          id: 'q-prepay',
          question: 'لماذا أدفع قبل موافقة الإدارة؟',
          answer:
            'الدفع يثبّت التواريخ ويمنع حجزها من عميل آخر أثناء المراجعة. متوسط مدة المراجعة أربع ساعات عمل، وعند الرفض يُستَرد المبلغ كاملًا إلى وسيلة الدفع نفسها دون أي خصم.',
        },
        {
          id: 'q-invoice',
          question: 'متى تصدر الفاتورة؟',
          answer:
            'تصدر الفاتورة الضريبية بعد استلام الدفع، وتظهر في تفاصيل الحجز مع خياري العرض والتحميل، وتبقى متاحة بعد انتهاء المدة.',
        },
      ],
    },
    {
      id: 'refunds',
      title: 'الإلغاء والاسترداد',
      items: [
        {
          id: 'q-refund',
          question: 'كم أستَرد إذا ألغيت الحجز؟',
          answer:
            'يُعرض المبلغ محسوبًا في شاشة الإلغاء قبل التأكيد. الإلغاء قبل بداية المدة بأكثر من سبعة أيام يُعيد قيمة الإيجار كاملة، وقبل ذلك بسبعة أيام أو أقل يُعيد 50% منها.',
        },
        {
          id: 'q-where',
          question: 'إلى أين يعود المبلغ؟',
          answer:
            'إلى وسيلة الدفع نفسها المستخدمة في الحجز، وتصل المدة إلى عشرة أيام عمل حسب البنك المُصدر.',
        },
      ],
    },
  ],
};

const TERMS: StaticPage = {
  slug: 'terms',
  title: 'الشروط والأحكام',
  version: {
    id: 'terms-1.2',
    documentType: LegalDocumentType.TermsOfUse,
    versionNo: '1.2',
    effectiveFrom: '2026-08-12',
    acceptedVersionNo: '1.2',
    acceptedAt: '2026-08-12',
  },
  intro:
    'تحكم هذه الشروط استخدام منصة حيزك من المستأجرين والمؤجرين. يعني إنشاء الحساب أو إتمام أي حجز الموافقة على الإصدار الساري منها، ويُسجّل النظام رقم الإصدار ووقت الموافقة.',
  sections: [
    {
      id: 'terms-1',
      number: '١',
      title: 'التعريفات',
      body: 'المنصة: منصة حيزك الإلكترونية وتطبيقاتها. المؤجر: مالك المساحة المعروضة. المستأجر: من يحجز المساحة لمدة محددة. الحجز: الاتفاق المسجّل في المنصة على استخدام مساحة في فترة محددة مقابل قيمة معلنة.',
    },
    {
      id: 'terms-2',
      number: '٢',
      title: 'نطاق الخدمة',
      body: 'تقدّم المنصة خدمة وسيط إلكتروني لعرض المساحات وإدارة الحجز والتحصيل وإصدار الفواتير وتسوية مستحقات المؤجرين. لا تتولّى المنصة نقل البضائع ولا تفتيشها ولا حفظها، ولا تقدّم أي خدمة تشغيلية داخل المساحة.',
      items: [
        'عرض المساحات بعد مراجعة الإدارة للإعلان.',
        'إدارة الحجز والتقويم ومنع التواريخ المتعارضة.',
        'التحصيل وإصدار الفاتورة الضريبية وتسوية المستحقات.',
      ],
    },
    {
      id: 'terms-3',
      number: '٣',
      title: 'الحساب والتحقق',
      body: 'يلزم لإنشاء الحساب تقديم بيانات صحيحة تتضمّن الاسم ورقم الهوية أو الإقامة والعنوان ورقم الجوال والبريد الإلكتروني. لا يُتمّ أي حجز قبل التحقق من رقم الجوال برمز من ست خانات. الحساب في المرحلة الأولى بدور واحد.',
    },
    {
      id: 'terms-4',
      number: '٤',
      title: 'الحجز والتواريخ',
      body: 'تُحجز التواريخ مؤقتًا خمس عشرة دقيقة عند الوصول إلى خطوة الدفع. لا يُعدّ الحجز نافذًا إلا بعد اعتماد إدارة المنصة له، وعندها يظهر العنوان الدقيق للمساحة ويُحجز النطاق في تقويم المساحة.',
    },
    {
      id: 'terms-5',
      number: '٥',
      title: 'الأسعار والعمولة والضريبة',
      body: 'يحدّد المؤجر السعر اليومي، وتستحق المنصة عمولتها وفق النسبة المعلنة، وتُطبَّق ضريبة القيمة المضافة وفق النظام. يُعرض التفصيل كاملًا قبل الدفع، وتُقيَّد جميع المبالغ بالريال السعودي.',
    },
    {
      id: 'terms-6',
      number: '٦',
      title: 'الممنوعات والمسؤولية',
      body: `يُمنع تخزين ${PROHIBITED_TEXT.join('، ')}. مخالفة القائمة تعرّض الحجز للإلغاء دون استرداد. مسؤولية حالة البضاعة والمساحة تقع على الطرفين وفق ما يتفقان عليه، وليست على المنصة.`,
    },
    {
      id: 'terms-7',
      number: '٧',
      title: 'الإلغاء والاسترداد',
      body: 'يخضع الإلغاء لسياسة الإلغاء والاسترداد المنشورة، ويُعرض المبلغ المسترد محسوبًا قبل التأكيد النهائي. عند رفض الإدارة للطلب يُستَرد المبلغ كاملًا دون خصم.',
    },
    {
      id: 'terms-8',
      number: '٨',
      title: 'تعديل الشروط',
      body: 'يجوز للمنصة تحديث هذه الشروط، ويُنشر لكل تحديث رقم إصدار وتاريخ سريان. يُسجّل النظام رقم الإصدار الذي وافق عليه المستخدم ووقت الموافقة، ويُطلب إقرار جديد عند سريان إصدار لاحق.',
    },
  ],
};

const PRIVACY: StaticPage = {
  slug: 'privacy',
  title: 'سياسة الخصوصية',
  version: {
    id: 'privacy-1.1',
    documentType: LegalDocumentType.PrivacyPolicy,
    versionNo: '1.1',
    effectiveFrom: '2026-07-01',
  },
  sections: [
    {
      id: 'privacy-1',
      title: 'البيانات المجموعة',
      body: 'تُجمع بيانات الحساب وهي الاسم ورقم الهوية أو الإقامة والعنوان ورقم الجوال والبريد الإلكتروني، وبيانات الحجز وتشمل التواريخ ووصف البضاعة، وبيانات الدفع التي تُعالج عبر مزوّد الدفع دون تخزين رقم البطاقة كاملًا في المنصة.',
    },
    {
      id: 'privacy-2',
      title: 'أوجه الاستخدام',
      body: 'تُستخدم البيانات لإتمام الحجز والتحقق من الهوية وإصدار الفاتورة ومراجعة الطلبات وتسوية المستحقات وإرسال إشعارات حالة الحجز. لا تُستخدم بيانات التواصل في رسائل تسويقية دون موافقة صريحة.',
    },
    {
      id: 'privacy-3',
      title: 'مشاركة البيانات',
      body: 'لا تُشارك بيانات المستأجر مع المؤجر قبل اعتماد الحجز. بعد الاعتماد يُتاح لكل طرف ما يلزم لتنفيذ الحجز فقط. تُشارك البيانات مع مزوّد الدفع والجهات النظامية عند الطلب الرسمي.',
    },
    {
      id: 'privacy-4',
      title: 'مدة الحفظ',
      body: 'تُحفظ بيانات الحجوزات والفواتير والسجلات المالية للمدة التي تفرضها الأنظمة المحاسبية والضريبية، وتُحفظ سجلات الموافقة على الشروط مع رقم الإصدار ووقت الموافقة.',
    },
    {
      id: 'privacy-5',
      title: 'حقوقك',
      body: 'يمكنك تعديل بياناتك من صفحة الملف الشخصي، وطلب حذف الحساب متى لم يكن عليك حجز نشط. تبقى الفواتير الصادرة محفوظة وفق المتطلبات النظامية بعد حذف الحساب.',
    },
  ],
};

const REFUND: StaticPage = {
  slug: 'refund-policy',
  title: 'سياسة الإلغاء والاسترداد',
  version: {
    id: 'refund-1.2',
    documentType: LegalDocumentType.RefundPolicy,
    versionNo: '1.2',
    effectiveFrom: '2026-08-12',
  },
  intro:
    'يُحسب المبلغ المسترد وفق موعد الإلغاء بالنسبة إلى تاريخ بداية المدة، ويُعرض المبلغ محسوبًا في شاشة الإلغاء قبل التأكيد النهائي.',
  sections: [],
  refundTiers: [
    {
      when: 'رفض الطلب من إدارة المنصة',
      refundShare: '100%',
      commissionNote: 'تُعاد كاملة',
      tone: 'success',
    },
    {
      when: 'الإلغاء قبل بداية المدة بأكثر من سبعة أيام',
      refundShare: '100%',
      commissionNote: 'غير مستردة',
      tone: 'success',
    },
    {
      when: 'الإلغاء قبل بداية المدة بسبعة أيام أو أقل',
      refundShare: '50%',
      commissionNote: 'غير مستردة',
      tone: 'warning',
    },
    {
      when: 'الإلغاء بعد بداية المدة',
      refundShare: '0%',
      commissionNote: 'غير مستردة',
      tone: 'danger',
    },
  ],
  refundNotes: [
    'تُحسب النسب على قيمة الإيجار، وتُعاد ضريبة القيمة المضافة على الجزء المسترد.',
    'يُعرض المبلغ المسترد محسوبًا في شاشة إلغاء الحجز قبل التأكيد النهائي.',
    'انتهاء الحجز المؤقت دون دفع لا يترتّب عليه أي مبلغ، إذ لا يكون قد جرى خصم.',
    'إلغاء المؤجر للحجز بعد الاعتماد يوجب استرداد المبلغ كاملًا للمستأجر.',
  ],
};

const CONTACT: StaticPage = {
  slug: 'contact',
  title: 'التواصل معنا',
  subtitle: 'يرد فريق الدعم على الاستفسارات خلال يوم عمل واحد',
  sections: [],
  contactChannels: [
    {
      label: 'الهاتف',
      value: '+966 12 651 4420',
      hint: 'من الأحد إلى الخميس، 9 صباحًا — 5 مساءً',
      isLatin: true,
    },
    {
      label: 'البريد الإلكتروني',
      value: 'care@hayzak.sa',
      hint: 'الرد خلال يوم عمل واحد',
      isLatin: true,
    },
    {
      label: 'استفسارات الفواتير',
      value: 'billing@hayzak.sa',
      hint: 'للفواتير والاسترداد والمستحقات',
      isLatin: true,
    },
    {
      label: 'العنوان',
      value: 'جدة — حي الروضة، شارع صاري، مبنى 220',
      hint: 'الرمز البريدي 23434',
      isLatin: false,
    },
  ],
};

export const MOCK_STATIC_PAGES: Record<StaticPageSlug, StaticPage> = {
  about: ABOUT,
  'how-it-works': HOW_IT_WORKS,
  faq: FAQ,
  terms: TERMS,
  privacy: PRIVACY,
  'refund-policy': REFUND,
  contact: CONTACT,
};

/** Route paths this fixture set answers, for the interceptor's own reference. */
export const RENTER_MOCK_ROUTES = {
  search: API_ENDPOINTS.marketplace.search,
  bookingsMine: API_ENDPOINTS.bookings.mine,
} as const;
