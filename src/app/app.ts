import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from '@core/services/loading.service';
import { ThemeService } from '@core/services/theme.service';
import { UiToaster } from '@shared/components/ui-toaster/ui-toaster';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToaster],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Injected so the theme effect runs for the app's lifetime.
  protected readonly theme = inject(ThemeService);
  protected readonly loading = inject(LoadingService);
}
