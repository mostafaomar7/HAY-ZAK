import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LanguageService } from '@core/i18n/language.service';
import { ACCOUNT_VERIFICATION_DISPLAY, statusText } from '@core/constants/status-display';
import { ApiError } from '@core/models/api-error.model';
import type { LessorBankAccount } from '@core/models/user.model';
import { AccountService } from '@core/services/account.service';
import { NotificationService } from '@core/services/notification.service';
import { markFormTouched } from '@core/utils/form.utils';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { notBlank } from '@shared/validators/custom.validators';
import { saudiIban } from '@shared/validators/saudi.validators';

/** Which confirmation, if any, is open. */
type Dialog = 'none' | 'default' | 'remove';

/**
 * LSR-08 — "البيانات البنكية" (FR-LSR-02).
 *
 * Several accounts, not one. The form asks for two things — the holder's name
 * and the IBAN — because the API reads the bank off the number itself and
 * ignores any `bankName` sent. A dropdown would be asking the lessor to
 * re-state something the number already says, and to get it wrong.
 *
 * The bank the API resolved is then put in front of them, which is the cheapest
 * confirmation available: a transposed digit usually still passes the checksum
 * of *some* bank, and the only person who can tell is the one who typed it.
 *
 * Nothing here shows a full IBAN. The API returns the last four digits and has
 * no endpoint that would give up the rest, to anybody, including the owner
 * (NFR-SEC-02) — so there is no "reveal" to build.
 */
@Component({
  selector: 'app-bank-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiButton, UiField, UiModal, UiNotice],
  templateUrl: './bank-account-page.html',
  styleUrl: './bank-account-page.scss',
})
export class BankAccountPage {
  protected readonly i18n = inject(LanguageService);

  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly notifications = inject(NotificationService);

  protected readonly accounts = signal<LessorBankAccount[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly saving = signal(false);
  protected readonly adding = signal(false);

  /** The account just added, so its resolved bank can be confirmed. */
  protected readonly justAdded = signal<LessorBankAccount | null>(null);

  /** The server's own message when it refuses an IBAN — already in Arabic. */
  protected readonly submitError = signal('');

  protected readonly dialog = signal<Dialog>('none');
  protected readonly target = signal<LessorBankAccount | null>(null);

  protected readonly form = this.fb.group({
    accountHolderName: ['', [Validators.required, notBlank, Validators.minLength(6)]],
    iban: ['', [Validators.required, saudiIban]],
  });

  /**
   * Live "n / 24" counter, matching the design's input hint.
   *
   * Fed from `valueChanges` rather than read off the control inside a
   * `computed`: a form control's `value` is a plain property, so a computed
   * over it evaluates once — against the empty initial value — and then shows
   * `0 / 24` for ever, however much is typed.
   */
  private readonly ibanValue = toSignal(this.form.controls.iban.valueChanges, {
    initialValue: '',
  });

  protected readonly ibanCount = computed(() => {
    const digits = (this.ibanValue() ?? '').replace(/[\s-]/g, '').length;
    return `${digits} / 24`;
  });

  protected readonly isEmpty = computed(() => !this.isLoading() && this.accounts().length === 0);
  protected readonly showForm = computed(() => this.adding() || this.isEmpty());

  constructor() {
    this.load();
  }

  protected startAdding(): void {
    this.form.reset({ accountHolderName: '', iban: '' });
    this.submitError.set('');
    this.justAdded.set(null);
    this.adding.set(true);
  }

  protected cancel(): void {
    this.adding.set(false);
    this.submitError.set('');
  }

  protected submit(): void {
    if (this.form.invalid) {
      markFormTouched(this.form);
      return;
    }

    this.saving.set(true);
    this.submitError.set('');

    const value = this.form.getRawValue();

    this.account
      .addBankAccount({
        accountHolderName: (value.accountHolderName ?? '').trim(),
        // Sent as typed apart from the separators the server strips anyway.
        // Nothing here rejects the spacing a bank prints on a statement.
        iban: (value.iban ?? '').replace(/[\s-]/g, '').toUpperCase(),
      })
      .subscribe({
        next: (added) => {
          this.saving.set(false);
          this.adding.set(false);
          this.justAdded.set(added);
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          // The API distinguishes a mistyped digit from a foreign account from
          // a duplicate, and says so in Arabic. Rewriting that here would only
          // lose the distinction.
          this.submitError.set(
            error instanceof ApiError ? error.message : this.i18n.t('bank.saveFailed'),
          );
        },
      });
  }

  // ── Confirmations ──────────────────────────────────────────────────────
  protected confirmDefault(account: LessorBankAccount): void {
    this.target.set(account);
    this.dialog.set('default');
  }

  protected confirmRemove(account: LessorBankAccount): void {
    this.target.set(account);
    this.dialog.set('remove');
  }

  protected closeDialog(): void {
    this.dialog.set('none');
    this.target.set(null);
  }

  protected makeDefault(): void {
    const account = this.target();
    if (!account) return;

    this.saving.set(true);
    this.account.makeDefault(account.id).subscribe({
      next: () => {
        this.finishAction('bank.defaultChanged');
      },
      error: () => this.failAction(),
    });
  }

  protected remove(): void {
    const account = this.target();
    if (!account) return;

    this.saving.set(true);
    this.account.removeBankAccount(account.id).subscribe({
      next: () => this.finishAction('bank.removed'),
      // The last account cannot go, and the server says why — showing its own
      // message beats a generic failure the lessor cannot act on.
      error: (error: unknown) => this.failAction(error),
    });
  }

  // ── Display ────────────────────────────────────────────────────────────
  protected maskedIban(account: LessorBankAccount): string {
    return `•••• ${account.ibanLast4}`;
  }

  /**
   * Informational only.
   *
   * `UNVERIFIED` means an administrator has not looked yet, not that anything
   * was refused — so nothing on this screen is disabled because of it.
   */
  protected verificationLabel(account: LessorBankAccount): string {
    return statusText(
      ACCOUNT_VERIFICATION_DISPLAY[account.verificationStatus],
      this.i18n.language(),
    );
  }

  protected verificationTone(account: LessorBankAccount) {
    return ACCOUNT_VERIFICATION_DISPLAY[account.verificationStatus].tone;
  }

  protected readonly maxNameLength = 80;
  protected readonly ibanPlaceholder = 'SA00 0000 0000 0000 0000 0000';

  private finishAction(key: 'bank.defaultChanged' | 'bank.removed'): void {
    this.saving.set(false);
    this.closeDialog();
    this.notifications.success(this.i18n.t(key));
    this.load();
  }

  private failAction(error?: unknown): void {
    this.saving.set(false);
    this.closeDialog();
    this.notifications.error(
      error instanceof ApiError ? error.message : this.i18n.t('admin.actionFailed'),
    );
  }

  private load(): void {
    this.account.bankAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
