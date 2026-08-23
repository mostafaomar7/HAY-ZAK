import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import { UiButton } from '@shared/components/ui-button/ui-button';

export interface AdminFilterOption {
  value: string;
  label: string;
}

export interface AdminFilterSelect {
  key: string;
  label: string;
  options: readonly AdminFilterOption[];
}

export type AdminFilterValues = Readonly<Record<string, string>>;

/**
 * "شريط الفلاتر" — the third of the design's six unified components, sitting
 * above every admin table.
 *
 * The bar keeps a draft and only emits on "تطبيق الفلاتر". That is the design's
 * behaviour and it is also the right one here: an admin filter set is four or
 * five fields wide and each change is a round trip, so filtering as you type
 * would fire a query per keystroke on a table of thousands.
 *
 * Selects are described rather than projected, so every screen's bar is built
 * from data and none of them can drift apart in spacing or label size.
 */
@Component({
  selector: 'app-admin-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton],
  templateUrl: './admin-filter-bar.html',
  styleUrl: './admin-filter-bar.scss',
})
export class AdminFilterBar {
  protected readonly i18n = inject(LanguageService);

  readonly searchPlaceholder = input('');
  readonly selects = input<readonly AdminFilterSelect[]>([]);
  /** The applied values, so the bar can be re-seeded from the URL. */
  readonly values = input<AdminFilterValues>({});
  readonly exportable = input(false, { transform: booleanAttribute });

  readonly applied = output<AdminFilterValues>();
  readonly cleared = output<void>();
  readonly exported = output<void>();

  protected readonly draft = signal<Record<string, string>>({});

  constructor() {
    // Re-seed whenever the applied values change from outside — a reset
    // elsewhere, or a URL the page was opened on.
    effect(() => this.draft.set({ ...this.values() }));
  }

  protected set(key: string, value: string): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected valueOf(key: string): string {
    return this.draft()[key] ?? '';
  }

  protected apply(): void {
    this.applied.emit({ ...this.draft() });
  }

  protected reset(): void {
    this.draft.set({});
    this.cleared.emit();
  }
}
