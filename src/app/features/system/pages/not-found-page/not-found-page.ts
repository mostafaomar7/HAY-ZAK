import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiEmptyState } from '@shared/components/ui-empty-state/ui-empty-state';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState],
  template: `
    <div class="page">
      <app-ui-empty-state title="الصفحة غير موجودة" hint="قد يكون الرابط قديمًا أو تغيّر عنوانه.">
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
export class NotFoundPage {}
