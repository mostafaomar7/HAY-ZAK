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
import type { AbstractControl, ValidationErrors, FormGroup } from '@angular/forms';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { LanguageService } from '@core/i18n/language.service';
import { APP } from '@core/constants/app.constants';
import type { ReferenceItem, UnitImage, UnitRequest, VisitWindow } from '@core/models/unit.model';
import { dailySchedule } from '@core/models/unit-wire';
import { NotificationService } from '@core/services/notification.service';
import { ReferenceDataService } from '@core/services/reference-data.service';
import { markFormTouched } from '@core/utils/form.utils';
import { halalasToSar, sarToHalalas } from '@core/utils/money.utils';
import { isValidTimeRange } from '@core/utils/schedule.utils';
import { controlChanges } from '@core/utils/form-signals';
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

/** The one visiting window the API can store. */
type VisitHoursGroup = FormGroup<{ from: FormControl<string>; to: FormControl<string> }>;

/**
 * FR-UNT-06 — one window, and it has to close after it opens.
 *
 * On the group rather than on each control: "من" alone is not wrong, it is
 * unfinished, and painting the section red while the lessor is still typing
 * the second half helps nobody.
 */
function visitHoursValidator(control: AbstractControl): ValidationErrors | null {
  const { from, to } = (control as VisitHoursGroup).getRawValue();
  // The times only. `isValidWindow` also demands at least one day, and this
  // form has none to give — the API stores one window covering every day — so
  // asking it here was a check that could never pass.
  return isValidTimeRange(from, to) ? null : { visitHours: true };
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

  /**
   * The images already on the server, in the order it holds them.
   *
   * Kept apart from `images` rather than merged into one list, because the two
   * are not the same thing: a pending file has no id and cannot be reordered
   * or deleted server-side, and a saved image has no `File` to upload again.
   * Only the saved list has a cover — the first of it — and only once there is
   * one does the pending list stop being the front of the gallery.
   */
  protected readonly savedImages = signal<readonly UnitImage[]>([]);

  /** Blocks the arrows and the remove buttons while a call is in flight. */
  protected readonly imageBusy = signal(false);

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
    /**
     * One window covering every day — deliberately, because that is all the
     * API stores. It used to be a table of rows with day toggles, which read
     * back as "all week" whatever was entered: the days were never saved. A
     * simpler form that is true beats a richer one that promises storage there
     * is none of. Raised with the backend; the client is waiting on a ruling.
     */
    visitHours: this.fb.nonNullable.group(
      { from: '09:00', to: '21:00' },
      { validators: visitHoursValidator },
    ),
  });

  /** Which controls each step owns, so "next" validates only what is on screen. */
  private static readonly STEP_FIELDS: Record<number, readonly string[]> = {
    1: ['categoryId', 'title', 'description', 'areaSqm', 'dailyPriceSar', 'minDays', 'maxDays'],
    2: ['cityId', 'districtId', 'latitude', 'longitude', 'addressLine', 'visitHours'],
    3: [],
  };

  protected readonly isEdit = computed(() => !!this.id());

  protected get visitHours(): VisitHoursGroup {
    return this.form.controls.visitHours;
  }

  protected readonly categoryOptions = computed<ChoiceOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: this.i18n.pick(c) })),
  );

  /** See `controlChanges` — reactive forms are not signals. */
  private readonly changes = controlChanges(this.form);

  protected readonly categoryError = computed(() => {
    this.changes();
    const control = this.form.controls.categoryId;
    return control.touched && control.invalid ? 'اختر تصنيف المساحة.' : undefined;
  });

  protected readonly descriptionCount = computed(() => {
    this.changes();
    const value = this.form.controls.description.value ?? '';
    return `${value.length} / ${this.descriptionLimit}`;
  });

  /** FR-UNT-05 — indicative monthly figure, shown for guidance only. */
  protected readonly monthlyHint = computed(() => {
    this.changes();
    const sar = this.form.controls.dailyPriceSar.value;
    if (!sar) return '';
    const monthly = sar * APP.monthlyPriceMultiplier;
    return `يعادل نحو ${monthly.toLocaleString('en-US')} ر.س شهريًا (استرشادي)`;
  });

  /** FR-UNT-02 — at least two photographs before the unit can be submitted. */
  /**
   * Saved and pending together — the count the unit will have once this form
   * is submitted, which is the count the server checks.
   *
   * Counting only the pending files was the bug this replaced: editing a listing
   * with four photos already on it showed an empty grid, "تحتاج ٣ صور على الأقل"
   * and a disabled submit, on a unit that had never been short of images.
   */
  protected readonly imageCount = computed(() => this.savedImages().length + this.images().length);

  protected readonly imagesValid = computed(() => this.imageCount() >= this.imageRules.min);

  protected readonly canAddMoreImages = computed(() => this.imageCount() < this.imageRules.max);

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
      // The detail carries the images nested, so the gallery fills from the
      // same request as the rest of the form rather than a second one.
      this.savedImages.set(unit.images);
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
      if (this.imageCount() >= this.imageRules.max) {
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

  /**
   * Deletes an image that is already on the server. Immediate, and there is no
   * undo — the file is gone from storage, not marked for removal on save.
   */
  protected removeSavedImage(imageId: string): void {
    const unitId = this.draftId();
    if (!unitId || this.imageBusy()) return;

    this.imageBusy.set(true);
    this.units.deleteImage(unitId, imageId).subscribe({
      next: () => {
        this.savedImages.update((list) => list.filter((image) => image.id !== imageId));
        this.imageBusy.set(false);
      },
      error: () => {
        this.notifications.error('تعذّر حذف الصورة، حاول مرة أخرى.');
        this.imageBusy.set(false);
      },
    });
  }

  /**
   * Moves a saved image one place, `-1` earlier or `+1` later.
   *
   * Arrows rather than drag-and-drop: this is the only reordering control in
   * the product, it has to work on a phone and with a keyboard, and a drag
   * surface that does neither would be worse than no control at all.
   *
   * The whole list goes to the server — that is what the endpoint takes — and
   * the response is what the screen re-seeds from, so the numbering on screen
   * is the server's rather than one this page computed and hoped matched.
   */
  protected moveSavedImage(index: number, delta: -1 | 1): void {
    const unitId = this.draftId();
    const list = this.savedImages();
    const target = index + delta;
    if (!unitId || this.imageBusy() || target < 0 || target >= list.length) return;

    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    this.imageBusy.set(true);
    this.units
      .reorderImages(
        unitId,
        reordered.map((image) => image.id),
      )
      .subscribe({
        next: (images) => {
          this.savedImages.set(images);
          this.imageBusy.set(false);
        },
        error: () => {
          this.notifications.error('تعذّر تغيير ترتيب الصور، حاول مرة أخرى.');
          this.imageBusy.set(false);
        },
      });
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
        tap((images) => {
          pending.forEach((image) => URL.revokeObjectURL(image.previewUrl));
          this.images.set([]);
          // The endpoint answers with the unit's complete list in the order it
          // assigned, so the uploaded files become saved ones here and the
          // arrows work on them without a re-read.
          this.savedImages.set(images);
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

  /** Started but not finished — reported once the lessor has left the field. */
  protected windowInvalid(): boolean {
    return this.visitHours.touched && this.visitHours.invalid;
  }

  private setSchedule(windows: readonly VisitWindow[]): void {
    // A unit saved before this section existed has no window; the defaults
    // already in the group are a better starting point than two empty inputs.
    const window = windows[0];
    if (window) this.visitHours.setValue({ from: window.from, to: window.to });
  }

  private readSchedule(): VisitWindow[] {
    const { from, to } = this.visitHours.getRawValue();
    return this.visitHours.valid ? dailySchedule(from, to) : [];
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
