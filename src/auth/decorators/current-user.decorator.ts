import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserProfile } from '../auth.service';

/**
 * Custom parameter decorator to extract the authenticated user from the Request object.
 * Example:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: UserProfile)
 *   getUserId(@CurrentUser('uid') uid: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserProfile | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserProfile | undefined;

    return data ? user?.[data] : user;
  },
);
