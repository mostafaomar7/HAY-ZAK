import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api/v1',
  appName: 'HAY-ZAK (Dev)',
  version: '1.0.0-dev',
  defaultLang: 'ar',
  enableLogging: true,
  tokenKey: 'hayzaq_token',
  pageSize: 10,
  // The fixtures — `npm run start:mock`, and no longer what a bare `ng serve`
  // gives you. It used to be, and that was a trap: the obvious command answered
  // every request from inside the browser, so wiring a real endpoint changed
  // nothing on screen and the Network tab stayed empty.
  //
  // This configuration also backs `ng test`, which is why it still exists and
  // why it must keep pointing at fixtures: a suite that depended on a machine
  // on the LAN being up would fail for reasons that are not the code's.
  useMockApi: true,
  seedSession: true,
};
