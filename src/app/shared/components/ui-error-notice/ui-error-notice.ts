import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { ApiError } from '@core/models/api-error.model';
import { UiNotice } from '../ui-notice/ui-notice';

/**
 * The general failure panel on a form.
 *
 * It prints the server's message and nothing of its own. The message arrives
 * already translated, and a client that rewrote it would be maintaining a
 * second, worse copy of wording it does not own.
 *
 * Underneath, small, it prints the request id. It looks like clutter until the
 * first support call: it is the one string that lets somebody find this exact
 * request in the server log, and asking a user to reproduce a failure is a far
 * worse experience than a grey line of text they can ignore.
 */
@Component({
  selector: 'app-ui-error-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiNotice],
  template: `
    @if (error(); as failure) {
      <app-ui-notice tone="danger">
        {{ failure.message }}
        @for (extra of extras(); track extra) {
          <span class="extra">{{ extra }}</span>
        }
        @if (failure.requestId) {
          <span class="ref">
            {{ i18n.t('error.requestId') }}
            <span dir="ltr">{{ failure.requestId }}</span>
          </span>
        }
      </app-ui-notice>
    }
  `,
  styleUrl: './ui-error-notice.scss',
})
export class UiErrorNotice {
  readonly error = input<ApiError | null>(null);
  /** Field messages for controls this form does not have — see `api-form.ts`. */
  readonly extras = input<readonly string[]>([]);

  protected readonly i18n = inject(LanguageService);
}
