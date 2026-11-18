import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AnalyticsOverview, AnalyticsQuery } from '@sig/shared';
import { api } from './api';

export function useAnalyticsOverview(query: AnalyticsQuery) {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  ).toString();
  return useQuery({
    // prefix 'data-urls' → ikut ter-invalidate saat link/Data Url berubah atau disinkron
    queryKey: ['data-urls', 'analytics', query],
    queryFn: () => api<AnalyticsOverview>(`/analytics/overview${params ? `?${params}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
