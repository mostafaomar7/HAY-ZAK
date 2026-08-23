import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';

/** Where permissionGuard and roleGuard send a signed-in user who lacks access. */
@Component({
  selector: 'app-forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState],
  template: `
    <div class="page">
      <app-ui-empty-state
        title="لا تملك صلاحية الوصول لهذه الصفحة"
        hint="إن كنت تعتقد أن ذلك خطأ، تواصل مع إدارة المنصة."
      >
        <a appUiButton variant="primary" routerLink="/">العودة للرئيسية</a>
      </app-ui-empty-state>
    </div>
  `,
  styles: `
    .page {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 24px;
    }
  `,
})
export class ForbiddenPage {}
