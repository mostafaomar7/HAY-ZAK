import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import type {
  ProhibitedItem,
  ReferenceCategory,
  ReferenceCity,
  ReferenceDistrict,
} from '@core/models/reference-admin';
import { environment } from '../../../../environments/environment';
import { AdminReferenceService } from './admin-reference.service';

const CATEGORY: ReferenceCategory = {
  id: 'c-1',
  slug: 'warehouse',
  nameAr: 'مستودع',
  nameEn: 'Warehouse',
  iconKey: 'box',
  sortOrder: 2,
  isActive: true,
};

const CITY: ReferenceCity = {
  id: 'city-1',
  nameAr: 'الرياض',
  nameEn: 'Riyadh',
  sortOrder: 1,
  isActive: true,
  districts: [],
};

const DISTRICT: ReferenceDistrict = {
  id: 'd-1',
  cityId: 'city-1',
  nameAr: 'السويدي',
  nameEn: 'Al Suwaidi',
  sortOrder: 6,
  isActive: true,
};

const ITEM: ProhibitedItem = {
  id: 'p-1',
  nameAr: 'مواد قابلة للاشتعال',
  nameEn: 'Flammables',
  noteAr: 'تشمل الوقود',
  noteEn: 'Includes fuel',
  sortOrder: 0,
  isActive: true,
};

/**
 * `PUT /admin/reference/:kind/:id` is a **full replace**, and this side had it
 * documented and typed as a partial. `setActive` sent `{ isActive: false }`
 * alone, which the server answers with a 422 naming `nameAr` and `nameEn` —
 * and `cityId` besides, on a district. Deactivating anything failed.
 */
describe('AdminReferenceService — deactivating', () => {
  let service: AdminReferenceService;
  let http: HttpTestingController;

  function urlFor(kind: Parameters<typeof API_ENDPOINTS.admin.referenceItem>[0], id: string) {
    return `${environment.apiUrl}${API_ENDPOINTS.admin.referenceItem(kind, id)}`;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminReferenceService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminReferenceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resends a category whole, slug and icon included', () => {
    service.setActive('categories', CATEGORY, false).subscribe();

    const request = http.expectOne(urlFor('categories', 'c-1'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      nameAr: 'مستودع',
      nameEn: 'Warehouse',
      sortOrder: 2,
      isActive: false,
      slug: 'warehouse',
      iconKey: 'box',
    });
    request.flush({ success: true, data: null });
  });

  it('resends a city whole', () => {
    service.setActive('cities', CITY, false).subscribe();

    const request = http.expectOne(urlFor('cities', 'city-1'));
    expect(request.request.body).toEqual({
      nameAr: 'الرياض',
      nameEn: 'Riyadh',
      sortOrder: 1,
      isActive: false,
    });
    request.flush({ success: true, data: null });
  });

  /**
   * A district needs its `cityId` — a district without its city is not an
   * address — and the endpoint takes no `sortOrder`, so sending one would be an
   * unknown field rather than a harmless extra. The server keeps the order it
   * already had.
   */
  it('resends a district with its city, and without a sort order', () => {
    service.setActive('districts', DISTRICT, false).subscribe();

    const request = http.expectOne(urlFor('districts', 'd-1'));
    expect(request.request.body).toEqual({
      cityId: 'city-1',
      nameAr: 'السويدي',
      nameEn: 'Al Suwaidi',
      isActive: false,
    });
    request.flush({ success: true, data: null });
  });

  it('resends a prohibited item with both its notes', () => {
    service.setActive('prohibited-items', ITEM, false).subscribe();

    const request = http.expectOne(urlFor('prohibited-items', 'p-1'));
    expect(request.request.body).toEqual({
      nameAr: 'مواد قابلة للاشتعال',
      nameEn: 'Flammables',
      sortOrder: 0,
      isActive: false,
      noteAr: 'تشمل الوقود',
      noteEn: 'Includes fuel',
    });
    request.flush({ success: true, data: null });
  });

  /** Turning one back on is the same call with the flag the other way. */
  it('sends the whole row to reactivate too', () => {
    service.setActive('cities', { ...CITY, isActive: false }, true).subscribe();

    const request = http.expectOne(urlFor('cities', 'city-1'));
    expect(request.request.body).toEqual({
      nameAr: 'الرياض',
      nameEn: 'Riyadh',
      sortOrder: 1,
      isActive: true,
    });
    request.flush({ success: true, data: null });
  });
});
