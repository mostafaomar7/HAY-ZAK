import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VerificationStatus } from '@core/enums/user-role.enum';
import { LanguageService } from '@core/i18n/language.service';
import type { TranslationKey } from '@core/i18n/translations';
import type { IdentityVerification } from '@core/models/identity.model';
import type {
  NotificationPreference,
  NotificationPreferenceKey,
  RenterProfile,
} from '@core/models/renter.model';
import { AuthService } from '@core/services/auth.service';
import { IdentityService } from '@core/services/identity.service';
import { NotificationService } from '@core/services/notification.service';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiModal } from '@shared/components/ui-modal/ui-modal';
import { UiPasswordStrength } from '@shared/components/ui-password-strength/ui-password-strength';
import { UiSkeleton } from '@shared/components/ui-skeleton/ui-skeleton';
import { UiToggle } from '@shared/components/ui-toggle/ui-toggle';
import { matchFields, strongPassword } from '@shared/validators/custom.validators';
import { saudiMobile } from '@shared/validators/saudi.validators';
import { RenterAccountService } from '../../services/renter-account.service';

const PREFERENCE_LABELS: Record<
  NotificationPreferenceKey,
  { title: TranslationKey; hint: TranslationKey }
> = {
  bookingStatus: { title: 'account.prefBookingStatus', hint: 'account.prefBookingStatusHint' },
  paymentsAndInvoices: { title: 'account.prefPayments', hint: 'account.prefPaymentsHint' },
  endOfTermReminder: { title: 'account.prefEndReminder', hint: 'account.prefEndReminderHint' },
  email: { title: 'account.prefEmail', hint: 'account.prefEmailHint' },
};

/**
 * The renter's account (RNT-09).
 *
 * The ID number is displayed masked and is not editable, matching the design's
 * "غير قابل للتعديل" and the fact that Nafath verification is bound to it —
 * letting it be changed here would silently invalidate a completed check.
 *
 * Deleting the account requires typing the word first. That is not friction for
 * its own sake: the action is irreversible, and the screen states plainly that
 * invoices are retained regardless (FR-AUTH-10).
 */
@Component({
  selector: 'app-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RenterAccountService],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiBadge,
    UiButton,
    UiField,
    UiModal,
    UiPasswordStrength,
    UiSkeleton,
    UiToggle,
  ],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(RenterAccountService);
  private readonly identityService = inject(IdentityService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly i18n = inject(LanguageService);

  protected readonly profile = signal<RenterProfile | null>(null);
  protected readonly identity = signal<IdentityVerification | null>(null);
  protected readonly preferences = signal<NotificationPreference[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly deleteConfirmation = signal('');

  protected readonly profileForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    address: ['', [Validators.required]],
    mobile: ['', [Validators.required, saudiMobile]],
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, strongPassword]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchFields('newPassword', 'confirmPassword')] },
  );

  protected readonly newPassword = signal('');

  protected readonly isVerified = computed(
    () => this.identity()?.status === VerificationStatus.Verified,
  );

  protected readonly canDelete = computed(
    () => this.deleteConfirmation().trim() === this.i18n.t('account.deleteConfirmWord'),
  );

  protected readonly preferenceRows = computed(() =>
    this.preferences().map((preference) => ({
      ...preference,
      title: this.i18n.t(PREFERENCE_LABELS[preference.key].title),
      hint: this.i18n.t(PREFERENCE_LABELS[preference.key].hint),
    })),
  );

  constructor() {
    this.load();

    this.passwordForm.controls.newPassword.valueChanges.subscribe((value) =>
      this.newPassword.set(value ?? ''),
    );
  }

  protected load(): void {
    this.isLoading.set(true);

    this.account.profile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.profileForm.patchValue(profile);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });

    this.identityService.current().subscribe({
      next: (identity) => this.identity.set(identity),
      error: () => this.identity.set(null),
    });

    this.account.notificationPreferences().subscribe({
      next: (preferences) => this.preferences.set(preferences),
      error: () => this.preferences.set([]),
    });
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    const value = this.profileForm.getRawValue();

    this.account
      .updateProfile({
        fullName: value.fullName ?? '',
        address: value.address ?? '',
        mobile: value.mobile ?? '',
        email: value.email ?? '',
      })
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.savingProfile.set(false);
          this.notifications.success(this.i18n.t('account.saved'));
        },
        error: () => this.savingProfile.set(false),
      });
  }

  protected revertProfile(): void {
    const profile = this.profile();
    if (profile) this.profileForm.patchValue(profile);
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    const value = this.passwordForm.getRawValue();

    this.account
      .changePassword({
        currentPassword: value.currentPassword ?? '',
        newPassword: value.newPassword ?? '',
      })
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordForm.reset();
          this.newPassword.set('');
          this.notifications.success(this.i18n.t('account.passwordUpdated'));
        },
        error: () => this.savingPassword.set(false),
      });
  }

  protected togglePreference(key: NotificationPreferenceKey, enabled: boolean): void {
    const next = this.preferences().map((preference) =>
      preference.key === key ? { ...preference, enabled } : preference,
    );
    this.preferences.set(next);

    this.account.updateNotificationPreferences(next).subscribe({
      // Put the switch back if the server refused, rather than leaving the UI
      // claiming a setting that was never saved.
      error: () =>
        this.preferences.set(
          next.map((preference) =>
            preference.key === key ? { ...preference, enabled: !enabled } : preference,
          ),
        ),
    });
  }

  protected setDeleteConfirmation(event: Event): void {
    this.deleteConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected openDelete(): void {
    this.deleteConfirmation.set('');
    this.deleteOpen.set(true);
  }

  protected closeDelete(): void {
    this.deleteOpen.set(false);
  }

  protected confirmDelete(): void {
    if (!this.canDelete()) return;

    this.account.deleteAccount().subscribe({
      next: () => {
        this.deleteOpen.set(false);
        this.auth.logout();
      },
      error: () => this.deleteOpen.set(false),
    });
  }

  protected signOut(): void {
    this.auth.logout();
  }
}
