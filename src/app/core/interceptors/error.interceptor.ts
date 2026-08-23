import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpStatus } from '../enums/http-status.enum';
import type { AppError } from '../models/app-error.model';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../services/logger.service';
import { NotificationService } from '../services/notification.service';

/** Set on a request to suppress the automatic error toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

const MESSAGES: Record<number, string> = {
  [HttpStatus.BadRequest]: 'البيانات المرسلة غير صحيحة.',
  [HttpStatus.Unauthorized]: 'انتهت الجلسة، من فضلك سجّل الدخول مرة أخرى.',
  [HttpStatus.Forbidden]: 'ليس لديك صلاحية للوصول لهذه الصفحة.',
  [HttpStatus.NotFound]: 'العنصر المطلوب غير موجود.',
  [HttpStatus.Conflict]: 'هذا العنصر موجود بالفعل.',
  [HttpStatus.UnprocessableEntity]: 'تحقق من صحة البيانات المدخلة.',
  [HttpStatus.TooManyRequests]: 'محاولات كثيرة، حاول بعد قليل.',
  [HttpStatus.ServerError]: 'حدث خطأ في الخادم، حاول لاحقًا.',
  [HttpStatus.ServiceUnavailable]: 'الخدمة غير متاحة حاليًا.',
};

/**
 * Turns any HttpErrorResponse into a normalized AppError, shows one toast,
 * and signs the user out on 401.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const logger = inject(LoggerService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((response: HttpErrorResponse) => {
      const appError: AppError = {
        status: response.status,
        message:
          response.error?.message ??
          MESSAGES[response.status] ??
          (response.status === 0
            ? 'تعذّر الاتصال بالخادم، تحقق من الإنترنت.'
            : 'حدث خطأ غير متوقع.'),
        errors: response.error?.errors,
        url: response.url ?? req.url,
        timestamp: new Date().toISOString(),
      };

      logger.error(`${req.method} ${appError.url} → ${appError.status}`, response.error);

      if (appError.status === HttpStatus.Unauthorized) {
        auth.logout();
      }

      if (!req.context.get(SKIP_ERROR_TOAST)) {
        notifications.error(appError.message);
      }

      return throwError(() => appError);
    }),
  );
};
