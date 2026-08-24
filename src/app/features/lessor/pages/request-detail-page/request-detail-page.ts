import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { APP } from '@core/constants/app.constants';
import { BOOKING_STATUS_DISPLAY } from '@core/constants/status-display';
import { BookingStatus } from '@core/enums/booking-status.enum';
import type { Booking } from '@core/models/booking.model';
import { ApiService } from '@core/services/api.service';
import { saveBlob } from '@core/utils/file.utils';
import {
  LessorRequestsService,
  renterContactVisible,
} from '../../services/lessor-requests.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiLockedPanel } from '@shared/components/ui-locked-panel/ui-locked-panel';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import type { StepperStep } from '@shared/components/ui-stepper/ui-stepper';
import { UiStepper } from '@shared/components/ui-stepper/ui-stepper';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';

/**
 * LSR-06 — "تفاصيل الطلب (عرض فقط)".
 *
 * Read-only for the same reason as the requests list: FR-LSR-06 gives the lessor
 * no authority over a booking. The renter's identity sits behind UiLockedPanel
 * until approval, and the rental contract is only offered once one exists.
 */
@Component({
  selector: 'app-request-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorRequestsService],
  imports: [
    DatePipe,
    RouterLink,
    UiBadge,
    UiButton,
    UiEmptyState,
    UiLockedPanel,
    UiMoney,
    UiNotice,
    UiStepper,
    UiThumbnail,
  ],
  templateUrl: './request-detail-page.html',
  styleUrl: './request-detail-page.scss',
})
export class RequestDetailPage {
  /** Bound from the route param by withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly service = inject(LessorRequestsService);
  private readonly api = inject(ApiService);

  protected readonly booking = signal<Booking | null>(null);
  protected readonly failed = signal(false);
  protected readonly isLoading = signal(true);

  protected readonly status = computed(() => {
    const b = this.booking();
    return b ? BOOKING_STATUS_DISPLAY[b.status] : null;
  });

  protected readonly contactVisible = computed(() => {
    const b = this.booking();
    return !!b && renterContactVisible(b);
  });

  /** The contract is generated on approval (FR-BKG-10). */
  protected readonly contractAvailable = this.contactVisible;

  protected readonly coverImage = computed(() => this.booking()?.unit?.images?.[0]?.url);

  protected readonly dateFormat = APP.dateDisplayFormat;

  protected readonly netToLessorHalalas = computed(() => {
    const b = this.booking();
    if (!b) return 0;
    return b.netToLessorHalalas ?? b.subtotalHalalas - b.commissionHalalas;
  });

  protected readonly telHref = computed(
    () => `tel:${this.booking()?.counterpartyContact?.mobile ?? ''}`,
  );

  /**
   * SRS §6 happy path, marked against the booking's actual state. A terminal
   * failure replaces the tail rather than pretending the trail continues.
   */
  protected readonly steps = computed<StepperStep[]>(() => {
    const b = this.booking();
    if (!b) return [];

    const failedStates: Partial<Record<BookingStatus, string>> = {
      [BookingStatus.Cancelled]: 'ملغي من الإدارة',
      [BookingStatus.Expired]: 'انتهت مهلة الحجز',
    };

    if (failedStates[b.status]) {
      return [
        { label: 'تم الدفع', state: 'done' },
        { label: failedStates[b.status] as string, state: 'failed' },
      ];
    }

    const order = [BookingStatus.Confirmed, BookingStatus.Active, BookingStatus.Completed];
    const reached = order.indexOf(b.status);

    return [
      {
        label: 'تم الدفع',
        state: b.status === BookingStatus.AwaitingPayment ? 'current' : 'done',
        meta: b.status === BookingStatus.AwaitingPayment ? 'بانتظار الدفع' : undefined,
      },
      { label: 'مؤكَّد', ...mark(0, reached) },
      { label: 'نشط', ...mark(1, reached) },
      { label: 'مكتمل', ...mark(2, reached) },
    ];
  });

  constructor() {
    // An effect, not the constructor body: a required input is not readable
    // until the first change-detection pass. Tracking id() also refetches when
    // the route param changes while this component instance is reused.
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  /** FR-BKG-10 — the agreement PDF, available to both parties once approved. */
  protected downloadContract(): void {
    const b = this.booking();
    if (!b) return;

    this.api
      .download(API_ENDPOINTS.bookings.contract(b.id))
      .subscribe((blob) => saveBlob(blob, `hayzak-contract-${b.referenceNo}.pdf`));
  }

  /** Retry button — reloads the id currently bound. */
  protected fetch(): void {
    this.load(this.id());
  }

  private load(id: string): void {
    this.failed.set(false);
    this.isLoading.set(true);
    this.service.byId(id).subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }
}

function mark(position: number, reached: number): Pick<StepperStep, 'state' | 'meta'> {
  if (reached < 0 || position > reached) return { state: 'upcoming' };
  if (position === reached) return { state: 'current', meta: 'الآن' };
  return { state: 'done' };
}
