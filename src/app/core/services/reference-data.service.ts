import { Injectable, inject } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { District, ReferenceItem } from '../models/unit.model';

/** `/public/cities` nests its districts. */
interface CityWithDistricts extends ReferenceItem {
  districts?: ReferenceItem[];
}
import { ApiService } from './api.service';

/**
 * Reference lists are admin-maintained (FR-ADM-05) and effectively static per
 * session, so each list is fetched once and replayed. Never hard-code these in
 * a template — FR-UNT-04 requires them to change without a code change.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly api = inject(ApiService);

  private categories$?: Observable<ReferenceItem[]>;
  private cities$?: Observable<CityWithDistricts[]>;
  private banks$?: Observable<ReferenceItem[]>;

  categories(): Observable<ReferenceItem[]> {
    this.categories$ ??= this.api
      .list<ReferenceItem>(API_ENDPOINTS.public.categories)
      .pipe(map((page) => page.items))
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.categories$;
  }

  cities(): Observable<CityWithDistricts[]> {
    this.cities$ ??= this.api
      .list<CityWithDistricts>(API_ENDPOINTS.public.cities)
      .pipe(map((page) => page.items))
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.cities$;
  }

  /** FR-LSR-02 — bank list for the account-holder form. */
  banks(): Observable<ReferenceItem[]> {
    this.banks$ ??= this.api
      .get<ReferenceItem[]>(API_ENDPOINTS.reference.banks)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.banks$;
  }

  /**
   * Districts arrive nested inside their city, so this is a read of the cities
   * response rather than a second request — one round trip for both, and no
   * window where a city is on screen before its districts arrive.
   */
  districts(cityId: string): Observable<District[]> {
    if (!cityId) return of([]);

    return this.cities().pipe(
      map((cities) => {
        const city = (cities as CityWithDistricts[]).find((item) => item.id === cityId);
        return (city?.districts ?? []).map((district) => ({ ...district, cityId }));
      }),
    );
  }

  /** FR-BKG-04 — shown with a mandatory acknowledgement before payment. */
  prohibitedItems(): Observable<ReferenceItem[]> {
    return this.api
      .list<ReferenceItem>(API_ENDPOINTS.public.prohibitedItems)
      .pipe(map((page) => page.items));
  }

  /** Call after an admin edits a reference list so the next read is fresh. */
  invalidate(): void {
    this.categories$ = undefined;
    this.cities$ = undefined;
    this.banks$ = undefined;
  }
}
