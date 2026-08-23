import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';

/**
 * Unit photo with the design's hatched placeholder as the fallback.
 *
 * Falls back on error as well as on a missing URL, and the fallback is drawn
 * rather than written: a card is a large surface, and a large surface holding
 * the word "صورة" reads as a page that failed. An icon on the hatch reads as a
 * listing whose photographs have not been added — which is what it is, and
 * which is also what a blocked or unreachable image host looks like from here.
 *
 * Lazy + async decoding keeps a long list off the main thread (NFR-PRF-01).
 */
@Component({
  selector: 'app-ui-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIcon],
  template: `
    <div class="thumb" [class]="'thumb--' + size()">
      @if (src() && !failed()) {
        <img
          class="thumb__img"
          [src]="src()"
          [alt]="alt()"
          loading="lazy"
          decoding="async"
          (error)="failed.set(true)"
        />
      } @else {
        <span class="thumb__placeholder" aria-hidden="true">
          <app-ui-icon name="box" [size]="size() === 'sm' ? 18 : 28" />
        </span>
      }
    </div>
  `,
  styleUrl: './ui-thumbnail.scss',
})
export class UiThumbnail {
  readonly src = input<string | undefined>();
  readonly alt = input('');
  readonly size = input<'sm' | 'md'>('md');

  protected readonly failed = signal(false);
  protected readonly hasImage = computed(() => !!this.src() && !this.failed());
}
