import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { UnitStatus } from '@core/enums/unit-status.enum';
import type { Unit } from '@core/models/unit.model';
import { environment } from '../../../../../environments/environment';
import { UnitsPage } from './units-page';

function makeUnit(id: string, title: string, status: UnitStatus): Unit {
  return {
    id,
    lessorId: 'u-1',
    categoryId: 'c-1',
    category: { id: 'c-1', nameAr: 'مستودع', nameEn: 'Warehouse' },
    cityId: 'riyadh',
    districtId: 'd-1',
    title,
    description: '',
    areaSqm: 35,
    dailyPriceHalalas: 7500,
    location: { latitude: 24.7, longitude: 46.6 },
    isApproximateLocation: true,
    addressLine: 'الرياض — حي النرجس، شارع أنس بن مالك، مبنى 118',
    visitSchedule: [],
    images: [],
    status,
    createdAt: '2026-08-05T09:00:00Z',
  };
}

describe('UnitsPage', () => {
  let fixture: ComponentFixture<UnitsPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const unitsUrl = `${environment.apiUrl}${API_ENDPOINTS.lessor.units}`;

  /** Answers the load() the constructor fires, in the agreed envelope. */
  function flushUnits(items: Unit[]) {
    http.expectOne((r) => r.url === unitsUrl).flush(page(items));
    fixture.detectChanges();
  }

  /** Rows in `data`, counts in `meta.pagination` — see api-response.model.ts. */
  function page(items: Unit[]) {
    return {
      success: true,
      data: items,
      meta: {
        pagination: {
          page: 1,
          limit: 12,
          total: items.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitsPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('shows a skeleton while the first request is in flight', () => {
    expect(el.querySelector('app-ui-skeleton')).not.toBeNull();
    expect(el.querySelector('.page__grid')).toBeNull();
    flushUnits([]);
  });

  it('renders a card per unit once loaded', () => {
    flushUnits([
      makeUnit('un-1', 'مستودع مكيّف — النرجس', UnitStatus.Published),
      makeUnit('un-2', 'غرفة تخزين — الياسمين', UnitStatus.FullyBooked),
    ]);

    expect(el.querySelectorAll('app-unit-card').length).toBe(2);
    expect(el.textContent).toContain('مستودع مكيّف — النرجس');
    expect(el.querySelector('app-ui-skeleton')).toBeNull();
  });

  it('offers the add-a-space call to action when the lessor has no units', () => {
    flushUnits([]);

    expect(el.textContent).toContain('لم تُضِف أي مساحة بعد');
    expect(el.querySelector('a[href="/lessor/units/new"]')).not.toBeNull();
  });

  it('shows a retryable error when the request fails', () => {
    http
      .expectOne((r) => r.url === unitsUrl)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(el.textContent).toContain('تعذّر تحميل المساحات');

    const retry = el.querySelector<HTMLButtonElement>('button[appUiButton]');
    expect(retry?.textContent).toContain('إعادة المحاولة');

    retry?.click();
    flushUnits([makeUnit('un-1', 'مستودع مكيّف — النرجس', UnitStatus.Published)]);
    expect(el.querySelectorAll('app-unit-card').length).toBe(1);
  });

  it('refetches with a status filter when a chip is chosen', () => {
    flushUnits([makeUnit('un-1', 'أ', UnitStatus.Published)]);

    const rejectedChip = Array.from(el.querySelectorAll<HTMLButtonElement>('.chip')).find(
      (c) => c.textContent?.trim() === 'مرفوضة',
    );
    rejectedChip?.click();
    fixture.detectChanges();

    const request = http.expectOne((r) => r.url === unitsUrl);
    expect(request.request.params.get('status')).toBe(UnitStatus.Rejected);
    request.flush(page([]));
    fixture.detectChanges();

    // Filtered-empty offers a way back, rather than the first-run CTA.
    expect(el.textContent).toContain('لا توجد مساحات مطابقة');
  });

  it('filters the loaded page by title without issuing a request', () => {
    flushUnits([
      makeUnit('un-1', 'مستودع مكيّف — النرجس', UnitStatus.Published),
      makeUnit('un-2', 'غرفة تخزين — الياسمين', UnitStatus.Published),
    ]);

    fixture.componentInstance['onSearch']('الياسمين');
    fixture.detectChanges();

    expect(el.querySelectorAll('app-unit-card').length).toBe(1);
    expect(el.textContent).toContain('غرفة تخزين — الياسمين');
    // No second call — searching must not cost a round trip.
    http.expectNone((r) => r.url === unitsUrl);
  });
});
