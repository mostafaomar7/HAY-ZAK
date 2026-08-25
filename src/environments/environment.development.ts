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
  // The fixtures. `npm run start:api` is the configuration that talks to the
  // real server — this one also backs `ng test`, and a suite that depended on a
  // machine on the LAN being up would fail for reasons that are not the code's.
  useMockApi: true,
  seedSession: true,
};
