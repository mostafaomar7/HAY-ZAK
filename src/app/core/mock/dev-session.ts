import { inject } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { MOCK_LESSOR } from './lessor.fixtures';

/**
 * Marks that this browser has already been given its one free session.
 *
 * Not in `STORAGE_KEYS`: that file is the application's vocabulary, and this
 * key exists only while `useMockApi` does.
 */
const SEEDED_KEY = 'hayzaq.dev.seeded';

/**
 * Signs a lessor in the first time this browser opens the app, so the portal
 * can be walked before anyone has typed a password.
 *
 * **Once, and only once.** An initializer that re-seeds whenever no token is
 * present makes signing out impossible: the next reload hands the session
 * straight back, and every login screen bounces off `guestGuard` to the portal
 * it just restored. So the marker survives `clearSession()` and the seed does
 * not fire again — sign out, and you stay out.
 *
 * Clearing site data in the browser removes the marker too, which makes "clear
 * storage, reload" the reset button back to a fresh lessor session.
 *
 * There is nothing special about the account it picks: `accounts.ts` holds one
 * for every role, all reachable at `/auth/login` and `/admin/login` with any
 * password. See `docs/demo-accounts.md`.
 */
export function seedDevSession(): void {
  const storage = inject(StorageService);
  const auth = inject(AuthService);

  if (storage.get<string>(STORAGE_KEYS.accessToken)) return;
  if (storage.get<boolean>(SEEDED_KEY)) return;

  storage.set(SEEDED_KEY, true);

  // One role, like every other account: the product allows exactly one
  // (FR-AUTH-12), and a seeded user holding two used to make the storefront
  // look like a renter session and the portal like a lessor one — the same
  // person, two portals, and no way to tell which account you were.
  auth.setSession({
    user: MOCK_LESSOR,
    tokens: {
      accessToken: 'dev-mock-token',
      refreshToken: 'dev-mock-refresh',
      expiresIn: 1800,
      tokenType: 'Bearer',
    },
  });
}
