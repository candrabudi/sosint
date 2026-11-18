import { zodResolver } from '@hookform/resolvers/zod';
import { USER_ROLES, type User, type UserRole } from '@sig/shared';
import { Eye, EyeOff, KeyRound, Loader2, Shield, UserRound, Wand2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Label, ToggleGroup } from 'radix-ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/api';
import { useCreateUser, useUpdateUser } from '../../lib/users';
import { Modal } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Tip } from '../ui/tooltip';

function buildSchema(mode: 'create' | 'edit') {
  return z.object({
    fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(150, 'Maksimal 150 karakter'),
    email: z.email('Format email tidak valid'),
    // saat edit, password boleh kosong = tidak diubah
    password:
      mode === 'create'
        ? z.string().min(8, 'Minimal 8 karakter').max(72, 'Maksimal 72 karakter')
        : z.union([z.literal(''), z.string().min(8, 'Minimal 8 karakter').max(72, 'Maksimal 72 karakter')]),
    role: z.enum(USER_ROLES),
    isActive: z.boolean(),
  });
}
type FormValues = z.infer<ReturnType<typeof buildSchema>>;

const roleMeta: Record<UserRole, { label: string; desc: string; icon: ReactNode }> = {
  admin: { label: 'Admin', desc: 'Akses penuh termasuk kelola user', icon: <Shield size={16} /> },
  user: { label: 'User', desc: 'Akses dashboard & laporan', icon: <UserRound size={16} /> },
};

function generatePassword(len = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const arr = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}

const inputCls = (err?: boolean) =>
  `h-11 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:ring-4 ${
    err ? 'border-accent focus:ring-accent/15' : 'border-line hover:border-ink-3/50 focus:border-ink-3 focus:ring-ink/5'
  }`;

function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence initial={false}>
      {msg && (
        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="mt-1.5 text-[13px] text-accent">
          {msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function UserFormDialog({
  open, onOpenChange, user, isSelf,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** user yang diedit; kosong = mode tambah */
  user?: User | null;
  isSelf?: boolean;
}) {
  const mode = user ? 'edit' : 'create';
  const create = useCreateUser();
  const update = useUpdateUser();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, reset, setValue, setError, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(mode)),
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setShowPw(false);
    reset(
      user
        ? { fullName: user.fullName, email: user.email, password: '', role: user.role, isActive: user.isActive }
        : { fullName: '', email: '', password: '', role: 'user', isActive: true },
    );
  }, [open, user, reset]);

  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit(async ({ password, ...values }) => {
    setServerError(null);
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, ...values, ...(password ? { password } : {}) });
      } else {
        await create.mutateAsync({ ...values, password });
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('email', { message: err.message });
      else setServerError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={mode === 'create' ? 'Tambah user baru' : 'Edit user'}
      description={mode === 'create' ? 'Buat akun untuk anggota tim Anda.' : `Perbarui data ${user?.fullName}.`}
      className="max-w-[520px]"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <AnimatePresence>
          {serverError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              role="alert" className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-[14px] text-accent">
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <Label.Root htmlFor="fullName" className="mb-1.5 block text-[14px] font-medium">Nama lengkap</Label.Root>
          <input id="fullName" autoFocus placeholder="mis. Budi Santoso" className={inputCls(!!errors.fullName)} {...register('fullName')} />
          <FieldError msg={errors.fullName?.message} />
        </div>

        <div>
          <Label.Root htmlFor="email" className="mb-1.5 block text-[14px] font-medium">Email</Label.Root>
          <input id="email" type="email" autoComplete="off" placeholder="nama@perusahaan.com" className={inputCls(!!errors.email)} {...register('email')} />
          <FieldError msg={errors.email?.message} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label.Root htmlFor="password" className="text-[14px] font-medium">
              {mode === 'create' ? 'Password' : 'Password baru'}
              {mode === 'edit' && <span className="ml-1.5 font-normal text-ink-3">(kosongkan jika tidak diubah)</span>}
            </Label.Root>
            <button
              type="button"
              onClick={() => {
                setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true });
                setShowPw(true);
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] text-ink-2 transition-colors hover:bg-shell hover:text-ink"
            >
              <Wand2 size={13} /> Generate
            </button>
          </div>
          <div className="relative">
            <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={mode === 'create' ? 'Minimal 8 karakter' : '••••••••'}
              className={`${inputCls(!!errors.password)} pl-10 pr-11 font-mono`}
              {...register('password')}
            />
            <Tip label={showPw ? 'Sembunyikan' : 'Tampilkan'}>
              <button type="button" onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 transition-colors hover:text-ink">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Tip>
          </div>
          <FieldError msg={errors.password?.message} />
        </div>

        <div>
          <span className="mb-1.5 block text-[14px] font-medium">Role</span>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <ToggleGroup.Root
                type="single"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                disabled={isSelf}
                className="grid grid-cols-2 gap-2"
                aria-label="Role"
              >
                {USER_ROLES.map((r) => (
                  <ToggleGroup.Item
                    key={r}
                    value={r}
                    className="flex items-start gap-2.5 rounded-xl border border-line bg-card p-3 text-left transition-colors hover:border-ink-3/50 disabled:cursor-not-allowed disabled:opacity-60 data-[state=on]:border-ink data-[state=on]:bg-shell"
                  >
                    <span className="mt-0.5 text-ink-2">{roleMeta[r].icon}</span>
                    <span>
                      <span className="block text-[14px] font-medium">{roleMeta[r].label}</span>
                      <span className="block text-[12px] leading-snug text-ink-3">{roleMeta[r].desc}</span>
                    </span>
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            )}
          />
          {isSelf && <p className="mt-1.5 text-[12px] text-ink-3">Role akun sendiri tidak dapat diubah.</p>}
        </div>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
              <Label.Root htmlFor="isActive" className="cursor-pointer">
                <span className="block text-[14px] font-medium">Akun aktif</span>
                <span className="block text-[12px] text-ink-3">
                  {isSelf ? 'Akun sendiri tidak dapat dinonaktifkan.' : 'User nonaktif tidak dapat login.'}
                </span>
              </Label.Root>
              <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} label="Akun aktif" />
            </div>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => onOpenChange(false)} disabled={pending}
            className="rounded-xl border border-line px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
            Batal
          </button>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            disabled={pending || (mode === 'edit' && !isDirty)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            {mode === 'create' ? 'Tambah user' : 'Simpan perubahan'}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
