import { Injectable, computed, inject } from '@angular/core';
import type { Permission } from '../constants/permissions';
import { IMPLIED_BY, ROLE_PERMISSIONS, WIRE_PERMISSIONS } from '../constants/permissions';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from './auth.service';

/**
 * What the current user may do — the one place the two sources of that answer
 * are joined.
 *
 * The server issues administration capabilities per user in `user.permissions`;
 * the role implies the renter's and the lessor's. Read this instead of checking
 * `role` or `adminRole` inline: gating on a permission is what lets the backend
 * add a fourth kind of administrator without a client release.
 *
 * None of it is enforcement. The API refuses the request on its own — a
 * finance officer calling `POST /admin/units/:id/approve` straight from curl
 * gets a 403 — and the job here is only to not offer a control that would be
 * refused. A hidden button is not access control.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly permissions = computed<ReadonlySet<Permission>>(() => {
    const role = this.auth.role();
    const granted = new Set<Permission>(ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS[UserRole.Guest]);

    // Unknown strings are skipped rather than trusted: the server is free to
    // add a permission before this client learns the name, and a value nothing
    // checks would grant nothing anyway.
    for (const issued of this.auth.user()?.permissions ?? []) {
      if (WIRE_PERMISSIONS.has(issued)) granted.add(issued as Permission);
    }

    for (const held of [...granted]) {
      for (const implied of IMPLIED_BY[held] ?? []) granted.add(implied);
    }

    return granted;
  });

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  canAny(permissions: Permission[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  canAll(permissions: Permission[]): boolean {
    return permissions.every((permission) => this.can(permission));
  }
}
