import type { Environment } from './environment.model';

/**
 * Development against the real backend — **the default `ng serve`**.
 *
 * `npm start`, `npm run start:api` and a bare `ng serve` all land here. It is
 * the default because the alternative was: the obvious command served fixtures,
 * and somebody could wire an endpoint, reload, and see nothing change.
 *
 * Separate from `environment.development.ts` because that one also backs
 * `ng test`: a suite pointed at a server that is sometimes off would fail for
 * reasons that are not the code's.
 *
 * Same address as production — see `environment.ts` for why it is a
 * `sslip.io` name and not the bare IP. Check
 * `https://179-198-199-243.sslip.io/health` answers 200 before debugging
 * anything in the client.
 *
 * One thing that follows from the origin and fails quietly: `fileUrl()` builds
 * `/uploads/…` off it rather than off `/api/v1`, so unit photos and complaint
 * attachments are served by this host too. If that path stops being proxied,
 * every image in the product breaks in a way that reads as an upload fault.
 */
export const environment: Environment = {
  production: false,
  apiUrl: 'https://179-198-199-243.sslip.io/api/v1',
  appName: 'HAY-ZAK (API)',
  version: '1.0.0-api',
  defaultLang: 'ar',
  enableLogging: true,
  tokenKey: 'hayzaq_token',
  pageSize: 12,

  // The whole point of this configuration.
  useMockApi: false,
  // Nothing to seed against a real server, and a seeded session would only get
  // in the way of the login screen. Sign in with one of the seeded accounts —
  // see docs/api/backend-notes.md.
  seedSession: false,
};
