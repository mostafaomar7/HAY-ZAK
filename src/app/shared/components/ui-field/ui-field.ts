import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { EMPTY, switchMap } from 'rxjs';

/**
 * Label + control + hint + error, wrapped once so no form re-implements the
 * pairing. The projected control keeps its own `id`; pass the same value as
 * `for` so the label binds to it.
 *
 * Errors surface only after the control is touched or dirty, so a pristine form
 * is never covered in red — and the message is announced via role="alert" and
 * wired with aria-describedby rather than merely sitting nearby.
 */
@Component({
  selector: 'app-ui-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label class="field__label" [attr.for]="for()">
        {{ label() }}
        @if (optional()) {
          <span class="field__optional">(اختياري)</span>
        }
      </label>

      <ng-content />

      @if (showError()) {
        <p class="field__error" [id]="for() + '-error'" role="alert">{{ errorText() }}</p>
      } @else if (hint()) {
        <p class="field__hint" [id]="for() + '-hint'">{{ hint() }}</p>
      }
    </div>
  `,
  styleUrl: './ui-field.scss',
})
export class UiField {
  readonly label = input.required<string>();
  /** Must match the projected control's id. */
  readonly for = input.required<string>();
  readonly hint = input<string>();
  readonly optional = input(false, { transform: booleanAttribute });
  readonly control = input<AbstractControl | null>(null);
  /** Overrides the generated message when a field needs specific wording. */
  readonly errorOverride = input<string>();

  /**
   * Every change the control announces — value, status, touched, pristine.
   *
   * Without it the two computeds below never recompute. `control()` is a stable
   * reference and `invalid`, `touched` and `errors` are plain properties, not
   * signals, so a `computed` over them evaluates once — while the form is still
   * pristine and valid — and caches "no error" for the lifetime of the field.
   *
   * That is not a subtle degradation: it meant no validation message appeared
   * anywhere in the application. Fields turned red from the stylesheet and
   * never said why.
   *
   * `AbstractControl.events` is the one stream that covers all four; status
   * alone misses `touched`, which is half of when an error is allowed to show.
   */
  private readonly changes = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control?.events ?? EMPTY)),
  );

  protected readonly showError = computed(() => {
    this.changes();

    const control = this.control();
    return !!control && control.invalid && (control.touched || control.dirty);
  });

  protected readonly errorText = computed(() => {
    this.changes();
    return this.errorOverride() ?? describe(this.control()?.errors ?? null);
  });
}

/**
 * Single place that turns a validator key into Arabic. Keep the wording plain
 * and say what to do about it — NFR-USB-04 forbids technical codes.
 */
export function describe(errors: ValidationErrors | null): string {
  if (!errors) return '';

  const key = Object.keys(errors)[0];
  const value = errors[key];

  // The server's own wording for this field, from a 422's `details[]`. It is
  // already translated and it knows things no client validator can — that this
  // exact mobile number is taken, that this IBAN is not the lessor's. It wins
  // over anything below.
  if (key === 'server') return String(value);

  switch (key) {
    case 'required':
      return 'هذا الحقل مطلوب.';
    case 'notBlank':
      return 'لا يمكن أن يكون الحقل مسافات فقط.';
    case 'email':
      return 'البريد الإلكتروني غير صحيح.';
    case 'minlength':
      return `الحد الأدنى ${value.requiredLength} حرفًا.`;
    case 'maxlength':
      return `الحد الأقصى ${value.requiredLength} حرفًا.`;
    case 'min':
      return `أقل قيمة مسموحة ${value.min}.`;
    case 'max':
      return `أكبر قيمة مسموحة ${value.max}.`;
    case 'saudiMobile':
      return 'أدخل رقم جوال سعودي يبدأ بـ 05.';
    case 'saudiNationalId':
      return 'رقم الهوية أو الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2.';
    case 'saudiIban':
      return 'رقم الآيبان يجب أن يبدأ بـ SA ويتكوّن من 24 خانة.';
    case 'ibanChecksum':
      return 'رقم الآيبان غير صحيح، تأكّد من الأرقام.';
    case 'strongPassword':
      return 'كلمة المرور تحتاج حرفًا كبيرًا وصغيرًا ورقمًا و8 خانات على الأقل.';
    case 'fieldsMismatch':
      return 'القيمتان غير متطابقتين.';
    case 'minBookingDays':
      return `أقل مدة للحجز ${value.minDays} يوم.`;
    case 'maxBookingDays':
      return `أقصى مدة للحجز ${value.maxDays} يوم.`;
    case 'minImages':
      return `أضِف ${value.min} صور على الأقل.`;
    case 'maxImages':
      return `الحد الأقصى ${value.max} صور.`;
    case 'maxFileSize':
      return `حجم الملف يجب أن يكون أقل من ${value.megabytes} ميجابايت.`;
    case 'allowedFileTypes':
      return 'صيغة الملف غير مدعومة. استخدم JPG أو PNG أو WEBP.';
    case 'notPastDate':
      return 'لا يمكن اختيار تاريخ في الماضي.';
    case 'server':
      return String(value);
    default:
      return 'القيمة غير صحيحة.';
  }
}
