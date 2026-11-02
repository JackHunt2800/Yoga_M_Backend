import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService, UserSession } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Verify Firebase token and return user session
   * Endpoint: POST /api/auth/verify
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body('token') token?: string,
    @Body('role') role?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<UserSession> {
    const rawToken = token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '');
    return this.authService.verifyFirebaseToken(rawToken, role);
  }
}
