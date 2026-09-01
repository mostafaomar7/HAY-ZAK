import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { formatInstant } from '@core/utils/date.utils';
import type { ComplaintAttachment, ComplaintMessage } from '@core/models/complaint';
import { inject } from '@angular/core';

/**
 * The conversation on a complaint, rendered the same way for both readers.
 *
 * One component for the user's screen and the console because it is literally
 * one thread: both parties to the booking and the operator all write into it,
 * and two renderers would be two chances for a message to look different
 * depending on who opened it.
 *
 * The only difference is the internal note. The server never sends one to
 * `/me`, so a message arriving with `isInternal` on a user's screen is a
 * server bug — this component marks it visibly rather than filtering it out,
 * because a `.filter()` here would hide exactly the defect worth catching.
 */
@Component({
  selector: 'app-ui-complaint-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-complaint-thread.html',
  styleUrl: './ui-complaint-thread.scss',
})
export class UiComplaintThread {
  protected readonly i18n = inject(LanguageService);

  readonly messages = input.required<readonly ComplaintMessage[]>();

  /**
   * Set on the console, where an internal note is an ordinary thing to see.
   * Left off elsewhere, so one turning up reads as what it is.
   */
  readonly showsInternal = input(false, { transform: booleanAttribute });

  /**
   * Whether the platform wrote it.
   *
   * The one asymmetry worth drawing in this thread. Every message used to
   * render as the same grey card, so a conversation read as an undifferentiated
   * list and the reader had to check the label on each line to know whether
   * they were reading their own words or an answer to them.
   */
  protected isSupport(message: ComplaintMessage): boolean {
    return message.senderType === 'ADMIN';
  }

  protected isStray(message: ComplaintMessage): boolean {
    return message.isInternal && !this.showsInternal();
  }

  /**
   * Who wrote it, by kind.
   *
   * There is no name on the wire and there should not be: a renter must not be
   * shown which operator answered them, and the lessor's name is not theirs to
   * see (SRS §5). An unfamiliar kind falls back to the raw value rather than
   * to a blank line.
   */
  protected senderLabel(message: ComplaintMessage): string {
    switch (message.senderType) {
      case 'ADMIN':
        return this.i18n.t('complaints.fromSupport');
      case 'RENTER':
        return this.i18n.t('complaints.fromRenter');
      case 'LESSOR':
        return this.i18n.t('complaints.fromLessor');
      default:
        return message.senderType;
    }
  }

  /**
   * The moment, read the way a person writes one.
   *
   * It used to print `createdAt` straight into the template, so every message
   * in the thread was headed `2026-08-31T07:11:21.888Z` — a machine's timestamp
   * on the one screen where somebody is reading a conversation.
   */
  protected at(iso: string): string {
    return formatInstant(iso);
  }

  protected sizeLabel(attachment: ComplaintAttachment): string {
    return `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB`;
  }
}
