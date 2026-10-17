import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type UserRole = 'admin' | 'teacher' | 'student';

/**
 * Decorator to assign required user roles to routes or controllers.
 * Example: @Roles('teacher')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
