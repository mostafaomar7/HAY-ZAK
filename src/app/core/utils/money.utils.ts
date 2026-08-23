import {
  FINANCIAL_DEFAULTS,
  type CommissionBearer,
  type VatBase,
} from '../constants/app.constants';

export interface PricingConfig {
  commissionRate: number;
  vatRate: number;
  commissionBearer: CommissionBearer;
  vatBase: VatBase;
}

/** The breakdown FR-BKG-02 requires on screen before payment. */
export interface PriceBreakdown {
  dailyPrice: number;
  days: number;
  /** days × dailyPrice — the lessor's gross. */
  subtotal: number;
  commissionAmount: number;
  vatAmount: number;
  /** What the renter pays. */
  totalAmount: number;
  /** What the lessor receives after settlement (FR-PAY-04). */
  netToLessor: number;
}

/** SAR is a 2-decimal currency; round every intermediate to avoid drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function daysBetweenDates(start: Date | string, end: Date | string): number {
  const from = new Date(start).setHours(0, 0, 0, 0);
  const to = new Date(end).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/**
 * Single source of truth for booking money. Mirror this exactly on the server —
 * the client figure is for display, the server figure is what gets charged.
 *
 * OPEN (SRS §15 item 3 and §10): commissionBearer and vatBase are unconfirmed.
 * Both are parameters so settling them costs a config change, not a rewrite.
 */
export function calculatePrice(
  dailyPrice: number,
  days: number,
  config: Partial<PricingConfig> = {},
): PriceBreakdown {
  const { commissionRate, vatRate, commissionBearer, vatBase } = {
    ...FINANCIAL_DEFAULTS,
    ...config,
  };

  const subtotal = round2(dailyPrice * days);
  const commissionAmount = round2(subtotal * commissionRate);

  const vatAmount = round2((vatBase === 'commission' ? commissionAmount : subtotal) * vatRate);

  let totalAmount: number;
  let netToLessor: number;

  switch (commissionBearer) {
    case 'renter':
      // Commission sits on top of the lessor's price.
      totalAmount = round2(subtotal + commissionAmount + vatAmount);
      netToLessor = subtotal;
      break;
    case 'shared': {
      const half = round2(commissionAmount / 2);
      totalAmount = round2(subtotal + half + vatAmount);
      netToLessor = round2(subtotal - (commissionAmount - half));
      break;
    }
    case 'lessor':
    default:
      // Renter pays the listed price; commission comes out of the lessor's share.
      totalAmount = subtotal;
      netToLessor = round2(subtotal - commissionAmount - vatAmount);
      break;
  }

  return { dailyPrice, days, subtotal, commissionAmount, vatAmount, totalAmount, netToLessor };
}

/** FR-UNT-05 — indicative monthly figure shown for guidance only. */
export function indicativeMonthlyPrice(dailyPrice: number, multiplier = 30): number {
  return round2(dailyPrice * multiplier);
}

export function formatSar(amount: number, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** NFR-SEC-02 — an IBAN may only ever be shown as its last four characters. */
export function maskIban(iban: string): string {
  const tail = iban.slice(-4);
  return `SA•••• •••• ${tail}`;
}

export function maskNationalId(id: string): string {
  return `••••••${id.slice(-4)}`;
}
