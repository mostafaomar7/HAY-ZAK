import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
/**
 * `sm` exists for the admin panel, whose tables put three or four actions in a
 * row height — the 48px default would not fit. Do not reach for it on the
 * public or lessor screens, where touch targets rule.
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Attribute-selector button so it keeps native semantics, keyboard behaviour and
 * form participation — no wrapper element, no lost `type` or `disabled`.
 *
 *   <button appUiButton variant="accent">إضافة مساحة جديدة</button>
 *
 * `accent` is the gold CTA. The design uses it once per screen, in the topbar —
 * keep it that way or it stops reading as the primary action.
 */
@Component({
  selector: 'button[appUiButton], a[appUiButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-content />`,
  styleUrl: './ui-button.scss',
})
export class UiButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly fullWidth = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const list = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];
    if (this.fullWidth()) list.push('btn--block');
    return list.join(' ');
  });
}
