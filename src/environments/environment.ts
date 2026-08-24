import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://api.hayzak.sa/api/v1',
  appName: 'HAY-ZAK',
  version: '1.0.0',
  defaultLang: 'ar',
  enableLogging: false,
  tokenKey: 'hayzaq_token',
  pageSize: 10,
  useMockApi: false,
  seedSession: false,
};
