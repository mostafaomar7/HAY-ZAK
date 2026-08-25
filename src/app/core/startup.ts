import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { STORAGE_KEYS } from './constants/storage-keys';
import { LoggerService } from './services/logger.service';
import { StorageService } from './services/storage.service';

/** The tokens `dev-session.ts` seeds. Only the fixtures ever issue these. */
const MOCK_TOKENS = ['dev-mock-token', 'dev-mock-refresh'];

/**
 * Says which build is running, in the console, on every start.
 *
 * It exists because two development builds look identical on screen and behave
 * completely differently, and nothing told you which one you had:
 *
 * - `npm start` answers every request from fixtures inside the browser, so the
 *   Network tab is **empty** — which reads as "the app is making no requests"
 *   rather than "there are no requests to make" — and signs a lessor in on
 *   load, so `/admin/login` bounces off the guard to the portal and the tokens
 *   appear to write themselves.
 * - `npm run start:api` talks to the real server and does neither.
 *
 * Both behaviours are deliberate. Being unable to tell them apart was not.
 */
export function logStartupMode(): void {
  const log = inject(LoggerService);

  log.info(`${environment.appName} ${environment.version}`);

  if (!environment.useMockApi) {
    log.info(`متّصل بالسيرفر: ${environment.apiUrl}`);
    log.info('تأكّد أن ‎/health‎ يردّ 200 قبل تتبّع أي خطأ في الواجهة.');
    return;
  }

  log.warn('البيانات من الفيكسترز — لا يوجد اتصال بأي سيرفر.');
  log.warn('تبويب Network سيبدو فارغًا. هذا متوقّع، وليس عطلًا.');

  if (environment.seedSession) {
    log.warn('تم تسجيل دخول مؤجّر تلقائيًا، لذلك تنتقل صفحات الدخول إلى البوابة.');
  }

  log.warn('للعمل على السيرفر الحقيقي: امسح بيانات الموقع ثم شغّل npm run start:api');
}

/**
 * Throws away a session left behind by the fixtures.
 *
 * Switching from `npm start` to `npm run start:api` leaves the seeded token in
 * this browser's storage, and the application has no reason to doubt it: it
 * looks signed in, sends `Bearer dev-mock-token` to the real server, gets a
 * 401, spends the equally fake refresh token, gets another, and only then signs
 * out. It recovers — but it recovers by looking broken first, and the person
 * watching has no way to know the cause is a token from a different mode.
 *
 * A mock token against a real server is never valid, so it is dropped before
 * the first request rather than after two failed ones.
 */
export function dropStaleMockSession(): void {
  if (environment.useMockApi) return;

  const storage = inject(StorageService);
  const token = storage.get<string>(STORAGE_KEYS.accessToken);
  if (!token || !MOCK_TOKENS.includes(token)) return;

  inject(LoggerService).warn('تم مسح جلسة الديمو المتبقية في المتصفح. سجّل الدخول من جديد.');

  storage.remove(STORAGE_KEYS.accessToken);
  storage.remove(STORAGE_KEYS.refreshToken);
  storage.remove(STORAGE_KEYS.user);
}
