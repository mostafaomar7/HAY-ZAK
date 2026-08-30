import type { Environment } from './environment.model';

/**
 * Development against the real backend — **the default `ng serve`**.
 *
 * `npm start`, `npm run start:api` and a bare `ng serve` all land here. It is
 * the default because the alternative was: the obvious command served fixtures,
 * and somebody could wire an endpoint, reload, and see nothing change.
 *
 * Separate from `environment.development.ts` because that one also backs
 * `ng test`: a suite that pointed at a machine on the LAN would fail whenever
 * that machine was off, for reasons that are not the code's.
 *
 * The host is a colleague's laptop, so it changes. It is the only line here
 * anybody should need to edit — check `http://<host>/health` answers 200 before
 * debugging anything in the client.
 */
export const environment: Environment = {
  production: false,
  apiUrl: 'http://192.168.1.17:4000/api/v1',
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
