import { hasPermission, type Permission, type UserRole } from '@rentmobile/shared';

export function canAccess(permission: Permission, roles: UserRole[] = []): boolean {
  return roles.some((role) => hasPermission(role, permission));
}

export function canAccessOwnerTools(roles: UserRole[] = []): boolean {
  return canAccess('MANAGE_PROPERTIES', roles) || canAccess('MANAGE_ORGANIZATION', roles);
}
