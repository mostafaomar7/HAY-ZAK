/**
 * Contract every environment file must satisfy. Kept separate from
 * environment.ts because the build swaps that file out per configuration —
 * importing the type from it would create a self-import in development.
 */
export interface Environment {
  production: boolean;
  apiUrl: string;
  appName: string;
  version: string;
  defaultLang: 'ar' | 'en';
  enableLogging: boolean;
  tokenKey: string;
  pageSize: number;
  /**
   * Serves the lessor screens from local fixtures so the UI can be reviewed
   * before the backend exists. MUST stay false in production — the interceptor
   * that reads it is a development aid, not a feature.
   */
  useMockApi: boolean;
}
