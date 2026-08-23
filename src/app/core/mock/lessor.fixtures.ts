import { BookingStatus } from '../enums/booking-status.enum';
import { NotificationChannel, NotificationType } from '../enums/operations.enum';
import { PayoutStatus } from '../enums/payment.enum';
import { AvailabilityBlockReason, UnitStatus } from '../enums/unit-status.enum';
import { AccountStatus, UserRole, VerificationStatus } from '../enums/user-role.enum';
import type { EarningsResponse } from '../models/earnings.model';
import type { Booking } from '../models/booking.model';
import type { AppNotification } from '../models/operations.model';
import type { District, ReferenceItem, Unit, UnitAvailabilityBlock } from '../models/unit.model';
import type { LessorBankAccount, User } from '../models/user.model';

/**
 * Fixture data copied from the design export, so the screens render with the
 * same content the designer reviewed — including every status variant.
 *
 * Development only. See mock-api.interceptor.ts.
 */

export const MOCK_LESSOR: User = {
  id: 'u-1',
  fullName: 'سعود العنزي',
  mobile: '0512345678',
  email: 'saud@example.com',
  roles: [UserRole.Lessor],
  status: AccountStatus.Active,
  mobileVerifiedAt: '2026-08-01T09:00:00Z',
  createdAt: '2026-07-20T09:00:00Z',
};

const category = (nameAr: string) => ({ id: nameAr, nameAr, nameEn: nameAr });

function unit(
  id: string,
  title: string,
  categoryName: string,
  areaSqm: number,
  dailyPrice: number,
  status: UnitStatus,
  rejectionReason?: string,
): Unit {
  return {
    id,
    lessorId: MOCK_LESSOR.id,
    categoryId: categoryName,
    category: category(categoryName),
    cityId: 'riyadh',
    districtId: 'd-1',
    city: category('الرياض'),
    title,
    description: 'مساحة تخزين نظيفة وآمنة، يسهل الوصول إليها.',
    areaSqm,
    dailyPrice,
    location: { latitude: 24.7136, longitude: 46.6753 },
    isApproximateLocation: true,
    addressLine: 'الرياض — حي النرجس، شارع أنس بن مالك، مبنى 118',
    postalCode: '13323',
    visitSchedule: [
      { days: [0, 1, 2, 3, 4], from: '09:00', to: '21:00' },
      { days: [6], from: '10:00', to: '20:00' },
    ],
    images: [],
    status,
    rejectionReason,
    createdAt: '2026-08-05T09:00:00Z',
  };
}

/** All seven unit states, matching the design's "الحالات السبع" board. */
export const MOCK_UNITS: Unit[] = [
  unit('un-1', 'مستودع مكيّف — النرجس', 'مستودع', 35, 75, UnitStatus.Published),
  unit('un-2', 'غرفة تخزين نظيفة — الياسمين', 'غرفة', 18, 45, UnitStatus.FullyBooked),
  unit(
    'un-3',
    'قراج مكشوف — القيروان',
    'قراج',
    24,
    50,
    UnitStatus.Rejected,
    'لا تُظهر الصور المساحة كاملة، وإحداها ليست للموقع نفسه. يجب إضافة صورتين واضحتين في ضوء النهار تُظهران المساحة بالكامل.',
  ),
  unit('un-4', 'مستودع أرضي — الصحافة', 'مستودع', 50, 95, UnitStatus.PendingReview),
  unit('un-5', 'غرفة تخزين — النخيل', 'غرفة', 12, 40, UnitStatus.Draft),
  unit('un-6', 'قراج مغلق — الملقا', 'قراج', 28, 60, UnitStatus.Suspended),
  unit('un-7', 'مستودع صغير — العليا', 'مستودع', 15, 55, UnitStatus.Archived),
];

function booking(
  id: string,
  referenceNo: string,
  unitTitle: string,
  startDate: string,
  endDate: string,
  daysCount: number,
  dailyPrice: number,
  status: BookingStatus,
  goodsDescription: string,
  renterName?: string,
): Booking {
  const subtotal = dailyPrice * daysCount;
  return {
    id,
    referenceNo,
    unitId: 'un-1',
    unit: { id: 'un-1', title: unitTitle, images: [], visitSchedule: [] },
    renterId: 'r-1',
    startDate,
    endDate,
    daysCount,
    dailyPriceSnapshot: dailyPrice,
    subtotal,
    commissionAmount: subtotal * 0.1,
    vatAmount: subtotal * 0.1 * 0.15,
    totalAmount: subtotal,
    goodsDescription,
    prohibitedAck: true,
    status,
    counterpartyContact: renterName ? { fullName: renterName, mobile: '0555555555' } : undefined,
    createdAt: '2026-08-10T09:00:00Z',
  };
}

