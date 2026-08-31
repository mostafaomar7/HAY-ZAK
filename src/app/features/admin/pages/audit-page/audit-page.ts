import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { statusText, userRoleDisplay } from '@core/constants/status-display';
import { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { AuditAction, AuditEntry } from '@core/models/audit';
import { describeAuditValue } from '@core/models/audit';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { AdminFilterBar } from '../../components/admin-filter-bar/admin-filter-bar';
import type { AdminFilterValues } from '../../components/admin-filter-bar/admin-filter-bar';
import { AdminPanel } from '../../components/admin-panel/admin-panel';
import { AdminTable } from '../../components/admin-table/admin-table';
import type { AdminColumn } from '../../components/admin-table/admin-table';
import { AdminListState } from '../../services/admin-list-state';
import { AdminAuditService } from '../../services/admin-audit.service';
import { AdminUsersService } from '../../services/admin-users.service';

/** Whether the person named is the one acted on, or the one who acted. */
type Subject = 'entity' | 'actor';

/** A UUID goes straight through; anything else is a person to look up first. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  providers: [AdminAuditService, AdminUsersService],
  imports: [DatePipe, AdminFilterBar, AdminPanel, AdminTable, UiNotice],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AdminAuditPage {
  private readonly audit = inject(AdminAuditService);
  private readonly users = inject(AdminUsersService);

  protected readonly i18n = inject(LanguageService);
  protected readonly list = new AdminListState();

  protected readonly rows = signal<AuditEntry[]>([]);
  protected readonly detail = signal<AuditEntry | null>(null);
  protected readonly actions = signal<AuditAction[]>([]);

  /**
   * Whose id the typed value resolved to, when it was not already one.
   *
   * Shown above the table so the two-step is visible rather than magic: the
   * operator typed a mobile number and is looking at one person's trail, and
   * they should be able to see which person was picked.
   */
  protected readonly resolved = signal<{ name: string; subject: Subject } | null>(null);

  /** The lookup found nobody, so there is no id to filter on and no rows. */
  protected readonly unresolved = signal('');

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
        // Deduplicated on the action itself: the server pairs each with an
        // entity type, and the same verb appears under several of them.
        ...[...new Set(this.actions().map((entry) => entry.action))].map((action) => ({
          value: action,
          label: action,
        })),
      ],
    },
    {
      /**
       * Which of the two questions is being asked.
       *
       * "What happened to this account" and "what did this account do" are
       * different questions with different answers, and the trail keeps them in
       * different columns — `entityId` against `actorUserId`. One box that
       * silently picked for the operator would answer whichever it chose and
       * look like it had answered the other.
       */
      key: 'subject',
      label: this.i18n.t('audit.subject'),
      options: [
        { value: 'entity', label: this.i18n.t('audit.subjectEntity') },
        { value: 'actor', label: this.i18n.t('audit.subjectActor') },
      ],
    },
    {
      key: 'entityType',
      label: this.i18n.t('audit.entity'),
      options: [
        { value: '', label: this.i18n.t('audit.allEntities') },
        ...[...new Set(this.actions().map((entry) => entry.entityType))].map((entityType) => ({
          value: entityType,
          label: entityType,
        })),
      ],
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

  /**
   * Reads the trail, resolving a person to an id first when it has to.
   *
   * `/admin/audit` has no free-text search and will not be given one: both
   * value columns are JSON, so searching inside them is a sequential scan of a
   * table that only ever grows — and it would turn the audit trail into a
   * search index over personal data, which is the opposite of why those columns
   * store only the fields that changed.
   *
   * So the backend's two-step is what runs here: look the person up in
   * `/admin/users`, which is indexed for exactly that, then filter the trail by
   * the id it returns. The operator types a mobile number and sees a trail;
   * the two requests are theirs to notice, not to make.
   */
  protected fetch(): void {
    this.list.begin();
    const filters = this.list.filters();
    const typed = filters['search']?.trim() ?? '';
    const subject: Subject = filters['subject'] === 'actor' ? 'actor' : 'entity';

    if (!typed) {
      this.resolved.set(null);
      this.unresolved.set('');
      this.read(filters, {});
      return;
    }

    // Already an id — no lookup, and none is possible: an `entityId` may be a
    // unit or a booking, and neither is in `/admin/users`.
    if (UUID.test(typed)) {
      this.resolved.set(null);
      this.unresolved.set('');
      this.read(filters, subject === 'actor' ? { actorUserId: typed } : { entityId: typed });
      return;
    }

    this.users.list({ search: typed }).subscribe({
      next: (page) => {
        const person = page.items[0];
        if (!person) {
          // No id means no filter, and reading unfiltered here would answer a
          // different question with a full trail — which reads as a result.
          this.resolved.set(null);
          this.unresolved.set(typed);
          this.rows.set([]);
          this.list.succeed(0, 0);
          return;
        }

        this.unresolved.set('');
        this.resolved.set({ name: person.fullName, subject });
        this.read(
          filters,
          subject === 'actor' ? { actorUserId: person.id } : { entityId: person.id },
        );
      },
      error: () => this.list.fail(),
    });
  }

  private read(filters: AdminFilterValues, who: { entityId?: string; actorUserId?: string }): void {
    this.audit
      .list({
        action: filters['action'] || undefined,
        entityType: filters['entityType'] || undefined,
        ...who,
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

  /** "كل ما فعله فلان" or "كل ما جرى لفلان" — never both at once. */
  protected resolvedLabel(): string {
    const found = this.resolved();
    if (!found) return '';
    return found.subject === 'actor'
      ? this.i18n.t('audit.resolvedActor', { name: found.name })
      : this.i18n.t('audit.resolvedEntity', { name: found.name });
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

  /**
   * The change as readable lines rather than `[object Object]`.
   *
   * `oldValue` and `newValue` are objects on the wire — `{ status: 'OPEN' }`
   * against `{ status: 'RESOLVED', resolution: 'NO_ACTION' }` — and printing
   * one straight into a cell is the failure this exists to avoid.
   */
  protected describe(value: Record<string, unknown> | null): string[] {
    return describeAuditValue(value);
  }

  protected actorRole(entry: AuditEntry): string {
    return entry.actor
      ? statusText(userRoleDisplay(UserRole.Admin, entry.actor.adminRole), this.i18n.language())
      : '';
  }
}
