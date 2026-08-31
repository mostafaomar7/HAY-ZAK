import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Permission } from '@core/constants/permissions';
import { LanguageService } from '@core/i18n/language.service';
import type { InvoiceType, TaxInvoice } from '@core/models/tax-invoice';
import { PermissionService } from '@core/services/permission.service';
import { formatInstant } from '@core/utils/date.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';
import { UiMoney } from '@shared/components/ui-money/ui-money';
import { UiPager } from '@shared/components/ui-pager/ui-pager';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { InvoicesService } from '../../services/invoices.service';

const PAGE_SIZE = 20;

/**
 * "فواتيري" — every tax document addressed to the signed-in account
 * (FR-PAY-09), for a renter and a lessor alike.
 *
 * One screen for both roles rather than two, because the endpoint is one and
 * the same person may hold both kinds: the booking invoice they paid, and the
 * commission invoice the platform billed them for letting a space. `type` is on
 * every row and is not decoration — without it a booking reference appears
 * twice with two different totals and nothing on screen says why.
 *
 * The row carries the whole document, because the list item and
 * `GET /me/invoices/:id` are the same object. So there is no detail route of
 * its own: for a booking invoice the link goes to the printable page that
 * already exists, and a commission invoice shows its figures here rather than
 * behind a second request that would answer with what is already on screen.
 */
@Component({
  selector: 'app-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [InvoicesService],
  imports: [RouterLink, UiBadge, UiButton, UiEmptyState, UiMoney, UiPager, UiSkeleton],
  templateUrl: './invoices-page.html',
  styleUrl: './invoices-page.scss',
})
export class InvoicesPage {
  private readonly invoices = inject(InvoicesService);
  private readonly permissions = inject(PermissionService);

  protected readonly i18n = inject(LanguageService);

  protected readonly rows = signal<readonly TaxInvoice[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly failed = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly shown = computed(() => this.rows().length);

  /**
   * Whether the printable booking document is reachable at all.
   *
   * `/my-bookings/:id/invoice` is guarded on `CreateBooking`, so offering the
   * link to an account without it sends somebody to "غير مصرّح" from a row that
   * is genuinely theirs. A lessor's commission invoice never had that page.
   */
  protected readonly canOpenBooking = computed(() =>
    this.permissions.can(Permission.CreateBooking),
  );

  constructor() {
    this.load();
  }

  protected load(page = 1): void {
    this.isLoading.set(true);
    this.failed.set(false);

    this.invoices.list(page).subscribe({
      next: (response) => {
        this.rows.set(response.items);
        this.total.set(response.pagination.total);
        this.page.set(page);
        this.isLoading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected onPage(page: number): void {
    this.load(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected issuedAt(invoice: TaxInvoice): string {
    return formatInstant(invoice.issuedAt);
  }

  protected typeLabel(type: InvoiceType): string {
    return type === 'COMMISSION'
      ? this.i18n.t('invoices.typeCommission')
      : this.i18n.t('invoices.typeBooking');
  }

  /**
   * A booking invoice is money the account paid out; a commission invoice is
   * money it was billed. Two different tones so the two are distinguishable
   * before either label is read.
   */
  protected typeTone(type: InvoiceType): 'info' | 'neutral' {
    return type === 'COMMISSION' ? 'neutral' : 'info';
  }

  protected showsVat(invoice: TaxInvoice): boolean {
    return invoice.vatHalalas > 0;
  }
}
