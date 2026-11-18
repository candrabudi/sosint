import type { User, UserRole } from '@sig/shared';
import {
  type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel,
  type SortingState, useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, RotateCw, Search, Shield,
  Trash2, TriangleAlert, UserRound, Users as UsersIcon, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useMemo, useState } from 'react';
import { CountUp, FadeIn } from '../components/motion';
import { Confirm } from '../components/ui/dialog';
import { Menu, MoreMenu } from '../components/ui/dropdown';
import { Pagination } from '../components/ui/pagination';
import { Switch } from '../components/ui/switch';
import { Tip } from '../components/ui/tooltip';
import { UserFormDialog } from '../components/users/UserFormDialog';
import { initials, useMe } from '../lib/auth';
import { useDeleteUser, useUpdateUser, useUsers } from '../lib/users';

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'inactive';

const dateFmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

function relative(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]];
  let v = diff;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return '';
}

const avatarColors = ['#d4502e', '#7b9bd1', '#3f8f4e', '#b88a1c', '#8a5cc7', '#2f8fa3'];
function Avatar({ name }: { name: string }) {
  const c = avatarColors[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % avatarColors.length];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      style={{ background: `linear-gradient(140deg, ${c}, color-mix(in oklab, ${c} 60%, white))` }}>
      {initials(name)}
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-accent">
      <Shield size={11} /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-blue-soft px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-blue">
      <UserRound size={11} /> User
    </span>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div>
        <div className="text-[13px] text-ink-2">{label}</div>
        <div className="text-[22px] font-medium leading-tight tracking-tight"><CountUp value={String(value)} duration={0.8} /></div>
      </div>
    </motion.div>
  );
}

