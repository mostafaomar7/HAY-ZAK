import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';

/** 0 = nothing typed, then weak → medium → good → strong. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * The three-bar strength meter beside a new-password field (FR-AUTH-02).
 *
 * The score is advisory and shown for guidance only — the actual rule is
 * `REGEX.password`, enforced by the validator on the control. A meter that
 * gated submission on its own heuristic would reject passwords the policy
 * accepts, so this never blocks anything.
 *
 * The bars carry `aria-hidden`; the reading is announced as text instead, since
 * "three filled bars" means nothing to a screen reader.
 */
@Component({
  selector: 'app-ui-password-strength',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" [class]="'meter--' + score()">
      <div class="meter__bars" aria-hidden="true">
        <span class="meter__bar"></span>
        <span class="meter__bar"></span>
        <span class="meter__bar"></span>
      </div>
      <span class="meter__label" aria-live="polite">{{ label() }}</span>
    </div>
  `,
  styleUrl: './ui-password-strength.scss',
})
export class UiPasswordStrength {
  private readonly i18n = inject(LanguageService);

  readonly value = input.required<string>();

  protected readonly score = computed<PasswordStrength>(() => scorePassword(this.value()));

  protected readonly label = computed(() => {
    switch (this.score()) {
      case 0:
        return '';
      case 1:
        return this.i18n.t('password.weak');
      case 2:
        return this.i18n.t('password.medium');
      case 3:
        return this.i18n.t('password.good');
      default:
        return this.i18n.t('password.strong');
    }
  });
}

/**
 * Length first, then variety. Deliberately simple and deterministic — a
 * dictionary-based estimator would be a large dependency for a hint that has no
 * authority over whether the password is accepted.
 */
export function scorePassword(value: string): PasswordStrength {
  if (!value) return 0;

  let points = 0;
  if (value.length >= 8) points++;
  if (value.length >= 12) points++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points++;
  if (/\d/.test(value)) points++;
  if (/[^\w\s]/.test(value)) points++;

  if (value.length < 8) return 1;
  if (points <= 2) return 1;
  if (points === 3) return 2;
  if (points === 4) return 3;
  return 4;
}
