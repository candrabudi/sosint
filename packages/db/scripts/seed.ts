/**
 * Seed akun admin pertama.
 *   pnpm db:seed            → buat admin jika belum ada
 *   pnpm db:seed --reset    → reset password admin yang sudah ada ke nilai di .env
 */
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { createDb, users } from '../src';

config({ path: '../../.env' });

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (lihat .env.example)`);
  return v;
}

async function main() {
  const fullName = env('SEED_ADMIN_FULL_NAME');
  const email = env('SEED_ADMIN_EMAIL').toLowerCase();
  const password = env('SEED_ADMIN_PASSWORD');
  const reset = process.argv.includes('--reset');

  if (password.length < 8) throw new Error('SEED_ADMIN_PASSWORD minimal 8 karakter');

  const { db, pool } = createDb(env('DATABASE_URL'));
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const passwordHash = await hash(password, 12);

    if (existing && !reset) {
      console.log(`✓ Admin ${email} sudah ada — dilewati (pakai --reset untuk reset password).`);
      return;
    }

    if (existing) {
      await db.update(users)
        .set({ passwordHash, role: 'admin', isActive: true })
        .where(eq(users.id, existing.id));
      console.log(`✓ Password admin ${email} di-reset.`);
      return;
    }

    await db.insert(users).values({ fullName, email, passwordHash, role: 'admin', isActive: true });
    console.log(`✓ Admin dibuat: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✗ Seed gagal:', err.message);
  process.exit(1);
});
