import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';

/**
 * Tells the backend which language to answer in.
 *
 * It matters on every request, not just the ones that obviously render text:
 * error messages, notifications, reference data and CMS pages are all
 * translated server-side, and a request without this header gets whichever
 * language the server defaults to. The response echoes `Content-Language`.
 *
 * A `?lang=` already on the URL wins, so a shared link keeps its language.
 */
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.params.has('lang')) return next(req);

  return next(req.clone({ setHeaders: { 'Accept-Language': inject(LanguageService).language() } }));
};
