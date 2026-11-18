import type { UserRole } from '@sig/shared';

export const ACCESS_TOKEN_COOKIE = 'access_token';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
