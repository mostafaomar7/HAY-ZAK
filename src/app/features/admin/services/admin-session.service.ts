import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, computed, inject, signal } from '@angular/core';

/** Design: 30 minutes idle, warned at 28. */
const IDLE_LIMIT_MS = 30 * 60_000;
const WARN_AT_MS = 28 * 60_000;
const TICK_MS = 1_000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'focus'] as const;

/**
 * The admin panel's idle timeout (design: "شاشات الأمان").
 *
 * Not applied to the renter or lessor portals: a renter left on a listing page
 * for half an hour has lost nothing, while an unattended operations console is
 * an open door to every user record on the platform.
 *
 * The ticker runs outside Angular's zone. A one-second interval inside it would
 * schedule a change-detection pass every second across a fourteen-screen panel
 * for a number nobody is looking at until the last two minutes; the signal write
 * is what brings it back in.
 */
@Injectable()
export class AdminSessionService {
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly idleSince = signal(Date.now());
  private readonly now = signal(Date.now());

  private timer?: ReturnType<typeof setInterval>;

  /** True once the session is close enough to expiry to say so. */
  readonly warning = computed(() => this.now() - this.idleSince() >= WARN_AT_MS);

  readonly secondsLeft = computed(() =>
    Math.max(0, Math.round((IDLE_LIMIT_MS - (this.now() - this.idleSince())) / 1000)),
  );

  readonly expired = computed(() => this.now() - this.idleSince() >= IDLE_LIMIT_MS);

  constructor() {
    const onActivity = () => this.extend();

    this.zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        this.document.addEventListener(event, onActivity, { passive: true, capture: true });
      }
      this.timer = setInterval(() => this.zone.run(() => this.now.set(Date.now())), TICK_MS);
    });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timer);
      for (const event of ACTIVITY_EVENTS) {
        this.document.removeEventListener(event, onActivity, { capture: true });
      }
    });
  }

  /** Called by activity, and by "متابعة الجلسة" in the warning dialog. */
  extend(): void {
    // Once warned, only the dialog may extend: a stray scroll behind the modal
    // should not silently cancel a countdown the operator is reading.
    if (this.warning()) return;
    this.idleSince.set(Date.now());
  }

  /** The dialog's explicit "keep me signed in". */
  resume(): void {
    this.idleSince.set(Date.now());
    this.now.set(Date.now());
  }
}