/** All nine booking states, matching the design's "كل الحالات التسع" board. */
export const MOCK_BOOKINGS: Booking[] = [
  booking(
    'bk-1',
    'HZ-2026-01078',
    'قراج مغلق — الملقا',
    '2026-08-12',
    '2026-09-11',
    30,
    60,
    BookingStatus.PaidPendingApproval,
    'كراتين أثاث منزلي وأغراض شخصية.',
  ),
  booking(
    'bk-2',
    'HZ-2026-01079',
    'مستودع كبير — حطين',
    '2026-08-01',
    '2026-08-20',
    20,
    150,
    BookingStatus.Active,
    'معدات رياضية.',
    'سارة العتيبي',
  ),
  booking(
    'bk-3',
    'HZ-2026-01080',
    'مستودع مكيّف — النرجس',
    '2026-08-20',
    '2026-08-27',
    7,
    75,
    BookingStatus.Approved,
    'أثاث غرفة نوم.',
    'سعود العنزي',
  ),
  booking(
    'bk-4',
    'HZ-2026-01081',
    'مستودع مكيّف — النرجس',
    '2026-08-18',
    '2026-08-25',
    7,
    75,
    BookingStatus.Draft,
    '',
  ),
  booking(
    'bk-5',
    'HZ-2026-01082',
    'مستودع مكيّف — النرجس',
    '2026-08-05',
    '2026-08-12',
    7,
    75,
    BookingStatus.Completed,
    'صناديق كتب.',
    'محمد الحربي',
  ),
  booking(
    'bk-6',
    'HZ-2026-01083',
    'غرفة تخزين نظيفة — الياسمين',
    '2026-08-14',
    '2026-08-21',
    7,
    45,
    BookingStatus.RejectedRefunded,
    'مواد دهان وسوائل.',
  ),
  booking(
    'bk-7',
    'HZ-2026-01084',
    'قراج مكشوف — القيروان',
    '2026-08-16',
    '2026-08-23',
    7,
    50,
    BookingStatus.Cancelled,
    'أدوات كهربائية.',
  ),
  booking(
    'bk-8',
    'HZ-2026-01085',
    'مستودع أرضي — الصحافة',
    '2026-08-17',
    '2026-08-24',
    7,
    95,
    BookingStatus.AwaitingPayment,
    'كراتين ملابس.',
  ),
  booking(
    'bk-9',
    'HZ-2026-01086',
    'مستودع أرضي — الصحافة',
    '2026-08-15',
    '2026-08-22',
    7,
    95,
    BookingStatus.Expired,
    'أثاث مكتبي.',
  ),
];

// ── Reference data (FR-ADM-05) ───────────────────────────────────────────
export const MOCK_CATEGORIES: ReferenceItem[] = [
  { id: 'warehouse', nameAr: 'مستودع', nameEn: 'Warehouse', sortOrder: 1 },
  { id: 'room', nameAr: 'غرفة', nameEn: 'Room', sortOrder: 2 },
  { id: 'open_space', nameAr: 'مساحة مفتوحة', nameEn: 'Open space', sortOrder: 3 },
  { id: 'garage', nameAr: 'قراج', nameEn: 'Garage', sortOrder: 4 },
];

