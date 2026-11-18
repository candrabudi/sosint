import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkLinksResult, SyncDataUrlResult,
  CommentPage, CommentQuery, CreateDataUrlInput, DataUrl, DataUrlDetail, DataUrlHistory, DataUrlPage, LinkSnapshot, DataUrlLink, DataUrlQuery, LinkInput, UpdateDataUrlInput, UpdateLinkInput,
} from '@sig/shared';
import { isSyncable } from '@sig/shared';
import { toast } from 'sonner';
import { api } from './api';

const KEY = ['data-urls'] as const;

export function useDataUrls(query: DataUrlQuery) {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  ).toString();
  return useQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: () => api<DataUrlPage>(`/data-urls${params ? `?${params}` : ''}`),
    placeholderData: keepPreviousData,
  });
}

/** Semua tag unik untuk filter. */
export function useDataUrlTags() {
  return useQuery({ queryKey: [...KEY, 'tags'], queryFn: () => api<string[]>('/data-urls/tags') });
}

/** Link platform yang didukung tapi belum pernah ditarik & belum error → sedang disinkron di background. */
export const isAwaitingSync = (l: DataUrlLink) => isSyncable(l.platform) && !l.lastSyncedAt && !l.lastSyncError;

export function useDataUrl(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<DataUrlDetail>(`/data-urls/${id}`),
    // polling ringan selama masih ada link yang menunggu auto-sync (berhenti otomatis setelah ±2 menit)
    refetchInterval: (q) => {
      const d = q.state.data;
      const waiting = d?.links.some(isAwaitingSync);
      return waiting && q.state.dataUpdateCount < 50 ? 2500 : false;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

const onError = (title: string) => (err: Error) => toast.error(title, { description: err.message });

export function useCreateDataUrl() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateDataUrlInput) => api<DataUrlDetail>('/data-urls', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (d) => {
      invalidate();
      toast.success('Data Url dibuat', { description: `${d.title} · ${d.linkCount} link` });
    },
  });
}

export function useUpdateDataUrl() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDataUrlInput & { id: string }) =>
      api<DataUrlDetail>(`/data-urls/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: invalidate,
    onError: onError('Gagal menyimpan Data Url'),
  });
}

export function useDeleteDataUrl() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (d: DataUrl) => api(`/data-urls/${d.id}`, { method: 'DELETE' }),
    onSuccess: (_r, d) => {
      invalidate();
      toast.success('Data Url dihapus', { description: d.title });
    },
    onError: onError('Gagal menghapus Data Url'),
  });
}

export function useAddLink(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: LinkInput) =>
      api<DataUrlLink>(`/data-urls/${dataUrlId}/links`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success('Link ditambahkan');
    },
  });
}

export function useAddLinksBulk(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (urls: string[]) =>
      api<BulkLinksResult>(`/data-urls/${dataUrlId}/links/bulk`, { method: 'POST', body: JSON.stringify({ urls }) }),
    onSuccess: (r) => {
      invalidate();
      if (r.added) {
        const desc = [r.syncQueued && `${r.syncQueued} sedang disinkron otomatis`, r.skipped && `${r.skipped} sudah ada, dilewati`].filter(Boolean).join(' · ');
        toast.success(`${r.added} link ditambahkan`, { description: desc || undefined });
      }
      else toast.info('Tidak ada link baru', { description: 'Semua link sudah ada di Data Url ini.' });
    },
    onError: onError('Gagal menambahkan link'),
  });
}

/** Tarik analitik terbaru satu link dari apidirect. */
export function useSyncLink(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (link: DataUrlLink) => api<DataUrlLink>(`/data-urls/${dataUrlId}/links/${link.id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast.success('Analitik diperbarui');
    },
    onError: (err) => {
      invalidate(); // tampilkan last_sync_error
      toast.error('Sinkron gagal', { description: err.message });
    },
  });
}

/** Sinkron semua link yang didukung dalam satu Data Url. */
export function useSyncAll(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api<SyncDataUrlResult>(`/data-urls/${dataUrlId}/sync`, { method: 'POST' }),
    onSuccess: (r) => {
      invalidate();
      const desc = [r.failed && `${r.failed} gagal`, r.skipped && `${r.skipped} platform belum didukung`].filter(Boolean).join(' · ');
      if (r.failed && !r.synced) toast.error('Semua sinkron gagal', { description: desc });
      else if (r.failed) toast.warning(`${r.synced} link tersinkron`, { description: desc });
      else toast.success(`${r.synced} link tersinkron`, { description: desc || undefined });
    },
    onError: onError('Sinkron gagal'),
  });
}

export function useUpdateLink(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateLinkInput & { id: string }) =>
      api<DataUrlLink>(`/data-urls/${dataUrlId}/links/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success('Link diperbarui');
    },
  });
}

export function useDeleteLink(dataUrlId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (link: DataUrlLink) => api(`/data-urls/${dataUrlId}/links/${link.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success('Link dihapus');
    },
    onError: onError('Gagal menghapus link'),
  });
}

/** Total harian (riwayat) satu Data Url. */
export function useDataUrlHistory(id: string) {
  return useQuery({ queryKey: [...KEY, 'history', id], queryFn: () => api<DataUrlHistory>(`/data-urls/${id}/history`) });
}

/** Semua snapshot satu link; hanya dimuat saat dibutuhkan. */
export function useLinkHistory(dataUrlId: string, linkId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'link-history', linkId],
    queryFn: () => api<LinkSnapshot[]>(`/data-urls/${dataUrlId}/links/${linkId}/history`),
    enabled: !!linkId,
  });
}

/** Komentar semua link dalam Data Url (ber-halaman). */
export function useDataUrlComments(dataUrlId: string, query: CommentQuery, enabled = true) {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: [...KEY, 'comments', dataUrlId, query],
    queryFn: () => api<CommentPage>(`/data-urls/${dataUrlId}/comments${params ? `?${params}` : ''}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}
