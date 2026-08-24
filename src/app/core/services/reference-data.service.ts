import { Injectable, inject } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api-endpoints';
import type { District, ReferenceItem } from '../models/unit.model';
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
  private cities$?: Observable<ReferenceItem[]>;
  private banks$?: Observable<ReferenceItem[]>;
  private readonly districtsByCity = new Map<string, Observable<District[]>>();

  categories(): Observable<ReferenceItem[]> {
    this.categories$ ??= this.api
      .get<ReferenceItem[]>(API_ENDPOINTS.reference.categories)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.categories$;
  }

  cities(): Observable<ReferenceItem[]> {
    this.cities$ ??= this.api
      .get<ReferenceItem[]>(API_ENDPOINTS.reference.cities)
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

  districts(cityId: string): Observable<District[]> {
    if (!cityId) return of([]);

    let cached = this.districtsByCity.get(cityId);
    if (!cached) {
      cached = this.api
        .get<District[]>(API_ENDPOINTS.reference.districts(cityId))
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.districtsByCity.set(cityId, cached);
    }
    return cached;
  }

  /** FR-BKG-04 — shown with a mandatory acknowledgement before payment. */
  prohibitedItems(): Observable<ReferenceItem[]> {
    return this.api.get<ReferenceItem[]>(API_ENDPOINTS.reference.prohibitedItems);
  }

  /** Call after an admin edits a reference list so the next read is fresh. */
  invalidate(): void {
    this.categories$ = undefined;
    this.cities$ = undefined;
    this.banks$ = undefined;
    this.districtsByCity.clear();
  }
}
