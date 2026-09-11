import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@pos/shared';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
