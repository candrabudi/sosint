import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@sig/shared';
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, Globe, Loader2, Lock, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Checkbox, Label } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { CountUp } from '../components/motion';
import { Tip } from '../components/ui/tooltip';
import { useLogin } from '../lib/auth';
import { trends } from '../data';

const chartData = trends.traffic.slice(30).map((v, i) => ({ i, v: v + 12, r: trends.roi[i + 30] + 10 }));

function Field({
  id, label, icon, error, children, right,
}: { id: string; label: string; icon: ReactNode; error?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div>
      <Label.Root htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-ink">
        {label}
      </Label.Root>
      <div
        className={`group flex items-center gap-2.5 rounded-xl border bg-card px-3.5 transition-[border-color,box-shadow] focus-within:ring-4 ${
          error
            ? 'border-accent focus-within:ring-accent/15'
            : 'border-line hover:border-ink-3/50 focus-within:border-ink-3 focus-within:ring-ink/5'
        }`}
      >
        <span className={`transition-colors ${error ? 'text-accent' : 'text-ink-3 group-focus-within:text-ink'}`}>{icon}</span>
        {children}
        {right}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 text-[13px] text-accent"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatCard({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { delay, duration: 0.6 },
        y: { delay, duration: 6, repeat: Infinity, ease: 'easeInOut' },
      }}
      className={`absolute rounded-2xl bg-card/95 p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function LoginPage({ dark, onTheme }: { dark: boolean; onTheme: (d: boolean) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register, control, handleSubmit, formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => {
        const from = (location.state as { from?: string } | null)?.from ?? '/';
        navigate(from, { replace: true });
      },
    }),
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ---------- Form ---------- */}
      <div className="relative flex w-full flex-col px-6 py-6 sm:px-10 lg:w-[520px] lg:shrink-0 xl:w-[580px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-sm">
              <Globe size={26} strokeWidth={1.6} />
            </div>
            <span className="text-[15px] font-semibold tracking-wide">SOSINTELEGENT</span>
          </div>
          <Tip label={dark ? 'Mode terang' : 'Mode gelap'}>
            <button
              onClick={() => onTheme(!dark)}
              className="rounded-full bg-card p-2.5 text-ink-2 shadow-sm transition-colors hover:text-ink"
              aria-label="Ganti tema"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </Tip>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto my-auto w-full max-w-[400px] py-10"
        >
          <h1 className="text-[30px] font-medium leading-tight tracking-tight">Selamat datang kembali</h1>
          <p className="mt-2 text-[15px] text-ink-2">Masuk untuk memantau performa konten dan akun Anda secara realtime.</p>

          <AnimatePresence>
            {login.error && (
              <motion.div
                key={login.error.message}
                role="alert"
                initial={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 24, x: [0, -6, 6, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-3 text-[14px] text-accent"
              >
                <CircleAlert size={18} className="mt-px shrink-0" />
                <span>{login.error.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
            <Field id="email" label="Email" icon={<Mail size={18} />} error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="nama@perusahaan.com"
                aria-invalid={!!errors.email}
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
                {...register('email')}
              />
            </Field>

            <Field
              id="password"
              label="Password"
              icon={<Lock size={18} />}
              error={errors.password?.message}
              right={
                <Tip label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="rounded-md p-1 text-ink-3 transition-colors hover:text-ink"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </Tip>
              }
            >
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
                {...register('password')}
              />
            </Field>

            <div className="flex items-center justify-between pt-1">
              <Controller
                control={control}
                name="rememberMe"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox.Root
                      id="rememberMe"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-[5px] border border-line bg-card transition-colors hover:border-ink-3 data-[state=checked]:border-ink data-[state=checked]:bg-ink"
                    >
                      <Checkbox.Indicator asChild>
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={13} strokeWidth={3} className="text-canvas" />
                        </motion.span>
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <Label.Root htmlFor="rememberMe" className="select-none text-[14px] text-ink-2">
                      Ingat saya selama 30 hari
                    </Label.Root>
                  </div>
                )}
              />
              <Tip label="Hubungi administrator untuk reset password" side="top">
                <button type="button" className="text-[14px] font-medium text-ink underline-offset-4 hover:underline">
                  Lupa password?
                </button>
              </Tip>
            </div>

            <motion.button
              type="submit"
              disabled={login.isPending}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className="group mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
            >
              {login.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  Masuk <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-ink-3">
            <ShieldCheck size={14} /> Koneksi aman · sesi dilindungi cookie httpOnly
          </div>
        </motion.div>

        <p className="text-center text-[12px] text-ink-3 lg:text-left">© {new Date().getFullYear()} SOSINTELEGENT. All rights reserved.</p>
      </div>

      {/* ---------- Visual ---------- */}
      <div className="hidden flex-1 p-4 lg:block">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-full overflow-hidden rounded-[32px] bg-shell"
        >
          <div className="absolute inset-x-0 bottom-0 h-[62%]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g-traffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-roi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area dataKey="r" type="monotone" stroke="var(--blue)" strokeWidth={2} fill="url(#g-roi)"
                  animationDuration={1800} animationBegin={500} />
                <Area dataKey="v" type="monotone" stroke="var(--accent)" strokeWidth={2.4} fill="url(#g-traffic)"
                  animationDuration={1800} animationBegin={300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="relative max-w-[520px] p-12 xl:p-14">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[13px] shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pos opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pos" />
              </span>
              Realtime social intelligence
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-6 text-[40px] font-medium leading-[1.1] tracking-tight xl:text-[46px]"
            >
              Semua performa akun & konten, dalam satu layar.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-4 text-[16px] text-ink-2"
            >
              Pantau traffic, engagement, dan kualitas lead dari Instagram, X, dan sumber lainnya tanpa berpindah tab.
            </motion.p>
          </div>

          <FloatCard delay={0.9} className="right-12 top-[34%] w-[220px]">
            <div className="text-[13px] text-ink-2">Followers</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[24px] font-medium tracking-tight"><CountUp value="135,145" duration={1.8} /></span>
              <span className="text-[13px] text-pos">+16</span>
            </div>
          </FloatCard>

          <FloatCard delay={1.2} className="right-[290px] top-[50%] w-[200px]">
            <div className="text-[13px] text-ink-2">Engagement Rate</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-[24px] font-medium tracking-tight"><CountUp value="15.8%" duration={1.8} /></span>
              <span className="text-[13px] text-pos">+82%</span>
            </div>
          </FloatCard>

          <FloatCard delay={1.5} className="bottom-10 left-12 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-good-soft text-good">
              <ShieldCheck size={18} />
            </span>
            <div>
              <div className="text-[14px] font-medium">Data tersinkron</div>
              <div className="text-[12px] text-ink-3">Google Analytics · Meta · X</div>
            </div>
          </FloatCard>
        </motion.div>
      </div>
    </div>
  );
}
