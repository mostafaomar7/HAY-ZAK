import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { APP } from '@core/constants/app.constants';
import { LanguageService } from '@core/i18n/language.service';
import type { GeoPoint } from '@core/models/unit.model';

/**
 * Where a space is — approximately before approval, exactly after (FR-UNT-11).
 *
 * The two modes are one component on purpose. The rule that the precise address
 * is withheld until administration approves the booking is a privacy commitment,
 * not a styling choice, and it is far harder to leak a pin from a component that
 * takes `precise` as an input than from two components a page might pick between
 * by mistake.
 *
 * The rendering is a schematic, drawn in CSS: no tile provider has been chosen
 * yet, and the design's own screens show a stylised grid rather than real
 * imagery. When a provider is selected, only this component changes — the pages
 * pass a point, a radius and a label either way.
 */
@Component({
  selector: 'app-ui-location-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-location-map.html',
  styleUrl: './ui-location-map.scss',
})
export class UiLocationMap {
  protected readonly i18n = inject(LanguageService);

  readonly point = input<GeoPoint>();
  /** The area label drawn on the map — "حي النرجس، شمال الرياض". */
  readonly areaLabel = input('');
  /**
   * False draws the 300 m circle; true drops a pin. Defaults to false so a page
   * that forgets to pass it withholds the location rather than revealing it.
   */
  readonly precise = input(false, { transform: booleanAttribute });
  readonly height = input<'sm' | 'md'>('md');
  /** Set false where the surrounding card already explains the radius. */
  readonly showNote = input(true, { transform: booleanAttribute });

  protected readonly radiusMetres = APP.approximateLocationRadiusMetres;

  protected readonly circleLabel = computed(() =>
    this.i18n.t('details.locationRadius', { metres: this.radiusMetres }),
  );
}
