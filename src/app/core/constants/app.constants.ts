/**
 * Business rules taken verbatim from the SRS. Values the admin panel can change
 * at runtime (FR-ADM-06) are defaults only — always prefer the value the
 * settings endpoint returns.
 */
export const APP = {
  currency: 'SAR',
  locale: 'ar-SA',
  timezone: 'Asia/Riyadh', // SRS §2.4 — UTC+3

  /** FR-MKT-11 — 12 results per batch. */
  pageSize: 12,
  pageSizeOptions: [12, 24, 48],
  debounceMs: 400,

  /** FR-BKG-05 — hold on the date range while payment completes. */
  bookingHoldMinutes: 15,
  /** SRS §3 item 4 — suggested administration decision SLA. */
  approvalSlaHours: 4,
  /** FR-PAY-07 — suggested payout cycle after the booking actually starts. */
  payoutCycleHours: 24,

  /** FR-UNT-02 / FR-UNT-03. */
  unitImages: {
    min: 2,
    max: 3,
    maxSizeMb: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  /** FR-UNT-11 — radius shown instead of the exact pin before approval. */
  approximateLocationRadiusMetres: 300,

  /** FR-UNT-05 — indicative monthly price is the daily rate × 30. */
  monthlyPriceMultiplier: 30,

  /** FR-AUTH-04 / FR-AUTH-11 / NFR-SEC-05. */
  otp: { validityMinutes: 5, maxAttempts: 3 },
  login: { maxAttempts: 5, lockMinutes: 15 },

  dateFormat: 'dd/MM/yyyy',
  /** Long form used on detail screens, per the design. */
  dateDisplayFormat: 'd MMMM y',
  dateTimeFormat: 'dd/MM/yyyy hh:mm a',
} as const;

/**
 * Financial defaults. All three are OPEN client decisions (SRS §15 items 3–5) —
 * they are wired as configuration precisely so the answer does not require a
 * code change.
 */
export const FINANCIAL_DEFAULTS = {
  /** SRS §10 — 15% VAT on the service. */
  vatRate: 0.15,
  /** OPEN §15 item 3 — rate not yet set by the client. */
  commissionRate: 0.1,
  /** OPEN §15 item 3 — who bears the commission. */
  commissionBearer: 'lessor' as CommissionBearer,
  /** OPEN §10 — whether VAT applies to the commission only or the whole booking. */
  vatBase: 'commission' as VatBase,
} as const;

/** Deducted from the lessor's net, added on top for the renter, or split. */
export type CommissionBearer = 'lessor' | 'renter' | 'shared';

/** SRS §10 says "VAT on the service"; the ERD has vat_on_commission. */
export type VatBase = 'commission' | 'total';

/** Saudi-specific patterns — SRS §4.1, FR-LSR-02. */
export const REGEX = {
  email: /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/,
  /** 05XXXXXXXX, +9665XXXXXXXX or 009665XXXXXXXX. */
  saudiMobile: /^(?:\+966|00966|0)?5[0-9]{8}$/,
  /** National ID starts with 1, Iqama with 2; 10 digits either way. */
  saudiNationalId: /^[12][0-9]{9}$/,
  /** FR-LSR-02 — "SA" followed by 22 characters. */
  saudiIban: /^SA[0-9]{22}$/,
  /** 8+ chars, one upper, one lower, one digit. */
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  arabicOnly: /^[\u0600-\u06FF\s]+$/,
  url: /^https?:\/\/[^\s]+$/,
} as const;
