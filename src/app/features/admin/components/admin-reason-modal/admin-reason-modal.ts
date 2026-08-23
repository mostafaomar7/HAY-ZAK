import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { reasonNeedsNote, reasonsFor } from '@core/constants/rejection-reasons';
import type { RejectionReasonCode, ReviewDecision } from '@core/models/admin.model';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';

/**
 * "نافذة السبب الإلزامي" — the sixth of the design's six unified components.
 *
 * Confirming is impossible until a reason is picked, and until a note is written
 * when the reason chosen was "سبب آخر" — the label promises an explanation, so
 * the form asks for one rather than sending an empty promise to the recipient.
 *
 * On the booking queue the modal also states the consequence in figures: a
 * rejection refunds the renter in full and cancels the lessor's entitlement
 * (FR-BKG-05). That is irreversible, so it is said before the button, not after.
 */
@Component({
  selector: 'app-admin-reason-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiModal, UiMoney, UiNotice],
  templateUrl: './admin-reason-modal.html',
  styleUrl: './admin-reason-modal.scss',
})
export class AdminReasonModal {
  protected readonly i18n = inject(LanguageService);

  readonly open = input(false, { transform: booleanAttribute });
  readonly queue = input.required<'listing' | 'booking'>();
  /** The amount that would be refunded — booking queue only. */
  readonly refundAmount = input<number | null>(null);
  readonly submitting = input(false, { transform: booleanAttribute });

  readonly confirmed = output<ReviewDecision>();
  readonly dismissed = output<void>();

  protected readonly picked = signal<RejectionReasonCode | null>(null);
  protected readonly note = signal('');

  protected readonly reasons = computed(() => reasonsFor(this.queue()));

  protected readonly ready = computed(() => {
    const code = this.picked();
    if (!code) return false;
    return !reasonNeedsNote(code) || this.note().trim().length > 0;
  });

  protected pick(code: RejectionReasonCode): void {
    this.picked.set(code);
  }

  protected setNote(value: string): void {
    this.note.set(value);
  }

  protected confirm(): void {
    const code = this.picked();
    if (!code || !this.ready()) return;

    this.confirmed.emit({ reasonCode: code, note: this.note().trim() || undefined });
    this.reset();
  }

  protected close(): void {
    this.reset();
    this.dismissed.emit();
  }

  private reset(): void {
    this.picked.set(null);
    this.note.set('');
  }
}
