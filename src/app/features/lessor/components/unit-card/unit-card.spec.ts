import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UnitStatus } from '@core/enums/unit-status.enum';
import type { Unit } from '@core/models/unit.model';
import { UnitCard } from './unit-card';

function makeUnit(status: UnitStatus, rejectionReason?: string): Unit {
  return {
    id: 'un-1',
    lessorId: 'u-1',
    categoryId: 'c-1',
    category: { id: 'c-1', nameAr: 'مستودع', nameEn: 'Warehouse' },
    cityId: 'riyadh',
    districtId: 'd-1',
    title: 'مستودع مكيّف — النرجس',
    description: '',
    areaSqm: 35,
    dailyPriceHalalas: 7500,
    location: { latitude: 24.7, longitude: 46.6 },
    isApproximateLocation: true,
    addressLine: 'الرياض — حي النرجس، شارع أنس بن مالك، مبنى 118',
    visitSchedule: [],
    images: [],
    status,
    rejectionReason,
    createdAt: '2026-08-05T09:00:00Z',
  };
}

describe('UnitCard', () => {
  let fixture: ComponentFixture<UnitCard>;

  function render(unit: Unit) {
    fixture = TestBed.createComponent(UnitCard);
    fixture.componentRef.setInput('unit', unit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const actionLabels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.card__action')).map((n) => n.textContent?.trim());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows the title, category, area and daily price', () => {
    const el = render(makeUnit(UnitStatus.Published));
    expect(el.textContent).toContain('مستودع مكيّف — النرجس');
    expect(el.textContent).toContain('مستودع');
    expect(el.textContent).toContain('35');
    expect(el.textContent).toContain('75');
  });

  it('offers details, edit and pause for a published unit', () => {
    const el = render(makeUnit(UnitStatus.Published));
    expect(actionLabels(el)).toEqual(['التفاصيل', 'تعديل', 'إيقاف مؤقت']);
  });

  it('drops the pause action once the unit is fully booked', () => {
    const el = render(makeUnit(UnitStatus.FullyBooked));
    expect(actionLabels(el)).toEqual(['التفاصيل', 'تعديل']);
  });

  it('shows the rejection reason and a resubmit action when rejected', () => {
    const el = render(makeUnit(UnitStatus.Rejected, 'الصور غير واضحة.'));
    expect(el.textContent).toContain('سبب الرفض من الإدارة');
    expect(el.textContent).toContain('الصور غير واضحة.');
    expect(el.textContent).toContain('تعديل وإعادة الإرسال');
    // The normal action strip is replaced, not appended to.
    expect(actionLabels(el)).toEqual([]);
  });

  it('replaces the actions with a waiting hint while under review', () => {
    const el = render(makeUnit(UnitStatus.PendingReview));
    expect(el.querySelector('.card__hint')?.textContent).toContain('أُرسلت إلى الإدارة');
    expect(actionLabels(el)).toEqual([]);
  });

  it('hides edit on an archived unit', () => {
    const el = render(makeUnit(UnitStatus.Archived));
    expect(actionLabels(el)).toEqual(['التفاصيل']);
  });

  it('emits the unit when pause is pressed', () => {
    const el = render(makeUnit(UnitStatus.Published));
    let emitted: Unit | undefined;
    fixture.componentInstance.suspendRequested.subscribe((u: Unit) => (emitted = u));

    const pause = Array.from(el.querySelectorAll<HTMLButtonElement>('.card__action')).find(
      (b) => b.textContent?.trim() === 'إيقاف مؤقت',
    );
    pause?.click();

    expect(emitted?.id).toBe('un-1');
  });
});
