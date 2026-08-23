import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ROLE_DISPLAY, TERMS_STATUS_DISPLAY, statusText } from '@core/constants/status-display';
import { LegalDocumentType } from '@core/enums/operations.enum';
import type { UserRole } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { TermsApprovalRow, TermsVersionRow } from '@core/models/admin.model';
import { TermsVersionStatus } from '@core/models/admin.model';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiTabs } from '@shared/components/ui-tabs/ui-tabs';
import type { TabItem } from '@shared/components/ui-tabs/ui-tabs';
import { AdminContentService } from '../../services/admin-content.service';

/** Which dialog is open over the version list. */
type Dialog = 'none' | 'approvals' | 'publish' | 'archive';

/**
 * ADM-12 — legal document versions (FR-ADM-07).
 *
 * A version is never edited once published, only superseded. That is the whole
 * point of versioning a legal document: the acceptance recorded against version
 * 2.2 has to keep meaning what 2.2 said on the day it was accepted.
 *
 * The acceptance list is therefore the evidence, and it is read-only everywhere,
 * including here.
 */
@Component({
  selector: 'app-admin-terms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminContentService],
  imports: [DatePipe, UiBadge, UiButton, UiEmptyState, UiModal, UiSkeleton, UiTabs],
  templateUrl: './terms-page.html',
  styleUrl: './terms-page.scss',
})
export class AdminTermsPage {
  private readonly content = inject(AdminContentService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly document = signal<LegalDocumentType>(LegalDocumentType.TermsOfUse);
  protected readonly versions = signal<TermsVersionRow[]>([]);
  protected readonly approvals = signal<TermsApprovalRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);

  protected readonly dialog = signal<Dialog>('none');
  protected readonly target = signal<TermsVersionRow | null>(null);

  protected readonly tabs = computed<TabItem<LegalDocumentType>[]>(() => [
    { value: LegalDocumentType.TermsOfUse, label: this.i18n.t('terms.docTerms') },
    { value: LegalDocumentType.PrivacyPolicy, label: this.i18n.t('terms.docPrivacy') },
    { value: LegalDocumentType.RefundPolicy, label: this.i18n.t('terms.docRefund') },
  ]);

  protected readonly documentLabel = computed(
    () => this.tabs().find((tab) => tab.value === this.document())?.label ?? '',
  );

  protected readonly rows = computed(() =>
    this.versions().filter((version) => version.documentType === this.document()),
  );

  constructor() {
    this.fetch();
  }

  protected fetch(): void {
    this.failed.set(false);
    this.isLoading.set(true);

    this.content.termsVersions().subscribe({
      next: (versions) => {
        this.versions.set(versions);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected setDocument(document: LegalDocumentType): void {
    this.document.set(document);
  }

  protected statusLabel(status: TermsVersionStatus): string {
    return statusText(TERMS_STATUS_DISPLAY[status], this.i18n.language());
  }

  protected statusTone(status: TermsVersionStatus) {
    return TERMS_STATUS_DISPLAY[status].tone;
  }

  protected roleLabel(role: UserRole): string {
    return statusText(ROLE_DISPLAY[role], this.i18n.language());
  }

  protected isDraft(row: TermsVersionRow): boolean {
    return row.status === TermsVersionStatus.Draft;
  }

  protected isPublished(row: TermsVersionRow): boolean {
    return row.status === TermsVersionStatus.Published;
  }

  // ── Dialogs ────────────────────────────────────────────────────────────
  protected openApprovals(row: TermsVersionRow): void {
    this.target.set(row);
    this.approvals.set([]);
    this.dialog.set('approvals');

    this.content.termsApprovals(row.id).subscribe({
      next: (rows) => this.approvals.set(rows),
      error: () => this.notifications.error(this.i18n.t('terms.error')),
    });
  }

  protected askPublish(row: TermsVersionRow): void {
    this.target.set(row);
    this.dialog.set('publish');
  }

  protected askArchive(row: TermsVersionRow): void {
    this.target.set(row);
    this.dialog.set('archive');
  }

  protected close(): void {
    this.dialog.set('none');
    this.target.set(null);
  }

  protected createVersion(): void {
    this.content
      .createTermsVersion({ documentType: this.document(), status: TermsVersionStatus.Draft })
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.t('admin.saved'));
          this.fetch();
        },
        error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
      });
  }

  protected publish(): void {
    const row = this.target();
    if (!row) return;

    this.close();
    this.content.publishTermsVersion(row.id).subscribe({
      next: () => {
        this.notifications.success(this.i18n.t('terms.published'));
        this.fetch();
      },
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }

  protected archive(): void {
    const row = this.target();
    if (!row) return;

    this.close();
    this.content.archiveTermsVersion(row.id).subscribe({
      next: () => {
        this.notifications.success(this.i18n.t('terms.archived'));
        this.fetch();
      },
      error: () => this.notifications.error(this.i18n.t('admin.actionFailed')),
    });
  }
}
