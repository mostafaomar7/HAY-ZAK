import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';

/**
 * "اللوحة الجانبية المنزلقة" — the fifth of the design's six unified
 * components. 480 px, opens from the inline-start edge, closes on Escape.
 *
 * Built on native `<dialog>`, same as `UiModal`: the focus trap, the Escape
 * handling, the inert background and the top-layer stacking are all the
 * platform's, and every one of them is a bug waiting to happen when hand-rolled.
 * Only the geometry is ours.
 *
 * The eyebrow and title go in the header; the body and the footer actions are
 * projected, because a listing review, a user profile and an audit entry share
 * a frame and nothing else.
 *
 * Backdrop dismissal is the platform's own `closedby="any"` rather than a click
 * handler on the dialog. A handler would have to be paired with a keyboard
 * equivalent to be reachable at all, and the attribute already is one; where the
 * browser does not support it yet, Escape and the ✕ still close the panel.
 */
@Component({
  selector: 'app-admin-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
})
export class AdminPanel {
  protected readonly i18n = inject(LanguageService);

  readonly open = input(false, { transform: booleanAttribute });
  readonly eyebrow = input('');
  readonly title = input.required<string>();

  readonly dismissed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog()?.nativeElement;
      if (!element) return;

      if (this.open() && !element.open) element.showModal();
      if (!this.open() && element.open) element.close();
    });
  }
}
