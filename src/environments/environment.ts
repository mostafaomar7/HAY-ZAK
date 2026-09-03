import type { Environment } from './environment.model';

/**
 * **The address is a `sslip.io` name on purpose, and it is not interchangeable
 * with the IP it resolves to.**
 *
 * The server is `179.198.199.243`. Its Let's Encrypt certificate covers
 * `179-198-199-243.sslip.io` and carries no IP SAN, so `https://179.198.199.243`
 * fails verification in every browser — `ERR_CERT_COMMON_NAME_INVALID`, refused
 * before a single request is sent, which renders as an application where every
 * screen is empty and nothing in it is at fault. `sslip.io` resolves the name
 * back to that same IP, so this is the identical server reached by the one name
 * its certificate actually vouches for.
 *
 * Dropping to `http://179.198.199.243` would work today and must not be done: a
 * client served over https cannot call http at all — the browser blocks mixed
 * content before the request leaves and reports it only in the console — and
 * the token and the password would travel in the clear.
 *
 * This becomes `https://api.hayzak.sa/api/v1` the day that domain has a
 * certificate, and nothing else here changes.
 */
export const environment: Environment = {
  production: true,
  apiUrl: 'https://179-198-199-243.sslip.io/api/v1',
  appName: 'HAY-ZAK',
  version: '1.0.0',
  defaultLang: 'ar',
  enableLogging: false,
  tokenKey: 'hayzaq_token',
  pageSize: 10,
  useMockApi: false,
  seedSession: false,
};
