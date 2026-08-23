import type { Environment } from './environment.model';

/**
 * The build that goes on a demo host before a backend exists.
 *
 * Optimised exactly like production — same budgets, same hashed filenames — but
 * served from the fixtures, because `apiUrl` points at a host that has not been
 * built yet. A production build uploaded to a demo domain looks broken in a way
 * that reads as *our* fault: every list fails to load, every sign-in is refused,
 * and the pages that need content show "الصفحة غير متاحة".
 *
 * `npm run build:demo`. Never deploy this to the real domain: `useMockApi`
 * makes the app answer itself, so nothing a client types is ever saved.
 */
export const environment: Environment = {
  production: true,
  // Not reached — the interceptor answers before the request leaves. It is
  // still the real one, so switching useMockApi to false is the only edit
  // needed to point a demo host at a live backend.
  apiUrl: 'https://api.hayzak.sa/api',
  appName: 'HAY-ZAK (Demo)',
  version: '1.0.0-demo',
  defaultLang: 'ar',
  enableLogging: false,
  tokenKey: 'hayzaq_token',
  pageSize: 10,
  useMockApi: true,
};
