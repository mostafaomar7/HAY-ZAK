import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { UiButton } from '@shared/components/ui-button/ui-button';

/**
 * "اختيار نوع الحساب" (PUB-05, FR-AUTH-12).
 *
 * Phase 1 gives each account exactly one role, so the choice has to be made
 * before the form rather than as a field inside it — a radio button on the
 * registration screen would imply it could be changed later, and it cannot.
 *
 * `returnUrl` is carried through both paths so a visitor who arrived here from
 * "احجز الآن" lands back on the same booking step afterwards.
 */
@Component({
  selector: 'app-account-type-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton],
  templateUrl: './account-type-page.html',
  styleUrl: './account-type-page.scss',
})
export class AccountTypePage {
  protected readonly i18n = inject(LanguageService);

  readonly returnUrl = input('');
}
