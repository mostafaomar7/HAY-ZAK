import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { statusText, userRoleDisplay } from '@core/constants/status-display';
import { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AuditEntry } from '@core/models/audit';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminAuditService } from '../../services/admin-audit.service';

/**
 * ADM-13 — the audit trail (FR-ADM-09), `audit:view` and nobody else.
 *
 * Read-only, and it shows: no bulk selection, no action column, and the panel
 * that opens on a row has no footer. The service behind it has no update or
 * delete either, so the absence is structural rather than this template's
 * restraint. There is no export button, deliberately — that is a conversation
 * with the backend before it is a control here.
 *
 * The columns are `before` and `after` side by side because that pair is the
 * whole point of the log: "somebody changed the commission" is a rumour, and
 * "this person changed it from 15% to 5% at 14:12" is a record.
 *
 * The row is the entry. There is no detail fetch — the list already carries
 * every field, including the IP and the request id, and a second call would
 * have been a second chance to show a different version of a record whose
 * entire value is that it does not change.
 */
@Component({
  selector: 'app-admin-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminAuditService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiNotice],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AdminAuditPage {
  private readonly audit = inject(AdminAuditService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<AuditEntry[]>([]);
  protected readonly detail = signal<AuditEntry | null>(null);
  protected readonly actions = signal<string[]>([]);

  protected readonly columns = computed<AdminColumn[]>(() => [
    { key: 'actor', label: this.i18n.t('audit.user'), width: '1.2fr' },
    { key: 'action', label: this.i18n.t('audit.action'), width: '1.5fr' },
    { key: 'createdAt', label: this.i18n.t('audit.time'), width: '1.3fr' },
    { key: 'oldValue', label: this.i18n.t('audit.before'), width: '1.3fr' },
    { key: 'newValue', label: this.i18n.t('audit.after'), width: '1.5fr' },
  ]);

  protected readonly selects = computed(() => [
    {
      key: 'action',
      label: this.i18n.t('audit.action'),
      // Read from the data, so an action the server starts recording appears
      // in the filter without a release on this side.
      options: [
        { value: '', label: this.i18n.t('audit.allActions') },
        ...this.actions().map((action) => ({ value: action, label: action })),
      ],
    },
    {
      key: 'entityType',
      label: this.i18n.t('audit.entity'),
      options: [{ value: '', label: this.i18n.t('audit.allEntities') }],
    },
  ]);

  constructor() {
    this.fetch();
    this.audit.actions().subscribe({
      next: (actions) => this.actions.set(actions),
      // A missing filter list costs one dropdown, not the screen.
      error: () => undefined,
    });
  }

  protected fetch(): void {
    this.list.begin();
    const filters = this.list.filters();

    this.audit
      .list({
        action: filters['action'] || undefined,
        entityType: filters['entityType'] || undefined,
        from: filters['from'] || undefined,
        to: filters['to'] || undefined,
        page: this.list.page(),
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.items);
          this.list.succeed(page.items.length, page.pagination.total);
        },
        error: () => this.list.fail(),
      });
  }

  protected onFilters(values: AdminFilterValues): void {
    this.list.applyFilters(values);
    this.fetch();
  }

  protected onReset(): void {
    this.list.resetFilters();
    this.fetch();
  }

  protected onPage(page: number): void {
    this.list.setPage(page);
    this.fetch();
  }

  protected openRow(row: AuditEntry): void {
    this.detail.set(row);
  }

  protected close(): void {
    this.detail.set(null);
  }

  /**
   * Who acted — or nobody.
   *
   * `actor` is null for a background job and for an account that has since been
   * removed. Both are ordinary, so this answers with a dash rather than
   * letting a template reach into null, and never invents a name.
   */
  protected actorName(entry: AuditEntry): string {
    return entry.actor?.fullName ?? entry.actorType ?? '—';
  }

  protected actorRole(entry: AuditEntry): string {
    return entry.actor
      ? statusText(userRoleDisplay(UserRole.Admin, entry.actor.adminRole), this.i18n.language())
      : '';
  }
}
