import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { AbstractControl, ValidationErrors, FormArray, FormGroup } from '@angular/forms';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { LanguageService } from '@core/i18n/language.service';
import { APP } from '@core/constants/app.constants';
import type { ReferenceItem, UnitRequest, VisitWindow, Weekday } from '@core/models/unit.model';
import { NotificationService } from '@core/services/notification.service';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { markFormTouched } from '@core/utils/form.utils';
import { halalasToSar, sarToHalalas } from '@core/utils/money.utils';
import { isValidWindow, uncoveredDays, weekdayName } from '@core/utils/schedule.utils';
import { LessorUnitsService } from '../../services/lessor-units.service';
import { UiButton } from '@shared/components/ui-button/ui-button';
import type { ChoiceOption } from '@shared/components/ui-choice-chips/ui-choice-chips';
import { UiChoiceChips } from '@shared/components/ui-choice-chips/ui-choice-chips';
import { UiField } from '@shared/components/ui-field/ui-field';
import { UiNotice } from '@shared/components/ui-notice/ui-notice';
import { UiThumbnail } from '@shared/components/ui-thumbnail/ui-thumbnail';
import type { WizardStep } from '@shared/components/ui-wizard-steps/ui-wizard-steps';
import { UiWizardSteps } from '@shared/components/ui-wizard-steps/ui-wizard-steps';
import { allowedFileTypes, maxFileSize } from '@shared/validators/custom.validators';

interface PendingImage {
  file: File;
  previewUrl: string;
}

/** One editable row of the visiting-hours table. */
type VisitWindowGroup = FormGroup<{
  days: FormControl<Weekday[]>;
  from: FormControl<string>;
  to: FormControl<string>;
}>;

function readWindow(group: VisitWindowGroup): VisitWindow {
  const value = group.getRawValue();
  return { days: value.days, from: value.from, to: value.to };
}

/**
 * FR-UNT-06 — a published unit needs at least one usable window.
 *
 * On the array rather than on each row: a half-typed row the lessor is still
 * working on should not paint the section red, but a schedule with nothing
 * usable in it cannot pass the step.
 */
function scheduleValidator(control: AbstractControl): ValidationErrors | null {
  const rows = (control as FormArray<VisitWindowGroup>).controls.map(readWindow);
  return rows.some(isValidWindow) ? null : { visitSchedule: true };
}

/**
 * LSR-03 — "إضافة مساحة (3 خطوات)", and the edit form for an existing unit.
 *
 * Three steps is a requirement, not a layout choice: SRS §2.2 caps this journey
 * because the target lessor is the least digitally experienced user class, and
 * demands that it survive interruption. Hence "save as draft" on every step and
 * a per-step validation gate rather than one long form validated at the end.
 */
@Component({
  selector: 'app-unit-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LessorUnitsService],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButton,
    UiChoiceChips,
    UiField,
    UiNotice,
    UiThumbnail,
    UiWizardSteps,
  ],
  templateUrl: './unit-form-page.html',
  styleUrl: './unit-form-page.scss',
})
export class UnitFormPage {
  protected readonly i18n = inject(LanguageService);

