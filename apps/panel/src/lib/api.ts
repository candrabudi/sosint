export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      res.status === 429
        ? 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.'
        : res.status >= 500
          ? 'Terjadi kesalahan pada server. Coba lagi nanti.'
          : (data?.message ?? `Request gagal (${res.status})`);
    throw new ApiError(message, res.status, data?.errors);
  }
  return data as T;
}
