import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

/**
 * Fixed-length numeric code entry (FR-AUTH-04 — six digits).
 *
 * Separate boxes because that is what the design shows, but the behaviour has to
 * earn it: typing advances, Backspace on an empty box steps back, arrows move,
 * and pasting a whole code fills every box at once. Without the paste handler
 * this pattern is actively hostile — the code arrives by SMS and people paste it.
 *
 * `dir="ltr"` on the row: a code is a number, so it must read left to right even
 * inside the RTL page.
 */
@Component({
  selector: 'app-ui-otp-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="otp" dir="ltr" role="group" [attr.aria-label]="label()">
      @for (box of boxes(); track box) {
        <input
          #box
          class="otp__box"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="1"
          [value]="digitAt(box)"
          [disabled]="disabled()"
          [attr.aria-label]="digitLabel(box)"
          (input)="onInput(box, $event)"
          (keydown)="onKeydown(box, $event)"
          (paste)="onPaste($event)"
          (focus)="select($event)"
        />
      }
    </div>
  `,
  styleUrl: './ui-otp-input.scss',
})
export class UiOtpInput {
  readonly length = input(6);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly label = input('رمز التحقق');

  /** Emits on every change; `completed` fires only when all boxes are filled. */
  readonly valueChange = output<string>();
  readonly completed = output<string>();

  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('box');
  protected readonly digits = signal<string[]>([]);

  protected readonly boxes = computed(() => Array.from({ length: this.length() }, (_, i) => i));

  /** Reads through a method so an unset index yields '' rather than undefined. */
  protected digitAt(index: number): string {
    return this.digits()[index] || '';
  }

  protected digitLabel(index: number): string {
    return `الرقم ${index + 1} من ${this.length()}`;
  }

  protected onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const digit = input.value.replace(/\D/g, '').slice(-1);

    input.value = digit;
    this.write(index, digit);

    if (digit) this.focusAt(index + 1);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        // Empty box: clear and move back, so a held Backspace erases the code.
        if (!this.digits()[index]) {
          event.preventDefault();
          this.write(index - 1, '');
          this.focusAt(index - 1);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focusAt(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focusAt(index + 1);
        break;
    }
  }

  /** Fills every box from one paste, then parks focus on the last one filled. */
  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const pasted = (event.clipboardData?.getData('text') ?? '')
      .replace(/\D/g, '')
      .slice(0, this.length());
    if (!pasted) return;

    const next = Array.from({ length: this.length() }, (_, i) => pasted[i] ?? '');
    this.digits.set(next);
    this.syncDom(next);
    this.emit(next);
    this.focusAt(Math.min(pasted.length, this.length() - 1));
  }

  /** Selecting on focus means typing replaces rather than appends. */
  protected select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private write(index: number, digit: string): void {
    if (index < 0 || index >= this.length()) return;

    const next = [...this.digits()];
    next[index] = digit;
    this.digits.set(next);
    this.syncDom(next);
    this.emit(next);
  }

  private emit(digits: string[]): void {
    const value = digits.join('');
    this.valueChange.emit(value);
    if (value.length === this.length()) this.completed.emit(value);
  }

  private syncDom(digits: string[]): void {
    this.inputs().forEach((ref, i) => {
      ref.nativeElement.value = digits[i] ?? '';
    });
  }

  private focusAt(index: number): void {
    this.inputs()[index]?.nativeElement.focus();
  }
}