  /** Present when editing; absent when creating. */
  readonly id = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly units = inject(LessorUnitsService);
  private readonly reference = inject(ReferenceDataService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly step = signal(1);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly extrasOpen = signal(false);

  protected readonly categories = signal<ReferenceItem[]>([]);
  protected readonly cities = signal<ReferenceItem[]>([]);
  protected readonly districts = signal<ReferenceItem[]>([]);
  protected readonly images = signal<PendingImage[]>([]);

  /** The id of the draft this form is editing — set after the first save. */
  private draftId = signal<string | undefined>(undefined);

  protected readonly imageRules = APP.unitImages;
  protected readonly descriptionLimit = 600;

  protected readonly steps: readonly WizardStep[] = [
    { index: 1, label: 'الأساسيات' },
    { index: 2, label: 'الموقع' },
    { index: 3, label: 'الصور' },
  ];

  protected readonly floors = [
    { value: '', label: 'غير محدّد' },
    { value: 'ground', label: 'أرضي' },
    { value: 'first', label: 'دور أول' },
    { value: 'basement', label: 'قبو' },
    { value: 'roof', label: 'سطح' },
    { value: 'annex', label: 'ملحق' },
  ];

  protected readonly perkOptions: readonly ChoiceOption[] = [
    'مكيّف',
    'مغلق بالكامل',
    'إضاءة',
    'كاميرات مراقبة',
    'مدخل واسع',
    'أرضية مرصوفة',
  ].map((label) => ({ value: label, label }));

  protected readonly form = this.fb.group({
    // Step 1 — basics
    categoryId: ['', Validators.required],
    title: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(90)]],
    description: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(600)]],
    areaSqm: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(5000)],
    ],
    // Riyals: it is what the lessor types, and what the field's label says.
    // Converted to halalas once, in `payload()`.
    dailyPriceSar: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(100_000)],
    ],
    minDays: [1, [Validators.min(1)]],
    maxDays: [null as number | null, [Validators.min(1)]],
    floor: [''],
    perks: [[] as string[]],

    // Step 2 — location
    cityId: ['', Validators.required],
    districtId: ['', Validators.required],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
    addressLine: ['', Validators.required],
    postalCode: [''],
    visitSchedule: this.fb.array<VisitWindowGroup>([], scheduleValidator),
  });

  /** Which controls each step owns, so "next" validates only what is on screen. */
  private static readonly STEP_FIELDS: Record<number, readonly string[]> = {
    1: ['categoryId', 'title', 'description', 'areaSqm', 'dailyPriceSar', 'minDays', 'maxDays'],
    2: ['cityId', 'districtId', 'latitude', 'longitude', 'addressLine', 'visitSchedule'],
    3: [],
  };

  protected readonly isEdit = computed(() => !!this.id());

  /** The seven day toggles, named by Intl rather than by a hard-coded table. */
  protected readonly weekdays = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) => ({
    day,
    label: weekdayName(day, 'ar-SA'),
  }));

  protected get schedule(): FormArray<VisitWindowGroup> {
    return this.form.controls.visitSchedule;
  }

  /**
   * Days no window covers. Shown as a note rather than an error: a space that
   * genuinely closes on Friday is a valid answer, not a mistake.
   */
  protected readonly uncovered = signal<string[]>([]);

  protected readonly categoryOptions = computed<ChoiceOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: this.i18n.pick(c) })),
  );

  protected readonly categoryError = computed(() => {
    const control = this.form.controls.categoryId;
    return control.touched && control.invalid ? 'اختر تصنيف المساحة.' : undefined;
  });

  protected readonly descriptionCount = computed(() => {
    const value = this.form.controls.description.value ?? '';
    return `${value.length} / ${this.descriptionLimit}`;
  });

  /** FR-UNT-05 — indicative monthly figure, shown for guidance only. */
  protected readonly monthlyHint = computed(() => {
    const sar = this.form.controls.dailyPriceSar.value;
    if (!sar) return '';
    const monthly = sar * APP.monthlyPriceMultiplier;
    return `يعادل نحو ${monthly.toLocaleString('en-US')} ر.س شهريًا (استرشادي)`;
  });

  /** FR-UNT-02 — at least two photographs before the unit can be submitted. */
  protected readonly imagesValid = computed(() => this.images().length >= this.imageRules.min);

  protected readonly canAddMoreImages = computed(() => this.images().length < this.imageRules.max);

  constructor() {
    this.reference.categories().subscribe((list) => this.categories.set(list));
    this.reference.cities().subscribe((list) => this.cities.set(list));

    // Inputs are not readable in the constructor body, so the edit-mode load
    // runs in an effect. Without this, opening the edit route showed an empty
    // form instead of the unit.
    effect(() => {
      const editing = this.id();
      if (!editing) return;
      untracked(() => this.loadForEdit(editing));
    });
  }

  private loadForEdit(editing: string): void {
    this.draftId.set(editing);
    this.units.byId(editing).subscribe((unit) => {
      this.form.patchValue({
        categoryId: unit.categoryId,
        title: unit.title,
        description: unit.description,
        areaSqm: unit.areaSqm,
        dailyPriceSar: halalasToSar(unit.dailyPriceHalalas),
        minDays: unit.minDays ?? 1,
        maxDays: unit.maxDays ?? null,
        floor: unit.floor ?? '',
        perks: unit.perks ?? [],
        cityId: unit.cityId,
        districtId: unit.districtId,
        latitude: unit.location.latitude,
        longitude: unit.location.longitude,
        addressLine: unit.addressLine ?? '',
        postalCode: unit.postalCode ?? '',
      });
      this.setSchedule(unit.visitSchedule);
      // Load the district list without clearing the value patchValue just set.
      this.loadDistricts(unit.cityId);
    });
  }

  /** A new city invalidates the chosen district. */
  protected onCityChange(cityId: string): void {
    this.form.controls.districtId.setValue('');
    this.loadDistricts(cityId);
  }

  private loadDistricts(cityId: string): void {
    this.districts.set([]);
    if (cityId) this.reference.districts(cityId).subscribe((list) => this.districts.set(list));
  }

  protected togglePerk(perk: string): void {
    const control = this.form.controls.perks;
    const current = control.value ?? [];
    control.setValue(
      current.includes(perk) ? current.filter((p) => p !== perk) : [...current, perk],
    );
  }

  protected hasPerk(perk: string): boolean {
    return (this.form.controls.perks.value ?? []).includes(perk);
  }

  /**
   * Validates only the current step's fields before advancing, so a mistake on
   * step 3 never blocks the user with an error they cannot see.
   */
  protected next(): void {
    if (!this.stepValid(this.step())) {
      this.touchStep(this.step());
      this.notifications.warning('أكمل الحقول المطلوبة في هذه الخطوة.');
      return;
    }
    this.step.update((s) => Math.min(3, s + 1));
  }

  protected back(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  protected goTo(step: number): void {
    if (step < this.step()) this.step.set(step);
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    for (const file of files) {
      if (this.images().length >= this.imageRules.max) {
        this.notifications.warning(`الحد الأقصى ${this.imageRules.max} صور.`);
        break;
      }

      const rejection = this.rejectFile(file);
      if (rejection) {
        this.notifications.error(rejection);
        continue;
      }

      this.images.update((list) => [...list, { file, previewUrl: URL.createObjectURL(file) }]);
    }
  }

  protected removeImage(index: number): void {
    const removed = this.images()[index];
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    this.images.update((list) => list.filter((_, i) => i !== index));
  }

  /** SRS §2.2 — the journey must survive interruption, from any step. */
  protected saveDraft(): void {
    this.persist().subscribe({
      next: () => {
        this.notifications.success('تم حفظ المساحة كمسودة، يمكنك إكمالها لاحقًا.');
        void this.router.navigate(['/lessor/units']);
      },
    });
  }

  protected submit(): void {
    if (!this.form.valid) {
      markFormTouched(this.form);
      this.step.set(this.stepValid(1) ? 2 : 1);
      this.notifications.warning('أكمل الحقول المطلوبة قبل الإرسال.');
      return;
    }

    if (!this.imagesValid()) {
      this.notifications.warning(`أضِف ${this.imageRules.min} صور على الأقل.`);
      return;
    }

    // FR-UNT-07 — submission moves the unit to "pending review", never straight
    // to published.
    this.persist()
      .pipe(switchMap((unitId) => this.units.submitForReview(unitId)))
      .subscribe({ next: () => this.submitted.set(true) });
  }

  /**
   * Creates the draft on first save and updates it afterwards, then uploads any
   * files picked in step 3. Returns the unit id so the caller can chain.
   */
  private persist(): Observable<string> {
    this.saving.set(true);

    const payload = this.toPayload();
    const existing = this.draftId();
    const save$ = existing ? this.units.update(existing, payload) : this.units.createDraft(payload);

    return save$.pipe(
      tap((unit) => this.draftId.set(unit.id)),
      switchMap((unit) => this.uploadPending(unit.id).pipe(map(() => unit.id))),
      finalize(() => this.saving.set(false)),
    );
  }

  /** Uploads the files picked in step 3, then clears the local previews. */
  private uploadPending(unitId: string): Observable<unknown> {
    const pending = this.images();
    if (!pending.length) return of(null);

    // One request with every file, not one each: the endpoint takes them
    // together and answers with the order it assigned, which parallel uploads
    // would have raced for.
    return this.units
      .uploadImages(
        unitId,
        pending.map((image) => image.file),
      )
      .pipe(
        tap(() => {
          pending.forEach((image) => URL.revokeObjectURL(image.previewUrl));
          this.images.set([]);
        }),
      );
  }

  private toPayload(): Partial<UnitRequest> {
    const value = this.form.getRawValue();
    return {
      categoryId: value.categoryId ?? undefined,
      title: value.title ?? undefined,
      description: value.description ?? undefined,
      areaSqm: value.areaSqm ?? undefined,
      dailyPriceHalalas:
        value.dailyPriceSar === null || value.dailyPriceSar === undefined
          ? undefined
          : sarToHalalas(value.dailyPriceSar),
      minDays: value.minDays ?? undefined,
      maxDays: value.maxDays ?? undefined,
      floor: (value.floor || undefined) as UnitRequest['floor'],
      perks: value.perks ?? undefined,
      cityId: value.cityId ?? undefined,
      districtId: value.districtId ?? undefined,
      addressLine: value.addressLine ?? undefined,
      postalCode: value.postalCode || undefined,
      visitSchedule: this.readSchedule(),
      location:
        value.latitude != null && value.longitude != null
          ? { latitude: value.latitude, longitude: value.longitude }
          : undefined,
    };
  }

  private stepValid(step: number): boolean {
    return UnitFormPage.STEP_FIELDS[step].every((name) => this.form.get(name)?.valid ?? true);
  }

  private touchStep(step: number): void {
    for (const name of UnitFormPage.STEP_FIELDS[step]) {
      const control = this.form.get(name);
      control?.markAsTouched();
      control?.markAsDirty();
    }
  }

  /**
   * FR-UNT-03 — size and type checked before a byte leaves the browser. Reuses
   * the same validators the forms use, so the rules live in one place.
   *
   * Note this checks the browser-reported MIME type. NFR-SEC-07 requires the
   * server to verify the actual file content — this is a courtesy to the user,
   * not a security control.
   */
  // ── Visiting hours (FR-UNT-06) ─────────────────────────────────────────

  protected addWindow(): void {
    this.schedule.push(this.buildWindow());
    this.refreshUncovered();
  }

  protected removeWindow(index: number): void {
    this.schedule.removeAt(index);
    this.refreshUncovered();
  }

  protected toggleDay(index: number, day: Weekday): void {
    const control = this.schedule.at(index).controls.days;
    const days = control.value ?? [];

    control.setValue(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
    control.markAsDirty();
    this.refreshUncovered();
  }

  protected isDayOn(index: number, day: Weekday): boolean {
    return (this.schedule.at(index).controls.days.value ?? []).includes(day);
  }

  /** Reports a window the lessor has started but not finished. */
  protected windowInvalid(index: number): boolean {
    const group = this.schedule.at(index);
    return group.touched && !isValidWindow(readWindow(group));
  }

  private buildWindow(window?: VisitWindow): VisitWindowGroup {
    return this.fb.group({
      days: this.fb.control<Weekday[]>(window?.days ?? []),
      from: this.fb.control(window?.from ?? '09:00'),
      to: this.fb.control(window?.to ?? '21:00'),
    }) as VisitWindowGroup;
  }

  private setSchedule(windows: readonly VisitWindow[]): void {
    this.schedule.clear();
    // A unit with no schedule yet still gets one empty row, so the editor is
    // never an unexplained blank space with only an "add" button.
    const rows = windows.length ? windows : [undefined];
    rows.forEach((window) => this.schedule.push(this.buildWindow(window)));
    this.refreshUncovered();
  }

  private readSchedule(): VisitWindow[] {
    return this.schedule.controls.map(readWindow).filter(isValidWindow);
  }

  private refreshUncovered(): void {
    this.uncovered.set(uncoveredDays(this.readSchedule()).map((day) => weekdayName(day, 'ar-SA')));
  }

  private rejectFile(file: File): string | null {
    const control = new FormControl(file);

    if (maxFileSize(this.imageRules.maxSizeMb)(control)) {
      return `حجم «${file.name}» أكبر من ${this.imageRules.maxSizeMb} ميجابايت.`;
    }

    if (allowedFileTypes(this.imageRules.allowedTypes)(control)) {
      return `صيغة «${file.name}» غير مدعومة. استخدم JPG أو PNG أو WEBP.`;
    }

    return null;
  }
}
