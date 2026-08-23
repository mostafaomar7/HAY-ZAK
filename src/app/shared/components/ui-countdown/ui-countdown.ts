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

/**
 * mm:ss countdown — OTP expiry, resend cooldown, and the lockout window
 * (FR-AUTH-04, FR-AUTH-11).
 *
 * Restarts whenever `seconds` changes, so requesting a new code resets the clock
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
  readonly seconds = input.required<number>();
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
      // Tracking seconds() means a new value restarts the clock.
      this.start(this.seconds());
    });
  }

  private start(from: number): void {
    this.stop();
    this.remaining.set(Math.max(0, Math.floor(from)));
    if (this.remaining() === 0) return;

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        const next = this.remaining() - 1;
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
