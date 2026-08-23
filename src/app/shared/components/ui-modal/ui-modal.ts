import type { ElementRef } from '@angular/core';
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
import { LanguageService } from '@core/i18n/language.service';

/**
 * Confirmation dialog — cancelling a booking, deleting an account, previewing an
 * invoice.
 *
 * Built on the native `<dialog>` rather than a hand-rolled overlay because
 * `showModal()` brings the things a home-made version reliably forgets: the top
 * layer, the inert background, focus trapping, and Escape. What is left to do
 * here is route Escape through the same `dismissed` output as the buttons, so a
 * caller only has one way to learn the dialog closed.
 *
 * `closedby="none"` is deliberate: a destructive action must not be dismissed by
 * a stray backdrop click, and the design gives every dialog an explicit
 * "التراجع" control.
 */
@Component({
  selector: 'app-ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-modal.html',
  styleUrl: './ui-modal.scss',
})
export class UiModal {
  protected readonly i18n = inject(LanguageService);

  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input.required<string>();
  /** 'danger' tints the icon and the confirm button for destructive actions. */
  readonly tone = input<'default' | 'danger'>('default');
  /** Set false for a plain informational dialog such as the invoice preview. */
  readonly showIcon = input(true, { transform: booleanAttribute });

  readonly dismissed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog()?.nativeElement;
      if (!element) return;

      if (this.open() && !element.open) element.showModal();
      else if (!this.open() && element.open) element.close();
    });
  }

  /** Escape fires `cancel`; funnel it to the same output the buttons use. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismissed.emit();
  }
}
