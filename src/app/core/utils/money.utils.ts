import {
  FINANCIAL_DEFAULTS,
  type CommissionBearer,
  type VatBase,
} from '../constants/app.constants';

/**
 * Money is integer halalas. Never floats.
 *
 * 862.50 SAR is `86250`. Every field that carries an amount is named
 * `…Halalas`, every calculation below runs on those integers, and the only
 * division by 100 in the application happens when a figure is rendered.
 *
 * This is not fastidiousness: `0.1 + 0.2 !== 0.3`, the booking total is
 * assembled from a subtotal, a commission and a VAT line, and the result is
 * reconciled against a payment gateway to the halala. A rounding difference of
 * one halala on a settled booking is a support ticket and a manual correction.
 *
 * Rates are basis points, for the same reason: 15% is `1500`, and a rate held
 * as `0.15` reintroduces the float the amounts were kept clear of.
 */

/** One hundred halalas to the riyal. */
const HALALAS_PER_SAR = 100;

/** Ten thousand basis points to the whole. */
const BPS_PER_UNIT = 10_000;

export interface PricingConfig {
  commissionRateBps: number;
  vatRateBps: number;
  commissionBearer: CommissionBearer;
  vatBase: VatBase;
}

/** The breakdown FR-BKG-02 requires on screen before payment. */
export interface PriceBreakdown {
  dailyPriceHalalas: number;
  days: number;
  /** days × dailyPriceHalalas — the lessor's gross. */
  subtotalHalalas: number;
  commissionHalalas: number;
  vatHalalas: number;
  /** What the renter pays. */
  totalHalalas: number;
  /** What the lessor receives after settlement (FR-PAY-04). */
  netToLessorHalalas: number;
}

/**
 * Applies a basis-point rate to an amount, to the nearest halala.
 *
 * Rounds half away from zero, which is what a reader checking the arithmetic on
 * an invoice expects, and what the server is asked to mirror. Every percentage
 * in the system goes through this one function so client and server cannot
 * round differently in two places.
 */
export function applyBps(amountHalalas: number, rateBps: number): number {
  const product = amountHalalas * rateBps;
  return Math.sign(product) * Math.round(Math.abs(product) / BPS_PER_UNIT);
}

/** For display only — a rate of 1500 reads as 15. */
export function bpsToPercent(rateBps: number): number {
  return rateBps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Riyals to halalas, for a figure a human typed into a form. */
export function sarToHalalas(sar: number): number {
  return Math.round(sar * HALALAS_PER_SAR);
}

/** Halalas to riyals. The only place this division belongs is rendering. */
export function halalasToSar(halalas: number): number {
  return halalas / HALALAS_PER_SAR;
}

/**
 * Days between two plain `YYYY-MM-DD` dates, on a half-open range.
 *
 * 10 → 15 is five nights: the 10th to the 14th, and the unit is free again on
 * the 15th. See `date.utils.ts` — the dates are parsed field by field, never
 * through `new Date(string)`, which reads them as UTC midnight and shifts the
 * day in any negative offset.
 */
export function daysBetweenDates(start: string, end: string): number {
  const from = Date.UTC(...plainParts(start));
  const to = Date.UTC(...plainParts(end));
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function plainParts(date: string): [number, number, number] {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return [year, (month ?? 1) - 1, day ?? 1];
}

/**
 * Single source of truth for booking money. Mirror this exactly on the server —
 * the client figure is for display, the server figure is what gets charged.
 *
 * OPEN (SRS §15 item 3 and §10): commissionBearer and vatBase are unconfirmed.
 * Both are parameters so settling them costs a config change, not a rewrite.
 */
export function calculatePrice(
  dailyPriceHalalas: number,
  days: number,
  config: Partial<PricingConfig> = {},
): PriceBreakdown {
  const { commissionRateBps, vatRateBps, commissionBearer, vatBase } = {
    ...FINANCIAL_DEFAULTS,
    ...config,
  };

  const subtotalHalalas = dailyPriceHalalas * days;
  const commissionHalalas = applyBps(subtotalHalalas, commissionRateBps);

  const vatHalalas = applyBps(
    vatBase === 'commission' ? commissionHalalas : subtotalHalalas,
    vatRateBps,
  );

  let totalHalalas: number;
  let netToLessorHalalas: number;

  switch (commissionBearer) {
    case 'renter':
      // Commission sits on top of the lessor's price.
      totalHalalas = subtotalHalalas + commissionHalalas + vatHalalas;
      netToLessorHalalas = subtotalHalalas;
      break;
    case 'shared': {
      // The odd halala goes to the renter's half, so the two halves always add
      // back to the whole commission rather than to one halala more or less.
      const renterHalf = Math.ceil(commissionHalalas / 2);
      totalHalalas = subtotalHalalas + renterHalf + vatHalalas;
      netToLessorHalalas = subtotalHalalas - (commissionHalalas - renterHalf);
      break;
    }
    case 'lessor':
    default:
      // Renter pays the listed price; commission comes out of the lessor's share.
      totalHalalas = subtotalHalalas;
      netToLessorHalalas = subtotalHalalas - commissionHalalas - vatHalalas;
      break;
  }

  return {
    dailyPriceHalalas,
    days,
    subtotalHalalas,
    commissionHalalas,
    vatHalalas,
    totalHalalas,
    netToLessorHalalas,
  };
}

/** FR-UNT-05 — indicative monthly figure shown for guidance only. */
export function indicativeMonthlyPrice(dailyPriceHalalas: number, multiplier = 30): number {
  return dailyPriceHalalas * multiplier;
}

/** Renders halalas as SAR. The one division by 100 in the application. */
export function formatSar(halalas: number, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(halalasToSar(halalas));
}

/** NFR-SEC-02 — an IBAN may only ever be shown as its last four characters. */
export function maskIban(iban: string): string {
  const tail = iban.slice(-4);
  return `SA•••• •••• ${tail}`;
}

export function maskNationalId(id: string): string {
  return `••••••${id.slice(-4)}`;
}
