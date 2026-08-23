import type { ApplicationConfig } from '@angular/core';
import {
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { loadingInterceptor } from '@core/interceptors/loading.interceptor';
import { mockApiInterceptor } from '@core/mock/mock-api.interceptor';
import { seedDevSession } from '@core/mock/dev-session';
import { environment } from '../environments/environment';

// Required before LOCALE_ID may be anything other than 'en-US' — without it the
// date and number pipes throw at runtime rather than at build time.
// Locale data is registered by @core/i18n/locales, pulled in via LanguageService.
import '@core/i18n/locales';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      // Route params/data flow straight into component inputs.
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),

    // Order matters: loading wraps the request, auth adds the token,
    // error unwraps the failure last.
    // The mock interceptor runs last so it can answer a request the real ones
    // have already decorated. It is inert unless environment.useMockApi is set.
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor, mockApiInterceptor]),
    ),

    // A developer's convenience, and nobody else's: signs a mock lessor in so
    // the permission guards resolve without a login screen. Gated on its own
    // flag rather than on useMockApi, because the demo build also runs on the
    // fixtures and must start signed out — see environment.model.ts. Spread
    // away entirely otherwise, so neither the initializer nor the fixtures it
    // pulls in are referenced.
    ...(environment.seedSession ? [provideAppInitializer(seedDevSession)] : []),

    // SRS §2.4 — SAR is the sole currency, Riyadh (UTC+3) the reference timezone.
    { provide: LOCALE_ID, useValue: 'ar-SA' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'SAR' },
  ],
};
