import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { APP } from '@core/constants/app.constants';
import type { LessorBankAccount, ReferenceItem } from '@core/models';
import { NotificationService } from '@core/services/notification.service';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { applyServerErrors, markFormTouched } from '@core/utils/form.utils';
import { LessorAccountService } from '../../services/lessor-account.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { notBlank } from '@shared/validators/custom.validators';
import { saudiIban } from '@shared/validators/saudi.validators';

/**
 * LSR-08 — "البيانات البنكية" (FR-LSR-02).
 *
 * Once saved the screen becomes a read-only summary with the IBAN masked, because
 * NFR-SEC-02 forbids ever displaying it in full — the API only returns the last
 * four characters, so there is nothing to reveal client-side.
 *
 * The IBAN is validated by format *and* mod-97 checksum before submitting: a
 * transposed digit passes the format check, and the cost of that mistake is a
 * failed payout (UC-04) that the lessor discovers days later.
 */
@Component({
  selector: 'app-bank-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiButton, UiField, UiNotice],
  templateUrl: './bank-account-page.html',
  styleUrl: './bank-account-page.scss',
})
export class BankAccountPage {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(LessorAccountService);
  private readonly reference = inject(ReferenceDataService);
  private readonly notifications = inject(NotificationService);

  protected readonly banks = signal<ReferenceItem[]>([]);
  protected readonly saved = signal<LessorBankAccount | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editing = signal(false);

  protected readonly form = this.fb.group({
    accountHolderName: ['', [Validators.required, notBlank, Validators.minLength(6)]],
    bankName: ['', Validators.required],
    iban: ['', [Validators.required, saudiIban]],
  });

  /** Live "n / 24" counter, matching the design's input hint. */
  protected readonly ibanCount = computed(() => {
    const digits = (this.form.controls.iban.value ?? '').replace(/\s/g, '').length;
    return `${digits} / 24`;
  });

  protected readonly showForm = computed(() => this.editing() || !this.saved());

  constructor() {
    this.reference.banks().subscribe({
      next: (list) => this.banks.set(list),
      error: () => this.banks.set([]),
    });
    this.load();
  }

  protected edit(): void {
    // The stored IBAN is masked, so editing always starts from a blank field —
    // there is no plaintext value to prefill.
    this.form.reset({ accountHolderName: '', bankName: '', iban: '' });
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected submit(): void {
    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      accountHolderName: (value.accountHolderName ?? '').trim(),
      bankName: value.bankName ?? '',
      iban: (value.iban ?? '').replace(/\s/g, '').toUpperCase(),
    };

    const existing = this.saved();
    const save$ = existing
      ? this.account.updateBankAccount(existing.id, payload)
      : this.account.addBankAccount(payload);

    save$.subscribe({
      next: (account) => {
        this.saving.set(false);
        this.saved.set(account);
        this.editing.set(false);
        this.notifications.success('تم حفظ بياناتك البنكية.');
      },
      error: (err: { errors?: Record<string, string[]> }) => {
        this.saving.set(false);
        // Field-level messages from the server land on the matching controls.
        applyServerErrors(this.form, err.errors ?? {});
      },
    });
  }

  protected readonly maxNameLength = 80;
  protected readonly ibanPlaceholder = 'SA00 0000 0000 0000 0000 0000';
  protected readonly currency = APP.currency;

  private load(): void {
    this.account.bankAccounts().subscribe({
      next: (accounts) => {
        this.saved.set(accounts.find((a) => a.isDefault) ?? accounts[0] ?? null);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
