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
  /**
   * Signs a mock account in on first load so a developer can open a guarded
   * route without going through a login screen.
   *
   * Separate from `useMockApi`, and false wherever anyone but a developer will
   * see the app. A hosted demo that seeds a session hands its first visitor
   * somebody else's portal and bounces them off every login screen they try —
   * the session is already live, so `guestGuard` sends them back to it.
   */
  seedSession: boolean;
}
