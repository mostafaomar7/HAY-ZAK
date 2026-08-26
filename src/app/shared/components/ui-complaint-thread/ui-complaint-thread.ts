import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
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

  protected isStray(message: ComplaintMessage): boolean {
    return !!message.isInternal && !this.showsInternal();
  }

  protected sizeLabel(attachment: ComplaintAttachment): string {
    return `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB`;
  }
}
