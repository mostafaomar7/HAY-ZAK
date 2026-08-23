import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Inline explanatory panel:
 *  - `info`: the standing note "تراجع إدارة المنصة كل طلب..."
 *  - `warning`: a condition that blocks an action but is fixable
 *  - `danger`: an administration rejection reason on a listing card
 *  - `success`: a settled outcome, such as a closed complaint
 */
@Component({
  selector: 'app-ui-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="notice" [class]="'notice--' + tone()" [attr.role]="role()">
      @if (title()) {
        <span class="notice__title">{{ title() }}</span>
      }
      <span class="notice__body"><ng-content /></span>
    </div>
  `,
  styleUrl: './ui-notice.scss',
})
export class UiNotice {
  readonly tone = input<'info' | 'warning' | 'danger' | 'success'>('info');
  readonly title = input<string>();

  /** Errors are announced; a standing hint would be noise if it were. */
  protected role(): string | null {
    return this.tone() === 'danger' ? 'alert' : null;
  }
}
