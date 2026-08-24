import { Injectable, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { BookingStatus, TERMINAL_BOOKING_STATUSES } from '@core/enums/booking-status.enum';
import type { PaginatedResponse } from '@core/models/api-response.model';
import type { Booking } from '@core/models/booking.model';
import { ApiService } from '@core/services/api.service';

/** The two tabs on "حجوزاتي" (RNT-01). */
export type BookingTab = 'current' | 'previous';

/**
 * The renter's own bookings.
 *
 * The split between the two tabs is derived from the status, not asked of the
 * server: SRS §6 already defines which four states are terminal, and duplicating
 * that judgement in a query parameter is how the two ends drift apart.
 */
@Injectable()
export class RenterBookingsService {
  private readonly api = inject(ApiService);

  private readonly items = signal<Booking[]>([]);
  private readonly loading = signal(false);

  readonly bookings = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  readonly current = computed(() =>
    this.items().filter((b) => !TERMINAL_BOOKING_STATUSES.includes(b.status)),
  );

  readonly previous = computed(() =>
    this.items().filter((b) => TERMINAL_BOOKING_STATUSES.includes(b.status)),
  );

  load(): Observable<PaginatedResponse<Booking>> {
    this.loading.set(true);
    return this.api.list<Booking>(API_ENDPOINTS.bookings.mine).pipe(
      tap({
        next: (page) => {
          this.items.set(page.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }
}

/**
 * The row action the design puts next to "تفاصيل الحجز", which changes with the
 * state. Returns null where the design shows no secondary action at all.
 */
export function bookingPrimaryAction(booking: Booking): {
  labelKey: 'bookings.viewInvoice' | 'bookings.completePayment' | 'bookings.resume';
  link: unknown[];
} | null {
  switch (booking.status) {
    case BookingStatus.Draft:
      return { labelKey: 'bookings.resume', link: ['/booking', 'new', booking.unitId] };
    case BookingStatus.AwaitingPayment:
      return { labelKey: 'bookings.completePayment', link: ['/booking', booking.id, 'pay'] };
    case BookingStatus.Confirmed:
    case BookingStatus.Active:
    case BookingStatus.Completed:
      // Payment is what confirms a booking, so an invoice exists from
      // CONFIRMED onward — there is no longer a pending state to wait through.
      return { labelKey: 'bookings.viewInvoice', link: ['/my-bookings', booking.id, 'invoice'] };
    default:
      return null;
  }
}

/**
 * Whether "لديّ مشكلة" belongs on this booking.
 *
 * Everything that is not a draft: a renter with a live, finished or cancelled
 * booking may still need to raise something about it, and a draft holds
 * nothing to complain about. It replaced `canCancelBooking`, which offered a
 * button for an action nobody on this platform can take.
 */
export function canRaiseComplaint(booking: Booking): boolean {
  return booking.status !== BookingStatus.Draft;
}

/** FR-UNT-11 — the exact address is released by approval and nothing earlier. */
export function isAddressReleased(booking: Booking): boolean {
  return [BookingStatus.Confirmed, BookingStatus.Active, BookingStatus.Completed].includes(
    booking.status,
  );
}
