import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Database, users } from '@sig/db';
import type { CreateUserInput, UpdateUserInput } from '@sig/shared';
import { hash } from 'bcryptjs';
import { desc, eq } from 'drizzle-orm';
import { DB } from '../db/db.module';

const SALT_ROUNDS = 12;

// kolom publik — password_hash tidak pernah ikut di-select
export const publicColumns = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

function isUniqueViolation(err: any) {
  return err?.cause?.code === '23505' || err?.code === '23505';
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  findAll() {
    return this.db.select(publicColumns).from(users).orderBy(desc(users.createdAt));
  }

  async findOne(id: string) {
    const [row] = await this.db.select(publicColumns).from(users).where(eq(users.id, id));
    if (!row) throw new NotFoundException('User tidak ditemukan');
    return row;
  }

  async create({ password, ...input }: CreateUserInput) {
    try {
      const [row] = await this.db
        .insert(users)
        .values({ ...input, passwordHash: await hash(password, SALT_ROUNDS) })
        .returning(publicColumns);
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Email sudah terdaftar');
      throw err;
    }
  }

  async update(id: string, { password, ...input }: UpdateUserInput, actorId: string) {
    // admin tidak boleh mengunci dirinya sendiri keluar
    if (id === actorId) {
      if (input.isActive === false) throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
      if (input.role && input.role !== 'admin') throw new BadRequestException('Anda tidak dapat menurunkan role akun sendiri');
    }
    try {
      const [row] = await this.db
        .update(users)
        .set({ ...input, ...(password && { passwordHash: await hash(password, SALT_ROUNDS) }) })
        .where(eq(users.id, id))
        .returning(publicColumns);
      if (!row) throw new NotFoundException('User tidak ditemukan');
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Email sudah terdaftar');
      throw err;
    }
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Anda tidak dapat menghapus akun sendiri');
    const [row] = await this.db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!row) throw new NotFoundException('User tidak ditemukan');
    return { id: row.id, deleted: true };
  }
}
