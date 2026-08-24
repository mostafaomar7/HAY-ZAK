import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UNIT_STATUS_DISPLAY } from '@core/constants/status-display';
import { UnitStatus } from '@core/enums/unit-status.enum';
import type { Unit } from '@core/models/unit.model';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiButton } from '@shared/components/ui-button/ui-button';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';

/**
 * One row of "المساحات المسجّلة" (LSR-02).
 *
 * The design gives this card five visual variants keyed off unit status — a
 * rejection panel with a resubmit action, a pending-review hint, a dimmed draft,
 * a plain published card and a fully-booked card with one fewer action. All of
 * that is derived from `status` here rather than duplicated per state.
 */
@Component({
  selector: 'app-unit-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiBadge, UiButton, UiNotice, UiThumbnail],
  templateUrl: './unit-card.html',
  styleUrl: './unit-card.scss',
})
export class UnitCard {
  readonly unit = input.required<Unit>();

  readonly suspendRequested = output<Unit>();

  protected readonly status = computed(() => UNIT_STATUS_DISPLAY[this.unit().status]);

  protected readonly isRejected = computed(() => this.unit().status === UnitStatus.Rejected);
  protected readonly isDraft = computed(() => this.unit().status === UnitStatus.Draft);

  protected readonly isPendingReview = computed(
    () => this.unit().status === UnitStatus.PendingReview,
  );

  /** Only a published unit can be paused — a booked one is already committed. */
  protected readonly canSuspend = computed(() => this.unit().status === UnitStatus.Published);

  protected readonly canEdit = computed(() => this.unit().status !== UnitStatus.Archived);

  protected readonly categoryLabel = computed(() => this.unit().category?.name ?? '');

  protected readonly coverImage = computed(() => this.unit().images?.[0]?.url);
}
