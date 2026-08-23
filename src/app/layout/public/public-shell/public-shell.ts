import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { LoadingService } from '@core/services/loading.service';
import { PublicTopbar } from '../public-topbar/public-topbar';

/**
 * Frame for every renter-facing page: sticky header, content, footer.
 *
 * Unlike the lessor shell there is no guard and no sidebar — browsing and search
 * are open to guests (FR-MKT-02), and registration is only requested at the
 * moment "احجز الآن" is pressed.
 */
@Component({
  selector: 'app-public-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, PublicTopbar],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell {
  protected readonly i18n = inject(LanguageService);
  protected readonly loading = inject(LoadingService);
}
