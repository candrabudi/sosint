# SIG Analytics

Monorepo pnpm + Turborepo.

| Path | Isi |
|---|---|
| `apps/api` | NestJS API (`http://localhost:3000/api`) |
| `apps/panel` | React + Vite + Tailwind + TanStack Query (`http://localhost:5173`) |
| `packages/db` | Drizzle ORM schema, client, migrations (PostgreSQL) |
| `packages/shared` | Zod schema & types yang dipakai API dan panel |

## Mulai

```bash
pnpm install
cp .env.example .env      # isi DATABASE_URL, JWT_SECRET, SEED_ADMIN_*
pnpm db:setup             # migrate + seed admin (PostgreSQL lokal)
pnpm dev                  # jalankan api + panel
```

## Database

- Ubah schema di `packages/db/src/schema.ts`
- `pnpm db:generate` buat file migration baru
- `pnpm db:migrate` apply ke database
- `pnpm db:studio` buka Drizzle Studio
- `pnpm db:seed` buat akun admin dari `SEED_ADMIN_*` (`pnpm --filter @sig/db seed -- --reset` untuk reset password)

## Auth

- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- JWT disimpan di cookie httpOnly `access_token`.
- Semua route wajib login kecuali yang diberi `@Public()`; batasi role dengan `@Roles('admin')`.
- Login dibatasi 5 percobaan / menit / IP.

Catatan: setelah mengubah `packages/shared` atau `packages/db`, restart `pnpm dev` (API memakai hasil build `dist`). Panel membaca source `shared` langsung.
