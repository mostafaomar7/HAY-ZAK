import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';
import { UnitStatus } from '@core/enums/unit-status.enum';
import type { WireUnit, WireUnitImage } from '@core/models/unit-wire';
import { environment } from '../../../../../environments/environment';
import { UnitFormPage } from './unit-form-page';

const UNIT_ID = 'u-1';

function image(id: string, sortOrder: number): WireUnitImage {
  return {
    id,
    url: `/uploads/units/${UNIT_ID}/${id}.jpg`,
    sortOrder,
    sizeBytes: 40_000,
    contentType: 'image/jpeg',
  };
}

const IMAGES = [image('img-a', 0), image('img-b', 1), image('img-c', 2)];

function unit(images: WireUnitImage[]): WireUnit {
  return {
    id: UNIT_ID,
    title: 'مستودع مكيّف — النرجس',
    description: 'وصف كافٍ للمساحة ولطريقة الوصول إليها.',
    areaSqm: 35,
    dailyPriceHalalas: 7500,
    categoryId: 'c-1',
    cityId: 'riyadh',
    districtId: 'd-1',
    addressLine: 'الرياض — حي النرجس',
    visitHoursFrom: 540,
    visitHoursTo: 1260,
    minDays: 1,
    maxDays: null,
    status: UnitStatus.Draft,
    publishedAt: null,
    rejectionReason: null,
    reviewedAt: null,
    createdAt: '2026-08-05T09:00:00Z',
    updatedAt: '2026-08-05T09:00:00Z',
    coverUrl: null,
    imageCount: images.length,
    images,
  };
}

/**
 * The gallery on the edit form (FR-UNT-03).
 *
 * Written after a real gap: editing a listing that already had photos showed an
 * empty grid, "تحتاج ٣ صور على الأقل" and a disabled submit, because the form
 * only ever counted files picked in this session.
 */
describe('UnitFormPage — saved images', () => {
  let fixture: ComponentFixture<UnitFormPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const detailUrl = `${environment.apiUrl}${API_ENDPOINTS.lessor.unitById(UNIT_ID)}`;
  const orderUrl = `${environment.apiUrl}${API_ENDPOINTS.lessor.unitImageOrder(UNIT_ID)}`;

  /** Step 3 is where the gallery lives; the wizard opens on step 1. */
  function goToImages() {
    fixture.componentRef.setInput('id', UNIT_ID);
    fixture.detectChanges();
    http.expectOne((r) => r.url === detailUrl).flush({ success: true, data: unit(IMAGES) });
    fixture.detectChanges();

    // The reference lists load alongside; they are not what is under test.
    http.match(() => true).forEach((r) => r.flush({ success: true, data: { items: [] } }));

    // Set rather than clicked through: the wizard only walks forward past a
    // valid step, and filling two steps of a form would be testing them here.
    (fixture.componentInstance as unknown as { step: { set(n: number): void } }).step.set(3);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitFormPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitFormPage);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('fills the gallery from the images the unit already has', () => {
    goToImages();

    expect(el.querySelectorAll('.images__item').length).toBe(3);
    // The first is the cover, and it is the only one labelled as such.
    expect(el.querySelectorAll('.images__primary').length).toBe(1);
    expect(el.textContent).not.toContain('تحتاج');
  });

  /**
   * The endpoint refuses a partial list with a 422 — "put these two first" and
   * "these are all the images" cannot be read off the same array — so the whole
   * order goes every time, not the pair that moved.
   */
  it('sends every image id, once, when one is moved towards the cover', () => {
    goToImages();

    const later = el.querySelectorAll('.images__item')[1].querySelectorAll('.images__move')[0];
    (later as HTMLButtonElement).click();

    const request = http.expectOne((r) => r.url === orderUrl);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ imageIds: ['img-b', 'img-a', 'img-c'] });

    // The server answers with its own numbering, and the screen re-seeds from
    // that rather than trusting the order it just guessed.
    request.flush({
      success: true,
      data: { images: [image('img-b', 0), image('img-a', 1), image('img-c', 2)] },
    });
    fixture.detectChanges();
    expect(el.querySelectorAll('.images__item').length).toBe(3);
  });

  it('cannot move the cover any earlier, or the last image any later', () => {
    goToImages();

    const items = el.querySelectorAll('.images__item');
    const first = items[0].querySelectorAll('.images__move');
    const last = items[2].querySelectorAll('.images__move');

    expect((first[0] as HTMLButtonElement).disabled).toBeTrue();
    expect((first[1] as HTMLButtonElement).disabled).toBeFalse();
    expect((last[1] as HTMLButtonElement).disabled).toBeTrue();
  });
});

/**
 * The wizard's step gate (FR-UNT-06).
 *
 * Written after a total blocker: the visiting-hours group asked
 * `isValidWindow({ days: [], … })`, which requires at least one day and so was
 * false whatever times were entered. Step two never validated, and **no lessor
 * could add a space at all** — the form said "اختر وقت إغلاق بعد وقت الفتح"
 * about a window that closed nine hours after it opened.
 */
describe('UnitFormPage — visiting hours', () => {
  let fixture: ComponentFixture<UnitFormPage>;
  let http: HttpTestingController;

  /** The group, reached the way the template's validator reaches it. */
  function hours() {
    return (fixture.componentInstance as unknown as { form: FormGroup }).form.get('visitHours')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitFormPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitFormPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.match(() => true).forEach((r) => r.flush({ success: true, data: { items: [] } }));
  });

  afterEach(() => http.verify());

  it('accepts the window the form opens with', () => {
    expect(hours().getRawValue()).toEqual({ from: '09:00', to: '21:00' });
    expect(hours().valid).toBeTrue();
  });

  it('accepts a window that opens after midnight and closes in the evening', () => {
    hours().setValue({ from: '01:06', to: '18:06' });
    expect(hours().valid).toBeTrue();
  });

  /** The rule this control actually exists for. */
  it('rejects a closing time at or before the opening time', () => {
    hours().setValue({ from: '21:00', to: '09:00' });
    expect(hours().valid).toBeFalse();

    hours().setValue({ from: '09:00', to: '09:00' });
    expect(hours().valid).toBeFalse();
  });

  it('rejects a half-filled window rather than reading it as open all day', () => {
    hours().setValue({ from: '09:00', to: '' });
    expect(hours().valid).toBeFalse();
  });
});

/**
 * The area field (FR-UNT-04).
 *
 * There was a `Validators.max(5000)` on it — a guess this side made about how
 * large a storage space can be. The server has no such rule, so a lessor with a
 * bigger warehouse was told a true number was invalid and could not list it.
 */
describe('UnitFormPage — area', () => {
  let fixture: ComponentFixture<UnitFormPage>;
  let http: HttpTestingController;

  function area() {
    return (fixture.componentInstance as unknown as { form: FormGroup }).form.get('areaSqm')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitFormPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UnitFormPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.match(() => true).forEach((r) => r.flush({ success: true, data: { items: [] } }));
  });

  afterEach(() => http.verify());

  it('accepts a warehouse larger than the old five-thousand cap', () => {
    area().setValue(100_000);
    expect(area().valid).toBeTrue();
  });

  /** Still a real number, though: zero square metres is not a space. */
  it('still refuses nothing, and refuses zero', () => {
    area().setValue(null);
    expect(area().valid).toBeFalse();

    area().setValue(0);
    expect(area().valid).toBeFalse();
  });
});
