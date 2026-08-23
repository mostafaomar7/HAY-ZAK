import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import type { StatusTone } from '@core/constants/status-display';

/**
 * Status pill. Every status in the app renders through this one component, so a
 * tone's appearance is defined exactly once.
 *
 * `tone` is semantic, never a colour — see status-display.ts for the
 * status → tone mapping.
 */
@Component({
  selector: 'app-ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="toneClass()"><ng-content /></span>`,
  styleUrl: './ui-badge.scss',
})
export class UiBadge {
  readonly tone = input<StatusTone>('neutral');
  /** The draft variant is outlined with a dashed border in the design. */
  readonly dashed = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');

  protected readonly toneClass = computed(() => [
    `badge--${this.tone()}`,
    `badge--${this.size()}`,
    this.dashed() ? 'badge--dashed' : '',
  ]);
}
