import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Console logging that stays silent in production. Swap the bodies for a
 * remote sink (Sentry, App Insights) without touching call sites.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  info(message: string, ...args: unknown[]): void {
    if (environment.enableLogging) console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (environment.enableLogging) console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    // Errors are always reported — production sends them onward instead.
    console.error(`[ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (environment.enableLogging) console.debug(`[DEBUG] ${message}`, ...args);
  }
}
