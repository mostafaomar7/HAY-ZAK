import type { Routes } from '@angular/router';
import { guestGuard } from '@core/guards/guest.guard';

/**
 * Sign-in and registration, behind the split brand layout.
 *
 * `guestGuard` keeps a signed-in user off these screens (FR-AUTH). The OTP step
 * is deliberately unguarded: the account exists but is not yet active, so the
 * user is neither a guest nor fully authenticated.
 *
 * Registration is one component with a `:role` segment — see RegisterPage for
 * why the role is a route parameter and not a field.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('@layout/public/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'login',
        title: 'تسجيل الدخول',
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/login-page/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'account-type',
        title: 'اختيار نوع الحساب',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/account-type-page/account-type-page').then((m) => m.AccountTypePage),
      },
      {
        path: 'register/:role',
        title: 'إنشاء حساب',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/register-page/register-page').then((m) => m.RegisterPage),
      },
      {
        // The lessor portal's own links point here; the renter always arrives
        // through the account-type screen.
        path: 'register',
        pathMatch: 'full',
        redirectTo: 'register/lessor',
      },
      {
        /**
         * Where the emailed confirmation link lands (§18).
         *
         * No guard: whoever follows the link may not be signed in on the device
         * they opened it on, and a login wall would strand them holding a token
         * that is timing out. Not `guestGuard` either — a signed-in user
         * confirming their own address is the normal case.
         */
        path: 'verify-email',
        title: 'تأكيد البريد الإلكتروني',
        loadComponent: () =>
          import('./pages/verify-email-page/verify-email-page').then((m) => m.VerifyEmailPage),
      },
      {
        path: 'verify',
        title: 'رمز التحقق',
        loadComponent: () => import('./pages/otp-page/otp-page').then((m) => m.OtpPage),
      },
      {
        path: 'forgot-password',
        title: 'استعادة كلمة المرور',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/forgot-password-page/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        title: 'إعادة تعيين كلمة المرور',
        loadComponent: () =>
          import('./pages/reset-password-page/reset-password-page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
];
