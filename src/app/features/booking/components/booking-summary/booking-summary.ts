import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { LanguageService } from '@core/i18n/language.service';
import type { Unit } from '@core/models/unit.model';
import { indicativeMonthlyPrice } from '@core/utils/money.utils';
import { UiBadge } from '@shared/components/ui-badge/ui-badge';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';
import type { BookingDraft } from '../../services/booking-wizard.service';

/**
 * The recap card that sits beside every step of the wizard.
 *
 * The renter is being asked to part with money at the end of a four-screen
 * journey; what they are buying, for which dates, at what price has to stay on
 * screen throughout rather than being something they have to remember from step
 * one. Both calendars are shown because the dates are a commitment and the
 * design gives Hijri equal standing (NFR-USB-05).
 */
@Component({
  selector: 'app-booking-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBadge, UiThumbnail],
  templateUrl: './booking-summary.html',
  styleUrl: './booking-summary.scss',
})
export class BookingSummary {
  protected readonly i18n = inject(LanguageService);

  readonly unit = input.required<Unit | null>();
  readonly draft = input.required<BookingDraft | null>();
  /** Hides the price block where a full breakdown is already on screen. */
  readonly showPrice = input(true, { transform: booleanAttribute });
  readonly showHijri = input(true, { transform: booleanAttribute });

  protected readonly monthly = computed(() =>
    Math.round(indicativeMonthlyPrice(this.unit()?.dailyPriceHalalas ?? 0)),
  );

  protected readonly periodTotal = computed(
    () => (this.unit()?.dailyPriceHalalas ?? 0) * (this.draft()?.daysCount ?? 0),
  );

  protected readonly place = computed(() => {
    const unit = this.unit();
    if (!unit) return '';
    return [unit.district?.name, unit.city?.name].filter(Boolean).join('، ');
  });

  protected startLabel = computed(() => this.gregorian(this.draft()?.startDate));
  protected endLabel = computed(() => this.gregorian(this.draft()?.endDate));
  protected startHijri = computed(() => this.hijri(this.draft()?.startDate));
  protected endHijri = computed(() => this.hijri(this.draft()?.endDate));

  private locale(): string {
    return this.i18n.language() === 'en' ? 'en-GB' : 'ar-SA';
  }

  private gregorian(iso: string | undefined): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  private hijri(iso: string | undefined): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(`${this.locale()}-u-ca-islamic-umalqura`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  }
}
