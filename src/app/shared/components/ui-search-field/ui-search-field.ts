import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { APP } from '@core/constants/app.constants';

/**
 * Debounced search input. Emits at most once per `APP.debounceMs` so a keystroke
 * never becomes a request — NFR-PRF-03 budgets 500ms per API call and typing
 * would blow straight through it.
 */
@Component({
  selector: 'app-ui-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="search"
      class="search"
      [attr.placeholder]="placeholder()"
      [attr.aria-label]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
    />
  `,
  styleUrl: './ui-search-field.scss',
})
export class UiSearchField {
  readonly placeholder = input('البحث');
  readonly initialValue = input('');

  readonly searchChange = output<string>();

  protected readonly value = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => this.value.set(this.initialValue()));
  }

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.searchChange.emit(next.trim()), APP.debounceMs);
  }
}