function FilterSelect<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  const current = options.find((o) => o.value === value)!;
  return (
    <Menu
      align="start"
      items={options.map((o) => ({ label: o.label, onSelect: () => onChange(o.value) }))}
      trigger={
        <button className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[14px] transition-colors hover:border-ink-3/50 ${
          value !== 'all' ? 'border-ink bg-shell text-ink' : 'border-line bg-card text-ink-2'
        }`}>
          <span className="text-ink-3">{label}:</span> {current.label}
        </button>
      }
    />
  );
}

export function UsersPage() {
  const { data: me } = useMe();
  const { data: users = [], isLoading, isError, error, refetch, isFetching } = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
  }), [users]);

  const filtered = useMemo(() => users.filter((u) =>
    (role === 'all' || u.role === role) &&
    (status === 'all' || (status === 'active' ? u.isActive : !u.isActive)),
  ), [users, role, status]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setFormOpen(true); };

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      id: 'fullName',
      accessorKey: 'fullName',
      header: 'User',
      cell: ({ row: { original: u } }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.fullName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-medium">
              {u.fullName}
              {u.id === me?.id && <span className="rounded bg-shell px-1.5 py-px text-[11px] font-normal text-ink-2">Anda</span>}
            </div>
            <div className="truncate text-[13px] text-ink-3">{u.email}</div>
          </div>
        </div>
      ),
    },
    { accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <RoleBadge role={getValue<UserRole>()} /> },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row: { original: u } }) => {
        const self = u.id === me?.id;
        const sw = (
          <span className="inline-flex items-center gap-2.5">
            <Switch
              checked={u.isActive}
              disabled={self}
              label={u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              onCheckedChange={(v) => updateUser.mutate({ id: u.id, isActive: v })}
            />
            <span className={`text-[13px] ${u.isActive ? 'text-pos' : 'text-ink-3'}`}>{u.isActive ? 'Aktif' : 'Nonaktif'}</span>
          </span>
        );
        return self ? <Tip label="Akun sendiri tidak dapat dinonaktifkan">{sw}</Tip> : sw;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Dibuat',
      cell: ({ getValue }) => {
        const d = new Date(getValue<string>());
        return (
          <div className="leading-tight">
            <div>{dateFmt.format(d)}</div>
            <div className="text-[12px] text-ink-3">{timeFmt.format(d)} WIB</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Diperbarui',
      cell: ({ getValue }) => (
        <Tip label={`${dateFmt.format(new Date(getValue<string>()))}, ${timeFmt.format(new Date(getValue<string>()))} WIB`}>
          <span className="text-ink-2">{relative(getValue<string>())}</span>
        </Tip>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: u } }) => (
        <div className="flex justify-end gap-1">
          <Tip label="Edit user">
            <button onClick={() => openEdit(u)} aria-label="Edit"
              className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-shell hover:text-ink">
              <Pencil size={16} />
            </button>
          </Tip>
          <MoreMenu items={[
            { label: 'Edit user', icon: <Pencil size={14} />, onSelect: () => openEdit(u) },
            u.isActive
              ? { label: 'Nonaktifkan', icon: <X size={14} />, onSelect: () => u.id !== me?.id && updateUser.mutate({ id: u.id, isActive: false }) }
              : { label: 'Aktifkan', icon: <RotateCw size={14} />, onSelect: () => updateUser.mutate({ id: u.id, isActive: true }) },
            'separator',
            ...(u.id === me?.id ? [] : [{ label: 'Hapus user', icon: <Trash2 size={14} />, danger: true, onSelect: () => setToDelete(u) }]),
          ]} />
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [me?.id]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _id, q: string) => {
      const s = q.toLowerCase();
      return row.original.fullName.toLowerCase().includes(s) || row.original.email.includes(s);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const hasFilter = !!search || role !== 'all' || status !== 'all';

  const grid = 'grid grid-cols-[minmax(240px,2fr)_110px_160px_130px_120px_96px] items-center gap-4';

  return (
    <div className="mt-3 space-y-4">
      <FadeIn>
        <section className="rounded-3xl bg-shell p-5">
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-[22px] font-medium tracking-tight">Management Users</h2>
              <p className="mt-0.5 text-[14px] text-ink-2">Kelola akun, role, dan akses anggota tim.</p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_20px_-10px_var(--accent)] transition-[filter] hover:brightness-110"
            >
              <Plus size={18} /> Tambah user
            </motion.button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Total user" value={stats.total} icon={<UsersIcon size={18} />} tone="bg-shell text-ink" />
            <StatCard label="Admin" value={stats.admins} icon={<Shield size={18} />} tone="bg-accent-soft text-accent" />
            <StatCard label="Aktif" value={stats.active} icon={<span className="h-2.5 w-2.5 rounded-full bg-pos" />} tone="bg-good-soft" />
            <StatCard label="Nonaktif" value={stats.inactive} icon={<span className="h-2.5 w-2.5 rounded-full bg-ink-3" />} tone="bg-shell" />
          </div>
        </section>
      </FadeIn>

      <FadeIn delay={0.1}>
        <section className="rounded-3xl bg-card shadow-sm">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3 transition-[border-color,box-shadow] focus-within:border-ink-3 focus-within:ring-4 focus-within:ring-ink/5 sm:max-w-[340px]">
              <Search size={16} className="text-ink-3" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }}
                placeholder="Cari nama atau email..."
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-3"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Hapus pencarian" className="rounded p-0.5 text-ink-3 hover:text-ink">
                  <X size={14} />
                </button>
              )}
            </label>
            <FilterSelect label="Role" value={role} onChange={(v) => { setRole(v); table.setPageIndex(0); }}
              options={[{ value: 'all', label: 'Semua' }, { value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]} />
            <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); table.setPageIndex(0); }}
              options={[{ value: 'all', label: 'Semua' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />
            {hasFilter && (
              <button onClick={() => { setSearch(''); setRole('all'); setStatus('all'); }}
                className="h-10 rounded-xl px-3 text-[14px] text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                Reset filter
              </button>
            )}
            <Tip label="Muat ulang">
              <button onClick={() => refetch()} aria-label="Muat ulang"
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-shell hover:text-ink">
                <RotateCw size={16} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </Tip>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <div className="min-w-[920px] px-4">
              {table.getHeaderGroups().map((hg) => (
                <div key={hg.id} className={`${grid} px-2 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-3`}>
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return h.column.getCanSort() ? (
                      <button key={h.id} onClick={h.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 text-left uppercase transition-colors hover:text-ink">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' ? <ArrowUp size={12} /> : sorted === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}
                      </button>
                    ) : (
                      <span key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                    );
                  })}
                </div>
              ))}

              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`${grid} border-t border-line px-2 py-3.5`}>
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full bg-shell" />
                      <div className="space-y-1.5"><div className="h-3 w-32 rounded bg-shell" /><div className="h-2.5 w-44 rounded bg-shell" /></div>
                    </div>
                    {Array.from({ length: 4 }).map((__, j) => <div key={j} className="h-3 w-16 rounded bg-shell" />)}
                    <span />
                  </div>
                ))}

              {isError && (
                <div className="flex flex-col items-center gap-3 border-t border-line py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><TriangleAlert size={22} /></span>
                  <div>
                    <div className="font-medium">Gagal memuat data user</div>
                    <div className="text-[14px] text-ink-2">{error.message}</div>
                  </div>
                  <button onClick={() => refetch()} className="rounded-xl border border-line px-4 py-2 text-[14px] transition-colors hover:bg-shell">Coba lagi</button>
                </div>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-line py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shell text-ink-3"><Search size={20} /></span>
                  <div>
                    <div className="font-medium">{hasFilter ? 'Tidak ada user yang cocok' : 'Belum ada user'}</div>
                    <div className="text-[14px] text-ink-2">{hasFilter ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan user pertama Anda.'}</div>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {rows.map((row) => (
                  <motion.div
                    key={row.original.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: row.original.isActive ? 1 : 0.65, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25 }}
                    className={`${grid} rounded-xl border-t border-line px-2 py-3 text-[14px] transition-colors hover:bg-shell/60`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="min-w-0">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* pagination */}
          <Pagination page={pageIndex + 1} pageSize={pageSize} total={total} unit="user"
            onPageChange={(p) => table.setPageIndex(p - 1)}
            onPageSizeChange={(s) => { table.setPageSize(s); table.setPageIndex(0); }} />
        </section>
      </FadeIn>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} isSelf={editing?.id === me?.id} />

      <Confirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        icon={<Trash2 size={22} />}
        title="Hapus user ini?"
        description={<>Akun <b className="font-medium text-ink">{toDelete?.fullName}</b> ({toDelete?.email}) akan dihapus permanen dan tidak bisa dikembalikan.</>}
        confirmLabel="Hapus user"
        loading={deleteUser.isPending}
        onConfirm={() => toDelete && deleteUser.mutate(toDelete, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}
