import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { UiHijriDate } from './ui-hijri-date';

/**
 * The grid has to be a *Hijri* grid, and that is the whole point of the
 * component: 29 squares in a 29-day month, the arrows stepping a Hijri month,
 * and a plain Gregorian date coming back out.
 */
describe('UiHijriDate', () => {
  let fixture: ComponentFixture<UiHijriDate>;
  let el: HTMLElement;

  async function build(value = '', min = '2026-01-01'): Promise<void> {
    await TestBed.configureTestingModule({ imports: [UiHijriDate] }).compileComponents();

    fixture = TestBed.createComponent(UiHijriDate);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('min', min);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  function open(): void {
    el.querySelector<HTMLButtonElement>('.hd__trigger')!.click();
    fixture.detectChanges();
  }

  function days(): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.day:not(.day--blank)'));
  }

  it('opens on the month holding the chosen date', async () => {
    // 1 Ramadan 1448.
    await build('2027-02-08');
    open();

    expect(el.querySelector('.panel__title')?.textContent).toContain('رمضان');
    expect(el.querySelector('.panel__title')?.textContent).toContain('1448');
  });

  it('draws only the days the Umm al-Qura month has', async () => {
    await build('2027-02-08');
    open();

    // Ramadan 1448 is twenty-nine days, not thirty and not thirty-one.
    expect(days().length).toBe(29);
  });

  it('emits the plain Gregorian date, never a Hijri one', async () => {
    await build('2027-02-08');
    open();

    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    days()[0].click();
    expect(emitted).toEqual(['2027-02-08']);
  });

  it('steps a Hijri month, not a Gregorian one', async () => {
    await build('2027-02-08');
    open();

    const next = el.querySelectorAll<HTMLButtonElement>('.panel__nav')[1];
    next.click();
    fixture.detectChanges();

    // Shawwal follows Ramadan, and it has thirty days.
    expect(el.querySelector('.panel__title')?.textContent).toContain('شوال');
    expect(days().length).toBe(30);
  });

  it('refuses a day before the minimum instead of hiding it', async () => {
    // Ramadan 1448 starts 2027-02-08; a floor part-way through it leaves the
    // earlier days visible but unusable, so the month still reads correctly.
    await build('2027-02-20', '2027-02-15');
    open();

    const disabled = days().filter((d) => d.disabled);
    expect(disabled.length).toBe(7);
    expect(days().length).toBe(29);
  });

  it('closes once a day is chosen', async () => {
    await build('2027-02-08');
    open();
    expect(el.querySelector('.panel')).not.toBeNull();

    days()[10].click();
    fixture.detectChanges();

    expect(el.querySelector('.panel')).toBeNull();
  });
});
