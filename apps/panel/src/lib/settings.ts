import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiDirectSettings, SyncScheduleInput, SyncScheduleSettings, TestApiDirectInput, TestApiDirectResult, UpdateApiDirectSettingsInput,
} from '@sig/shared';
import { toast } from 'sonner';
import { api } from './api';

const KEY = ['settings', 'apidirect'] as const;

export function useApiDirectSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => api<ApiDirectSettings>('/settings/apidirect') });
}

export function useSaveApiDirectSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateApiDirectSettingsInput) =>
      api<ApiDirectSettings>('/settings/apidirect', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
    onError: (err) => toast.error('Gagal menyimpan pengaturan', { description: err.message }),
  });
}

export function useTestApiDirect() {
  return useMutation({
    mutationFn: (input: TestApiDirectInput) =>
      api<TestApiDirectResult>('/settings/apidirect/test', { method: 'POST', body: JSON.stringify(input) }),
  });
}

// ---------- sinkron terjadwal ----------

const SCHEDULE_KEY = ['settings', 'sync-schedule'] as const;

export function useSyncSchedule() {
  return useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: () => api<SyncScheduleSettings>('/settings/sync-schedule'),
    // saat sinkron berjalan, pantau sampai selesai
    refetchInterval: (q) => (q.state.data?.running ? 3000 : 60_000),
  });
}

export function useSaveSyncSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SyncScheduleInput) =>
      api<SyncScheduleSettings>('/settings/sync-schedule', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (data) => {
      qc.setQueryData(SCHEDULE_KEY, data);
      toast.success('Jadwal sinkron disimpan');
    },
    onError: (err) => toast.error('Gagal menyimpan jadwal', { description: err.message }),
  });
}

export function useRunSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ started: boolean }>('/settings/sync-schedule/run', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Sinkron dimulai', { description: 'Berjalan di background — riwayat akan bertambah setelah selesai.' });
      setTimeout(() => qc.invalidateQueries({ queryKey: SCHEDULE_KEY }), 800);
    },
    onError: (err) => toast.error('Tidak bisa memulai sinkron', { description: err.message }),
  });
}
