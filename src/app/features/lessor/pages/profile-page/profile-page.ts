import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { NotificationChannel } from '@core/enums/operations.enum';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { markFormTouched } from '@core/utils/form.utils';
import { LessorAccountService } from '../../services/lessor-account.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiToggle } from '@shared/components/ui-toggle/ui-toggle';
import { matchFields, strongPassword } from '@shared/validators/custom.validators';

/**
 * LSR-09 — "الملف الشخصي والإعدادات".
 *
 * Three independent sections: identity (read-only, since changing a verified
 * mobile or an ID number has to go through re-verification), password change, and
 * notification preferences.
 *
 * Deletion is deliberately awkward: PDPL gives a right to erasure, but SRS §10
 * and UC-04 mean outstanding money must be settled first. So the panel shows the
 * balance, requires the word "حذف" typed out, and is the only destructive action
 * on the screen.
 */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiButton, UiField, UiNotice, UiToggle],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly account = inject(LessorAccountService);

  protected readonly user = this.auth.user;
  protected readonly mobileVerified = this.auth.isMobileVerified;

  protected readonly changingPassword = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly outstanding = signal(0);

  /** FR-NTF — channel preferences. In-app cannot be switched off. */
  protected readonly prefs = signal<Record<NotificationChannel, boolean>>({
    [NotificationChannel.Sms]: true,
    [NotificationChannel.Email]: true,
    [NotificationChannel.InApp]: true,
  });

  protected readonly channels = [
    {
      key: NotificationChannel.Sms,
      label: 'رسائل نصية',
      hint: 'تنبيهات الطلبات والتحويلات',
      locked: false,
    },
    {
      key: NotificationChannel.Email,
      label: 'البريد الإلكتروني',
      hint: 'ملخص شهري وإشعارات المستحقات',
      locked: false,
    },
    {
      key: NotificationChannel.InApp,
      label: 'داخل المنصة',
      hint: 'كل التحديثات في قائمة الإشعارات',
      locked: true,
    },
  ];

  protected readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPassword]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  protected readonly deleteForm = this.fb.group({
    confirmation: ['', [Validators.required, Validators.pattern(/^حذف$/)]],
  });

  protected readonly canDelete = computed(() => this.deleteForm.valid && !this.deleting());

  constructor() {
    // The deletion panel must state the real balance — SRS §10 and UC-04 mean
    // outstanding money is settled before an account can go.
    this.account.earnings().subscribe({
      next: (earnings) => this.outstanding.set(earnings.netOutstanding),
      error: () => this.outstanding.set(0),
    });
  }

  protected readonly outstandingLabel = computed(
    () =>
      `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
        this.outstanding(),
      )} ر.س`,
  );

  protected isOn(channel: NotificationChannel): boolean {
    return this.prefs()[channel];
  }

  protected toggleChannel(channel: NotificationChannel, value: boolean): void {
    this.prefs.update((current) => ({ ...current, [channel]: value }));
    // Fire and forget: a preference toggle should feel instant, and the optimistic
    // state is harmless if the write fails.
    this.api.put(`${API_ENDPOINTS.auth.me}/notification-preferences`, this.prefs()).subscribe({
      error: () => this.notifications.warning('تعذّر حفظ تفضيلات الإشعارات.'),
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      markFormTouched(this.passwordForm);
      return;
    }

    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.api.post(API_ENDPOINTS.auth.changePassword, { currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.notifications.success('تم تغيير كلمة المرور.');
      },
      error: () => this.changingPassword.set(false),
    });
  }

  protected requestDeletion(): void {
    if (!this.canDelete()) return;

    this.deleting.set(true);
    this.api.delete(API_ENDPOINTS.auth.me).subscribe({
      next: () => {
        this.deleting.set(false);
        this.auth.logout();
      },
      error: () => this.deleting.set(false),
    });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
