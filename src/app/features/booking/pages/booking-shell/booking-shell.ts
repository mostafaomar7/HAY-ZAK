import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { APP } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import { countdown } from '@core/utils/countdown';
import { UiCountdown } from '@shared/components/ui-countdown/ui-countdown';
import type { WizardStep } from '@shared/components/ui-wizard-steps/ui-wizard-steps';
import { UiWizardSteps } from '@shared/components/ui-wizard-steps/ui-wizard-steps';
import type { BookingStep } from '../../services/booking-wizard.service';
import { BOOKING_STEPS, BookingWizardService } from '../../services/booking-wizard.service';
import { RenterBookingsService } from '../../services/renter-bookings.service';

/** Under this, the design turns the hold banner from informational to urgent. */
const URGENT_SECONDS = 3 * 60;

/**
 * Frame for the four booking steps (RNT-03 → RNT-05).
 *
 * Owns two things the steps share: the progress header, and the countdown on the
 * 15-minute date hold (FR-BKG-05). The hold starts at the identity step and has
 * to keep running across the navigation to payment — a timer owned by a step
 * component would reset the moment that step was destroyed, which is precisely
 * when the renter needs it to be honest.
 *
 * `BookingWizardService` is provided here rather than in root so that leaving the
 * flow disposes the draft along with the shell.
 */
@Component({
  selector: 'app-booking-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Both services are provided here, for the whole wizard, rather than on each
  // step. A step that injects one and forgets to provide it fails with a
  // NullInjectorError at construction — which renders as an empty page, not as
  // an error, because the router simply has no component to show. That is
  // exactly what happened, and providing them once is what stops it recurring.
  providers: [BookingWizardService, RenterBookingsService],
  imports: [RouterOutlet, UiCountdown, UiWizardSteps],
  templateUrl: './booking-shell.html',
  styleUrl: './booking-shell.scss',
})
export class BookingShell {
  private readonly router = inject(Router);
  private readonly wizard = inject(BookingWizardService);

  protected readonly i18n = inject(LanguageService);

  protected readonly holdMinutes = APP.bookingHoldMinutes;

  /** Which step is on screen, read from the child route's `data.step`. */
  private readonly step = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.deepestStep()),
    ),
    { initialValue: this.deepestStep() },
  );

  protected readonly currentIndex = computed(() => {
    const step = this.step();
    return step ? BOOKING_STEPS.indexOf(step) + 1 : 1;
  });

  protected readonly steps = computed<WizardStep[]>(() => [
    { index: 1, label: this.i18n.t('booking.stepDates') },
    { index: 2, label: this.i18n.t('booking.stepGoods') },
    { index: 3, label: this.i18n.t('booking.stepPay') },
  ]);

  /** The server's deadline; the countdown recomputes against it every tick. */
  protected readonly holdUntil = this.wizard.holdExpiresAt;
  protected readonly holdSeconds = countdown(this.holdUntil);

  protected readonly holdUrgent = computed(() => {
    const seconds = this.holdSeconds();
    return seconds > 0 && seconds <= URGENT_SECONDS;
  });

  protected readonly showHold = computed(() => this.holdSeconds() > 0);

  /**
   * When the hold lapses the dates are gone and nothing further in the wizard is
   * valid, so the renter is taken to the result screen that explains it rather
   * than left on a payment form that will now be refused.
   */
  protected onHoldExpired(): void {
    const bookingId = this.wizard.draft()?.bookingId;
    if (!bookingId) return;

    // Back to the payment screen, which re-reads the booking and says the hold
    // lapsed from the server's own answer. Announcing it from a local timer
    // would be this application deciding an outcome it does not own.
    void this.router.navigate(['/booking', bookingId, 'pay'], {
      replaceUrl: true,
    });
  }

  private deepestStep(): BookingStep | null {
    let node: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let step: BookingStep | undefined;

    while (node) {
      step = (node.data?.['step'] as BookingStep | undefined) ?? step;
      node = node.firstChild;
    }
    return step ?? null;
  }
}
