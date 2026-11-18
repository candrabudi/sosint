import { ForbiddenException, Inject, Injectable, type OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Database, users } from '@sig/db';
import type { LoginPayload } from '@sig/shared';
import { compare, hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module';
import type { JwtPayload } from './auth.types';

@Injectable()
export class AuthService implements OnModuleInit {
  // hash dummy agar waktu respon sama saat email tidak ditemukan (cegah user enumeration)
  private dummyHash = '';

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await hash('timing-safe-dummy-password', 12);
  }

  async login({ email, password, rememberMe }: LoginPayload) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    const valid = await compare(password, user?.passwordHash ?? this.dummyHash);

    if (!user || !valid) throw new UnauthorizedException('Email atau password salah');
    if (!user.isActive) throw new ForbiddenException('Akun Anda dinonaktifkan. Hubungi administrator.');

    const expiresIn = this.config.get<string>(rememberMe ? 'JWT_REMEMBER_EXPIRES_IN' : 'JWT_EXPIRES_IN') ?? '1d';
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const token = await this.jwt.signAsync(payload, { expiresIn: expiresIn as never });

    const { passwordHash: _omit, ...publicUser } = user;
    return { token, user: publicUser, maxAgeMs: rememberMe ? parseDuration(expiresIn) : undefined };
  }
}

/** "30d" / "12h" / "15m" / "60s" → milidetik */
function parseDuration(v: string): number {
  const m = /^(\d+)([smhd])$/.exec(v);
  if (!m) return 86_400_000;
  const unit = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * unit;
}
