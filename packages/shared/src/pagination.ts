import { z } from 'zod';

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** Field query `page` & `pageSize` (string dari query-string → number). Sebarkan ke schema query lain. */
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};
export const paginationSchema = z.object(paginationShape);
export type PaginationQuery = z.input<typeof paginationSchema>;

/** Bentuk response list ber-halaman. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
