import { inject } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { MOCK_LESSOR } from './lessor.fixtures';

/**
 * Signs a mock user in when `useMockApi` is set, so the guards on the lessor and
 * renter routes resolve and the screens can be opened directly.
 *
 * The seeded account carries both roles, which the product itself does not allow
 * (FR-AUTH-12 is one role per account in Phase 1). That is deliberate and local
 * to this file: it lets one development session walk both portals without
 * logging out, and nothing else in the application creates such a user. The
 * guards still enforce the real rule against whatever the API returns.
 *
 * Development only, and it never overwrites a real session — if a token is
 * already stored it leaves it alone.
 */
export function seedDevSession(): void {
  const storage = inject(StorageService);
  const auth = inject(AuthService);

  if (storage.get<string>(STORAGE_KEYS.accessToken)) return;

  auth.setSession({
    accessToken: 'dev-mock-token',
    user: { ...MOCK_LESSOR, roles: [UserRole.Lessor, UserRole.Renter] },
  });
}
