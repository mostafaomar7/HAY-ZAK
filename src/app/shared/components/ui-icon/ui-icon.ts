import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'grid'
  | 'box'
  | 'list'
  | 'card'
  | 'user'
  | 'globe'
  | 'bell'
  | 'search'
  | 'pin'
  | 'map'
  | 'calendar'
  | 'clock'
  | 'file'
  | 'check'
  | 'refresh'
  | 'warning'
  | 'info'
  | 'close'
  | 'phone'
  | 'mail'
  | 'warehouse'
  | 'filter';

/**
 * Inline SVG icon set, transcribed from the design export.
 *
 * Inline rather than a sprite or icon font: it inherits `currentColor` (so the
 * sidebar's active item flips from white to teal for free), needs no extra
 * request, and cannot flash unstyled.
 */
@Component({
  selector: 'app-ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        }
        @case ('box') {
          <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
          <path d="M3 8l9 5 9-5" />
          <path d="M12 13v8" />
        }
        @case ('list') {
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3.5 6h.01" />
          <path d="M3.5 12h.01" />
          <path d="M3.5 18h.01" />
        }
        @case ('card') {
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M3 10h18" />
          <path d="M16 15h2" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 2.5 15.4 0 18" />
          <path d="M12 3c-2.5 2.6-2.5 15.4 0 18" />
        }
        @case ('bell') {
          <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
          <path d="M13.7 20a2 2 0 0 1-3.4 0" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        }
        @case ('pin') {
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('map') {
          <path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z" />
          <path d="M9 4v13" />
          <path d="M15 7v13" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5.5l3.5 2" />
        }
        @case ('file') {
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        }
        @case ('check') {
          <path d="M4.5 12.5l5 5 10-11" />
        }
        @case ('refresh') {
          <path d="M20 12a8 8 0 1 1-2.5-5.8" />
          <path d="M20 4v5h-5" />
        }
        @case ('warning') {
          <path d="M12 4l9 16H3z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        }
        @case ('close') {
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        }
        @case ('phone') {
          <path
            d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L15 13l4 1.5V18a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z"
          />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3.5 7l8.5 6 8.5-6" />
        }
        @case ('warehouse') {
          <path d="M3 20V9l9-5 9 5v11" />
          <path d="M7 20v-7h10v7" />
          <path d="M7 16h10" />
        }
        @case ('filter') {
          <path d="M4 5h16l-6 7v6l-4 2v-8z" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class UiIcon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
