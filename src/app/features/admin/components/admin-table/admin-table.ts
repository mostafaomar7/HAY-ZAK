import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { LanguageService } from '@core/i18n/language.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiPager } from '@shared/components/ui-pager/ui-pager';

export interface AdminColumn {
  key: string;
  label: string;
  /** A CSS grid track: '2fr', '1.1fr', '120px'. */
  width: string;
  sortable?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface AdminSort {
  key: string;
  direction: SortDirection;
}

/** What the table is showing right now. Driven by the service, never by a tab. */
export type TableState = 'data' | 'loading' | 'empty' | 'error';

/** Minimum a row must carry for selection and tracking to work. */
export interface AdminRow {
  id: string;
}

/**
 * "جدول الإدارة" — the fourth and largest of the design's six unified
 * components: sticky header, sorting, multi-select, pagination, and the four
 * states (data, skeleton, empty, error).
 *
 * The design's prototype puts a بيانات/تحميل/فارغ/خطأ switch above the table so a
 * reviewer can see all four. That switch is a review affordance, not a product
 * control — shipping it would let an operator put a live table into a fake error
 * state. `state` here is driven by the service; the switch exists only on the
 * component-library page, where flipping it is the point.
 *
 * Cells come from a projected `#row` template rather than from a column
 * renderer, because an admin cell is rarely one value — it is a date over its
 * Hijri equivalent, an amount beside its currency, a badge beside a reference.
 * The trade-off is that `let-row` is untyped inside that template; the page is
 * expected to keep the template a thin projection of a typed computed signal.
 *
 * Rows must expose `id`. Selection is held by the table and echoed out, because
 * it is identical on both review queues and belongs to neither.
 */
@Component({
  selector: 'app-admin-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, UiButton, UiPager],
  templateUrl: './admin-table.html',
  styleUrl: './admin-table.scss',
})
export class AdminTable<T extends AdminRow> {
  protected readonly i18n = inject(LanguageService);

  readonly columns = input.required<readonly AdminColumn[]>();
  readonly rows = input<readonly T[]>([]);
  readonly state = input<TableState>('data');

  /** The "إعلانات بانتظار المراجعة — 12" line above the header. */
  readonly caption = input('');
  readonly total = input(0, { transform: numberAttribute });

  readonly selectable = input(false, { transform: booleanAttribute });
  readonly selected = input<readonly string[]>([]);
  readonly sort = input<AdminSort | null>(null);

  readonly page = input(1, { transform: numberAttribute });
  readonly pageSize = input(20, { transform: numberAttribute });

  /** Empty and error copy: every table says something different here. */
  readonly emptyTitle = input('');
  readonly emptyHint = input('');
  readonly errorTitle = input('');
  readonly errorHint = input('');
  /** Support reference shown with the error, e.g. ERR-5031. */
  readonly errorRef = input('');

  /** Paints a row — used by the booking queue to flag an SLA breach. */
  readonly rowTone = input<(row: T) => 'default' | 'danger'>(() => 'default');

  readonly rowOpen = output<T>();
  readonly selectionChange = output<readonly string[]>();
  readonly sortChange = output<AdminSort>();
  readonly pageChange = output<number>();
  readonly retried = output<void>();
  readonly clearedFilters = output<void>();

  protected readonly rowTemplate = contentChild.required<TemplateRef<{ $implicit: T }>>('row');

  /** The checkbox column is the table's own, so it prepends its own track. */
  protected readonly gridTemplate = computed(() => {
    const tracks = this.columns().map((column) => column.width);
    return this.selectable() ? `44px ${tracks.join(' ')}` : tracks.join(' ');
  });

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every((row) => this.selected().includes(row.id));
  });

  protected readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  protected isSelected(id: string): boolean {
    return this.selected().includes(id);
  }

  protected toggleRow(id: string): void {
    const next = this.isSelected(id)
      ? this.selected().filter((item) => item !== id)
      : [...this.selected(), id];
    this.selectionChange.emit(next);
  }

  protected toggleAll(): void {
    this.selectionChange.emit(this.allSelected() ? [] : this.rows().map((row) => row.id));
  }

  protected onSort(column: AdminColumn): void {
    if (!column.sortable) return;
    const current = this.sort();
    const direction: SortDirection =
      current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key: column.key, direction });
  }

  /** "▲"/"▼" only on the sorted column; sortable ones get a dimmed hint. */
  protected arrow(column: AdminColumn): string {
    if (!column.sortable) return '';
    const current = this.sort();
    if (current?.key !== column.key) return '↕';
    return current.direction === 'asc' ? '▲' : '▼';
  }
}
