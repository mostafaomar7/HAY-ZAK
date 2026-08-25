import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
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
  protected readonly i18n = inject(LanguageService);

  readonly unit = input.required<Unit>();

  readonly suspendRequested = output<Unit>();

  protected readonly status = computed(() => UNIT_STATUS_DISPLAY[this.unit().status]);

  protected readonly isRejected = computed(() => this.unit().status === UnitStatus.Rejected);
  protected readonly isDraft = computed(() => this.unit().status === UnitStatus.Draft);

  protected readonly isPendingReview = computed(
    () => this.unit().status === UnitStatus.PendingReview,
  );

  /**
   * Only a published unit with free dates can be paused — a fully booked one is
   * already committed to the renters holding it.
   *
   * The second half of that is not the status: a fully booked unit is
   * PUBLISHED, so checking the status alone would offer the control on exactly
   * the units the rule exists to exclude.
   */
  protected readonly canSuspend = computed(
    () => this.unit().status === UnitStatus.Published && !this.unit().isFullyBooked,
  );

  protected readonly canEdit = computed(() => this.unit().status !== UnitStatus.Archived);

  protected readonly categoryLabel = computed(() => this.i18n.pick(this.unit().category));

  // `coverUrl` first: a list row carries a cover and a count rather than the
  // images themselves, so reading `images[0]` shows nothing on every card.
  protected readonly coverImage = computed(
    () => this.unit().coverUrl ?? this.unit().images?.[0]?.url,
  );
}
