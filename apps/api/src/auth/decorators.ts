import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@sig/shared';
import type { AuthUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Lewati autentikasi untuk route ini. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Batasi route ke role tertentu, mis. @Roles('admin'). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Ambil user yang sedang login dari request. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