export const MOCK_CITIES: ReferenceItem[] = [
  { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' },
  { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah' },
  { id: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam' },
];

export const MOCK_DISTRICTS: District[] = [
  { id: 'd-1', cityId: 'riyadh', nameAr: 'النرجس', nameEn: 'Al Narjis' },
  { id: 'd-2', cityId: 'riyadh', nameAr: 'الياسمين', nameEn: 'Al Yasmin' },
  { id: 'd-3', cityId: 'riyadh', nameAr: 'الملقا', nameEn: 'Al Malqa' },
  { id: 'd-4', cityId: 'riyadh', nameAr: 'الصحافة', nameEn: 'Al Sahafa' },
];

/** FR-UNT-08 — date ranges, not a binary flag. */
export const MOCK_AVAILABILITY: UnitAvailabilityBlock[] = [
  {
    id: 'av-1',
    startDate: '2026-08-20',
    endDate: '2026-08-27',
    reason: AvailabilityBlockReason.Booking,
    bookingId: 'bk-3',
  },
  {
    id: 'av-2',
    startDate: '2026-09-05',
    endDate: '2026-09-08',
    reason: AvailabilityBlockReason.ManualBlock,
  },
];

/**
 * LSR-07 rows, with the design's own figures: 5% commission and no VAT line on
 * the lessor's side. Includes a frozen payout so the hold explanation renders.
 */
export const MOCK_EARNINGS: EarningsResponse = {
  summary: { totalEarnings: 2707.5, transferred: 498.75, pending: 498.75, onHold: 1710 },
  rows: [
    {
      bookingId: 'bk-5',
      bookingReferenceNo: 'HZ-2026-01042',
      unitTitle: 'مستودع مكيّف — النرجس',
      startDate: '2026-08-05',
      endDate: '2026-08-12',
      grossAmount: 525,
      commissionAmount: 26.25,
      netAmount: 498.75,
      payoutStatus: PayoutStatus.Paid,
      bankReference: 'TRF-88214',
      transferredAt: '2026-08-13',
    },
    {
      bookingId: 'bk-3',
      bookingReferenceNo: 'HZ-2026-01078',
      unitTitle: 'مستودع مكيّف — النرجس',
      startDate: '2026-08-20',
      endDate: '2026-08-27',
      grossAmount: 525,
      commissionAmount: 26.25,
      netAmount: 498.75,
      payoutStatus: PayoutStatus.Processing,
    },
    {
      bookingId: 'bk-1',
      bookingReferenceNo: 'HZ-2026-04871',
      unitTitle: 'قراج مغلق — الملقا',
      startDate: '2026-08-12',
      endDate: '2026-09-11',
      grossAmount: 1800,
      commissionAmount: 90,
      netAmount: 1710,
      payoutStatus: PayoutStatus.OnHold,
      holdReason:
        'لا يطابق رقم الآيبان المسجّل اسمك في المنصة، وتعذّر إجراء التحويل. يُرجى تصحيح البيانات البنكية ليتم التحويل تلقائيًا.',
    },
  ],
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n-1',
    type: NotificationType.BookingPaid,
    title: 'ورد طلب حجز جديد على «مستودع مكيّف — النرجس»',
    body: '',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/lessor/requests/bk-1',
    createdAt: hoursAgo(2),
  },
  {
    id: 'n-2',
    type: NotificationType.BookingApproved,
    title: 'تمت الموافقة على الحجز HZ-2026-01078',
    body: 'تظهر بيانات المستأجر الآن في تفاصيل الطلب.',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/lessor/requests/bk-3',
    createdAt: hoursAgo(5),
  },
  {
    id: 'n-3',
    type: NotificationType.PayoutExecuted,
    title: 'تم تحويل مستحقاتك 498.75 ر.س',
    body: 'المرجع البنكي TRF-88214.',
    channel: NotificationChannel.InApp,
    isRead: false,
    targetUrl: '/lessor/earnings',
    createdAt: hoursAgo(9),
  },
  {
    id: 'n-4',
    type: NotificationType.ListingApproved,
    title: 'تمت الموافقة على إعلانك ونُشر: «قراج مغلق — الملقا»',
    body: '',
    channel: NotificationChannel.InApp,
    isRead: true,
    targetUrl: '/lessor/units/un-6',
    createdAt: hoursAgo(30),
  },
  {
    id: 'n-5',
    type: NotificationType.ListingRejected,
    title: 'تم رفض إعلانك: «قراج مكشوف — القيروان»',
    body: 'الصور لا تُظهر المساحة كاملة.',
    channel: NotificationChannel.InApp,
    isRead: true,
    targetUrl: '/lessor/units/un-3',
    createdAt: hoursAgo(34),
  },
  {
    id: 'n-6',
    type: NotificationType.BookingCancelled,
    title: 'أُعيد المبلغ إلى المستأجر — HZ-2026-01031',
    body: '',
    channel: NotificationChannel.InApp,
    isRead: true,
    createdAt: hoursAgo(24 * 15),
  },
];

/** FR-LSR-02 — the API only ever returns a masked IBAN (NFR-SEC-02). */
export const MOCK_BANK_ACCOUNTS: LessorBankAccount[] = [
  {
    id: 'ba-1',
    accountHolderName: 'سعود بن ناصر العنزي',
    bankName: 'مصرف الراجحي',
    ibanMasked: 'SA•••• •••• 7519',
    verificationStatus: VerificationStatus.Verified,
    isDefault: true,
  },
];

/** FR-ADM-05 — the Saudi bank list from the design's dropdown. */
export const MOCK_BANKS: ReferenceItem[] = [
  'مصرف الراجحي',
  'البنك الأهلي السعودي',
  'بنك الرياض',
  'بنك البلاد',
  'مصرف الإنماء',
  'البنك السعودي الأول',
  'البنك السعودي الفرنسي',
  'البنك العربي الوطني',
  'بنك الجزيرة',
  'بنك الخليج الدولي',
].map((name, i) => ({ id: `bank-${i + 1}`, nameAr: name, nameEn: name }));
