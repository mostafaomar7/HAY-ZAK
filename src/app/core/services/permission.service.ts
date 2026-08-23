import { Injectable, computed, inject } from '@angular/core';
import type { Permission } from '../constants/permissions';
import { ROLE_PERMISSIONS } from '../constants/permissions';
import { UserRole } from '../enums/user-role.enum';
import { AuthService } from './auth.service';

/**
 * Resolves the current user's capabilities from SRS §5. Read this instead of
 * checking roles inline — when the matrix changes, only permissions.ts moves.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly permissions = computed<ReadonlySet<Permission>>(() => {
    const roles = this.auth.roles();
    const effective = roles.length ? roles : [UserRole.Guest];
    return new Set(effective.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
  });

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  canAny(permissions: Permission[]): boolean {
    return permissions.some((p) => this.can(p));
  }

  canAll(permissions: Permission[]): boolean {
    return permissions.every((p) => this.can(p));
  }
}
