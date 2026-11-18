import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { type Database, users } from '@sig/db';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DB } from '../db/db.module';
import { publicColumns } from '../users/users.service';
import { ACCESS_TOKEN_COOKIE, type JwtPayload } from './auth.types';
import { IS_PUBLIC_KEY } from './decorators';

/** Guard global: semua route butuh login kecuali yang diberi @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Silakan login terlebih dahulu');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesi berakhir, silakan login kembali');
    }

    // cek ulang ke DB supaya user yang dinonaktifkan/dihapus langsung kehilangan akses
    const [user] = await this.db.select(publicColumns).from(users).where(eq(users.id, payload.sub));
    if (!user || !user.isActive) throw new UnauthorizedException('Akun tidak tersedia atau dinonaktifkan');

    req.user = user;
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const fromCookie = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (fromCookie) return fromCookie;
    const [type, value] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? value : undefined;
  }
}
