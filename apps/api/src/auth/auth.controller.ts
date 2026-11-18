import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { type LoginPayload, loginSchema } from '@sig/shared';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE, type AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // maks 5 percobaan login / menit / IP
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user, maxAgeMs } = await this.auth.login(body);
    // tanpa "remember me" → session cookie (hilang saat browser ditutup)
    res.cookie(ACCESS_TOKEN_COOKIE, token, { ...this.cookieOptions(), ...(maxAgeMs && { maxAge: maxAgeMs }) });
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
