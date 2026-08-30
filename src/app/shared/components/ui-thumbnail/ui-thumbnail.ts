import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';

export type ThumbnailSize = 'sm' | 'md' | 'lg' | 'fill';

const PLACEHOLDER_ICON_SIZE: Record<ThumbnailSize, number> = {
  sm: 18,
  md: 28,
  lg: 40,
  fill: 40,
};

/**
 * Unit photo with the design's hatched placeholder as the fallback.
 *
 * Four sizes, and `fill` is the one to reach for inside a card: it takes the
 * whole slot the host laid out instead of drawing a square in the middle of
 * it. Everything that sets a width and a height on `app-ui-thumbnail` wants
 * `fill` — without it the host's box and the component's box are two different
 * boxes, and the smaller one wins.
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
          <app-ui-icon name="box" [size]="iconSize()" />
        </span>
      }
    </div>
  `,
  styleUrl: './ui-thumbnail.scss',
})
export class UiThumbnail {
  readonly src = input<string | undefined>();
  readonly alt = input('');
  readonly size = input<ThumbnailSize>('md');

  protected readonly failed = signal(false);

  /** Scales with the box, so the hatch never reads as a dropped icon. */
  protected readonly iconSize = computed(() => PLACEHOLDER_ICON_SIZE[this.size()]);
  protected readonly hasImage = computed(() => !!this.src() && !this.failed());
}
