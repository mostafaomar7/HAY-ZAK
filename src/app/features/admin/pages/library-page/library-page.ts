import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { StatusTone } from '@core/constants/status-display';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminKpiCard } from '../../components/admin-kpi-card/admin-kpi-card';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminReasonModal } from '../../components/admin-reason-modal/admin-reason-modal';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn, TableState } from '../../components/admin-table/admin-table';

/** A stand-in row, so the gallery table has something to draw. */
interface SampleRow {
  id: string;
  unit: string;
  owner: string;
  price: number;
  wait: string;
}

const SAMPLE_ROWS: SampleRow[] = [
  { id: 's1', unit: 'مستودع مكيّف — النرجس', owner: 'سعود العنزي', price: 75, wait: '26 ساعة' },
  { id: 's2', unit: 'غرفة تخزين — الياسمين', owner: 'سعود العنزي', price: 45, wait: '19 ساعة' },
  { id: 's3', unit: 'قراج مغلق — الملقا', owner: 'فهد العمري', price: 60, wait: '41 ساعة' },
];

/**
 * ADM-14 — the component gallery (design: "مكتبة المكوّنات").
 *
 * Not a product screen: it is the living reference for the six unified
 * components, rendered from the same code the console uses so it cannot drift
 * from what actually ships.
 *
 * This is also the one place the table's state switch belongs. On an operational
 * screen the state is the service's to report and a control that faked it would
 * be a trap; here, seeing all four is the entire point.
 */
@Component({
  selector: 'app-admin-library-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminFilterBar,
    AdminKpiCard,
    AdminPanel,
    AdminReasonModal,
    AdminTable,
    UiBadge,
    UiButton,
  ],
  templateUrl: './library-page.html',
  styleUrl: './library-page.scss',
})
export class AdminLibraryPage {
  protected readonly i18n = inject(LanguageService);

  protected readonly tableState = signal<TableState>('data');
  protected readonly selected = signal<readonly string[]>([]);
  protected readonly panelOpen = signal(false);
  protected readonly reasonOpen = signal(false);

  protected readonly rows = SAMPLE_ROWS;

  protected readonly states: readonly {
    value: TableState;
    labelKey:
      'library.stateData' | 'library.stateLoading' | 'library.stateEmpty' | 'library.stateError';
  }[] = [
    { value: 'data', labelKey: 'library.stateData' },
    { value: 'loading', labelKey: 'library.stateLoading' },
    { value: 'empty', labelKey: 'library.stateEmpty' },
    { value: 'error', labelKey: 'library.stateError' },
  ];

  protected readonly tones: readonly { tone: StatusTone; label: string }[] = [
    { tone: 'success', label: 'معتمد' },
    { tone: 'warning', label: 'قيد الانتظار' },
    { tone: 'danger', label: 'مرفوض' },
    { tone: 'info', label: 'تحت المراجعة' },
    { tone: 'neutral', label: 'مؤرشف' },
  ];

  protected readonly kpis = computed(() => [
    {
      key: 'a',
      label: this.i18n.t('dash.pendingListings'),
      value: '12',
      unit: this.i18n.t('dash.unit'),
      delta: this.i18n.t('dash.awaitingDecision'),
      icon: 'box' as const,
    },
    {
      key: 'b',
      label: this.i18n.t('dash.gross'),
      value: '86,420',
      unit: this.i18n.t('admin.sar'),
      delta: this.i18n.t('dash.thisMonth'),
      icon: 'card' as const,
    },
    {
      key: 'c',
      label: this.i18n.t('dash.openComplaints'),
      value: '4',
      unit: this.i18n.t('dash.complaint'),
      delta: this.i18n.t('dash.liveOnly'),
      icon: 'grid' as const,
    },
  ]);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'unit', label: this.i18n.t('listings.unit'), width: '2fr', sortable: true },
    { key: 'owner', label: this.i18n.t('listings.owner'), width: '1.2fr' },
    { key: 'price', label: this.i18n.t('listings.price'), width: '1fr', sortable: true },
    { key: 'wait', label: this.i18n.t('listings.waiting'), width: '1fr' },
  ]);

  protected readonly filterSelects = computed(() => [
    {
      key: 'city',
      label: this.i18n.t('admin.city'),
      options: [{ value: '', label: this.i18n.t('admin.allCities') }],
    },
    {
      key: 'category',
      label: this.i18n.t('admin.category'),
      options: [{ value: '', label: this.i18n.t('admin.allCategories') }],
    },
    {
      key: 'status',
      label: this.i18n.t('admin.status'),
      options: [{ value: '', label: this.i18n.t('admin.allStatuses') }],
    },
  ]);

  /** The gallery table has no server behind it, so it lists everything at once. */
  protected readonly visibleRows = computed(() => (this.tableState() === 'data' ? this.rows : []));

  protected setState(state: TableState): void {
    this.tableState.set(state);
  }
}
