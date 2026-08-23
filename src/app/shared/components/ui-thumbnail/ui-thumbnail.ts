import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Unit photo with the design's hatched placeholder as the fallback.
 *
 * Falls back on error as well as on a missing URL: a listing whose image 404s
 * should still show a tidy placeholder rather than a broken-image glyph. Lazy +
 * async decoding keeps a long list off the main thread (NFR-PRF-01).
 */
@Component({
  selector: 'app-ui-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        <span class="thumb__placeholder" aria-hidden="true">صورة</span>
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
