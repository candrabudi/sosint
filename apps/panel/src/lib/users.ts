import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, UpdateUserInput, User } from '@sig/shared';
import { toast } from 'sonner';
import { api } from './api';

const KEY = ['users'] as const;

export function useUsers() {
  return useQuery({ queryKey: KEY, queryFn: () => api<User[]>('/users') });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api<User>('/users', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('User berhasil ditambahkan', { description: u.email });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    // optimistic update supaya toggle terasa instan
    onMutate: async ({ id, password: _p, ...patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<User[]>(KEY);
      qc.setQueryData<User[]>(KEY, (list) => list?.map((u) => (u.id === id ? { ...u, ...patch } as User : u)));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error('Gagal menyimpan perubahan', { description: err.message });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => api<{ id: string }>(`/users/${user.id}`, { method: 'DELETE' }),
    onSuccess: (_r, user) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('User dihapus', { description: user.email });
    },
    onError: (err) => toast.error('Gagal menghapus user', { description: err.message }),
  });
}
