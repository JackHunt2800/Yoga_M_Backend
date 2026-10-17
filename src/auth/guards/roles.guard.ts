import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';
import { UserProfile } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified on this route, grant access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserProfile | undefined;

    if (!user) {
      this.logger.warn('RolesGuard evaluated without authenticated user on request');
      throw new UnauthorizedException('Authentication required before role verification');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      this.logger.warn(
        `User ${user.email || user.uid} with role '${user.role}' denied access. Required: [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Access denied: Action requires one of the following roles: [${requiredRoles.join(', ')}]. Current role: '${user.role || 'none'}'.`,
      );
    }

    return true;
  }
}
