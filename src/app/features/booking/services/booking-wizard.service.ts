import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants/storage-keys';
import type { Unit } from '@core/models/unit.model';
import { StorageService } from '@core/services/storage.service';
import { daysBetween } from '@core/utils/date.utils';

/** The four steps of RNT-03 → RNT-05, in order. */
export type BookingStep = 'dates' | 'goods' | 'identity' | 'pay';

export const BOOKING_STEPS: readonly BookingStep[] = ['dates', 'goods', 'identity', 'pay'] as const;

/**
 * What survives between steps and across a mid-journey sign-up.
 *
 * `unitId` and the dates are enough to rebuild everything else from the API, so
 * the stored blob stays small and holds nothing sensitive — the goods
 * description is the only free text and it is the renter's own words.
 */
export interface BookingDraft {
  unitId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  goodsDescription: string;
  prohibitedAck: boolean;
  /** Set once the server has created the Draft booking. */
  bookingId?: string;
  /** FR-BKG-05 — when the 15-minute hold lapses; absent before the identity step. */
  holdExpiresAt?: string;
}

/**
 * Carries the booking across the four wizard screens.
 *
 * Provided at the wizard route, not in root: leaving the flow should forget it,
 * and two tabs booking two different units must not share one draft. The copy in
 * session storage exists for exactly one case — the design's "التسجيل داخل
 * المسار" exception, where the renter is sent to register and must come back to
 * the same step with the same dates and description.
 */
@Injectable()
export class BookingWizardService {
  private readonly storage = inject(StorageService);

  private readonly state = signal<BookingDraft | null>(
    this.storage.get<BookingDraft>(STORAGE_KEYS.bookingDraft, true),
  );
  private readonly unitRecord = signal<Unit | null>(null);

  readonly draft = this.state.asReadonly();
  readonly unit = this.unitRecord.asReadonly();

  /** Guards the later steps: you cannot describe goods for dates you never picked. */
  readonly hasDates = computed(() => {
    const draft = this.state();
    return !!draft?.startDate && !!draft?.endDate && draft.daysCount > 0;
  });

  readonly hasGoods = computed(() => {
    const draft = this.state();
    return !!draft?.goodsDescription && draft.prohibitedAck === true;
  });

  /** Seconds left on the hold, or null when no hold is running. */
  readonly holdSecondsRemaining = computed(() => {
    const expiry = this.state()?.holdExpiresAt;
    if (!expiry) return null;
    const seconds = Math.floor((new Date(expiry).getTime() - Date.now()) / 1000);
    return Math.max(0, seconds);
  });

  setUnit(unit: Unit): void {
    this.unitRecord.set(unit);
  }

  /** Step 1 — starts or restarts the draft for a unit. */
  setDates(unitId: string, startDate: string, endDate: string): void {
    this.patch({
      unitId,
      startDate,
      endDate,
      daysCount: daysBetween(startDate, endDate),
      goodsDescription:
        this.state()?.unitId === unitId ? (this.state()?.goodsDescription ?? '') : '',
      prohibitedAck:
        this.state()?.unitId === unitId ? (this.state()?.prohibitedAck ?? false) : false,
    });
  }

  /** Step 2 — both halves move together; an acknowledgement without a
   *  description, or the reverse, is never a valid state to persist. */
  setGoods(goodsDescription: string, prohibitedAck: boolean): void {
    this.patch({ goodsDescription, prohibitedAck });
  }

  setBookingId(bookingId: string): void {
    this.patch({ bookingId });
  }

  /** Step 3 onward — the hold the payment screen counts down. */
  setHold(holdExpiresAt: string | undefined): void {
    this.patch({ holdExpiresAt });
  }

  clear(): void {
    this.state.set(null);
    this.unitRecord.set(null);
    this.storage.remove(STORAGE_KEYS.bookingDraft, true);
  }

  private patch(changes: Partial<BookingDraft>): void {
    const current = this.state();
    const next = {
      unitId: '',
      startDate: '',
      endDate: '',
      daysCount: 0,
      goodsDescription: '',
      prohibitedAck: false,
      ...current,
      ...changes,
    } satisfies BookingDraft;

    this.state.set(next);
    this.storage.set(STORAGE_KEYS.bookingDraft, next, true);
  }
}
