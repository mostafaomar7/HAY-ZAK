import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Split shell for the sign-in screens: a teal brand panel beside the form on
 * desktop, form only on a phone.
 *
 * The brand panel is decorative and hidden from assistive tech — its selling
 * points repeat what the marketing site says and would only delay a returning
 * user from reaching the form.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <div class="auth">
      <aside class="auth__brand" aria-hidden="true">
        <span class="auth__logo">حيزك</span>
        <p class="auth__tagline">كل مساحة لها قيمة</p>

        <ul class="auth__points">
          <li>إضافة المساحة بخطوات بسيطة</li>
          <li>مراجعة إدارة المنصة لكل طلب حجز</li>
          <li>متابعة المستحقات من مكان واحد</li>
        </ul>
      </aside>

      <main class="auth__panel">
        <div class="auth__card">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  readonly heading = input('');
}
