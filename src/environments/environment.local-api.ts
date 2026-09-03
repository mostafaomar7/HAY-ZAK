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
 * The host used to be a colleague's laptop on the LAN and is now a public one,
 * so it stops changing every morning — but it is still the only line here
 * anybody should need to edit. Check `http://<host>/api/v1/reference/cities`
 * answers 200 before debugging anything in the client.
 *
 * Two things follow from the origin being `http://179.198.199.243` rather than
 * `localhost`, and both bite silently:
 *
 * - `fileUrl()` builds `/uploads/…` off this origin, so unit photos and
 *   complaint attachments are served by that host too, not by the API port.
 * - It is **http**. A client served over https cannot call it at all — the
 *   browser blocks mixed content before the request leaves, and the console
 *   says so where nobody is looking. Serve the dev client over http.
 */
export const environment: Environment = {
  production: false,
  apiUrl: 'http://179.198.199.243/api/v1',
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
