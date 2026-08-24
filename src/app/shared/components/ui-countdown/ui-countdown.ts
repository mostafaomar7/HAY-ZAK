import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { secondsUntil } from '@core/utils/date.utils';

/**
 * mm:ss countdown — the booking hold, OTP expiry, and the lockout window.
 *
 * Takes either a server deadline (`until`, an ISO instant) or a plain duration
 * (`seconds`). **Prefer `until`.** A duration is decremented locally, so a tab
 * that slept, a clock that is wrong, or a page opened two minutes into a
 * fifteen-minute hold all show time the booking does not have — and the payment
 * then fails against a deadline the renter was told they still had. With
 * `until` the remaining time is recomputed from the deadline on every tick, so
 * the display can be stale by at most one second.
 *
 * Restarts whenever its input changes, so requesting a new code resets the clock
 * without the parent having to destroy the component. The interval is cleared on
 * destroy and on every restart, so a resend cannot leave two timers running.
 *
 * aria-live is "off": a per-second announcement would flood a screen reader.
 * The remaining time is exposed as text the user can read on demand instead.
 *
 * The interval runs outside the Angular zone. A zone-patched setInterval keeps
 * the application permanently unstable — it re-runs change detection every second
 * across the whole tree and makes whenStable() never resolve. Writing to a signal
 * schedules its own targeted update, so the zone is not needed here.
 */
@Component({
  selector: 'app-ui-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="countdown num"
    [class]="'countdown--' + tone()"
    dir="ltr"
    aria-live="off"
    >{{ display() }}</span
  >`,
  styles: `
    @use 'abstracts' as a;

    .countdown {
      font-variant-numeric: tabular-nums;
      unicode-bidi: isolate;
      font-weight: a.$fw-bold;
    }

    .countdown--primary {
      color: var(--color-primary);
    }

    // The last minutes of a booking hold, and a lockout window.
    .countdown--danger {
      color: var(--color-danger-fg);
    }

    // On a coloured banner, follow the banner rather than fighting it.
    .countdown--inherit {
      color: inherit;
    }
  `,
})
export class UiCountdown {
  /** A server-set deadline, ISO 8601. The accurate option — prefer it. */
  readonly until = input<string | null>(null);
  /** A duration, for the cases with no deadline to count to. */
  readonly seconds = input(0);
  /**
   * Colour is a prop, not a parent stylesheet reach-in: view encapsulation means
   * a parent cannot restyle this span, and a countdown inside a danger banner has
   * to change with it.
   */
  readonly tone = input<'primary' | 'danger' | 'inherit'>('primary');

  readonly finished = output<void>();

  private readonly zone = inject(NgZone);
  private readonly remaining = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly display = computed(() => {
    const total = this.remaining();
    const mm = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const ss = (total % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());

    effect(() => {
      // Tracking both means a new value of either restarts the clock.
      this.start(this.until(), this.seconds());
    });
  }

  private start(until: string | null, seconds: number): void {
    this.stop();

    const read = until ? () => secondsUntil(until) : null;
    this.remaining.set(read ? read() : Math.max(0, Math.floor(seconds)));
    if (this.remaining() === 0) return;

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        // Recomputed from the deadline where there is one, so a slept tab
        // catches up instead of counting on from where it dozed off.
        const next = read ? read() : this.remaining() - 1;
        this.remaining.set(Math.max(0, next));

        if (next <= 0) {
          this.stop();
          // Back into the zone: the parent's handler navigates and changes state.
          this.zone.run(() => this.finished.emit());
        }
      }, 1000);
    });
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
