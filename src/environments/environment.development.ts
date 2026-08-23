import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  appName: 'HAY-ZAK (Dev)',
  version: '1.0.0-dev',
  defaultLang: 'ar',
  enableLogging: true,
  tokenKey: 'hayzaq_token',
  pageSize: 10,
  useMockApi: true,
  seedSession: true,
};
