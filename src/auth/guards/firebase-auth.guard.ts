import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService, UserProfile } from '../auth.service';

export interface AuthenticatedRequest extends Request {
  user: UserProfile;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly authService: AuthService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined =
      request.headers['authorization'] || request.headers['Authorization'];
    const queryToken: string | undefined = request.query?.token as string;
    const bodyToken: string | undefined = request.body?.token as string;

    const tokenOrHeader = authHeader || queryToken || bodyToken;

    if (!tokenOrHeader || tokenOrHeader.trim() === '') {
      throw new UnauthorizedException(
        'Authentication required: Bearer token or authorization header missing',
      );
    }

    try {
      const user = await this.authService.resolveSession(tokenOrHeader);
      if (!user) {
        throw new UnauthorizedException('Authentication failed: user session could not be resolved');
      }

      // Attach resolved user session to the request object
      request.user = user;
      return true;
    } catch (error: any) {
      this.logger.warn(`FirebaseAuthGuard rejected request: ${error.message}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(error.message || 'Invalid or expired authentication token');
    }
  }
}
