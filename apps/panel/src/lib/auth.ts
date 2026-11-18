import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginInput, User } from '@sig/shared';
import { api, ApiError } from './api';

const ME_KEY = ['auth', 'me'] as const;

/** User yang sedang login; `null` jika belum login. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return (await api<AuthResponse>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
  });
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
