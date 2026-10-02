import { AppError } from '../errors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GoogleClientOptions {
  /** Returns the current OAuth access token, or undefined when signed out / expired. */
  getToken: () => string | undefined;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Called on HTTP 401 so the app can prompt for sign-in. */
  onUnauthorized?: () => void;
}

export interface RequestOptions {
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Retry on 429/5xx/network. Defaults to true only for GET (safe to repeat). */
  retry?: boolean;
}

export interface GoogleClient {
  request<T>(url: string, opts?: RequestOptions): Promise<T>;
}

const RETRY_DELAYS_MS = [600, 1800];

/**
 * Minimal authenticated fetch for Google REST APIs. The token goes only into the
 * Authorization header of requests to Google; it is never logged or persisted.
 */
export function createGoogleClient(options: GoogleClientOptions): GoogleClient {
  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function request<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET';
    const retry = opts.retry ?? method === 'GET';
    for (let attempt = 0; ; attempt++) {
      try {
        return await once<T>(url, method, opts);
      } catch (err) {
        const canRetry = retry && err instanceof AppError && err.retryable && attempt < RETRY_DELAYS_MS.length;
        if (!canRetry) throw err;
        await sleep(RETRY_DELAYS_MS[attempt]!);
      }
    }
  }

  async function once<T>(url: string, method: string, opts: RequestOptions): Promise<T> {
    const token = options.getToken();
    if (!token) {
      options.onUnauthorized?.();
      throw new AppError('unauthorized', 'Not signed in.', 401);
    }
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        body: opts.body,
        headers: { Authorization: `Bearer ${token}`, ...opts.headers },
      });
    } catch {
      throw new AppError('network', 'Network request failed.');
    }
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    const detail = await errorDetail(res);
    if (res.status === 401) {
      options.onUnauthorized?.();
      throw new AppError('unauthorized', 'Google session expired.', 401);
    }
    if (res.status === 403 && /rate|quota/i.test(detail.reason)) throw new AppError('rate_limited', 'Rate limited.', 403);
    if (res.status === 403) throw new AppError('forbidden', 'Access denied by Google.', 403);
    if (res.status === 404) throw new AppError('not_found', 'Not found.', 404);
    if (res.status === 429) throw new AppError('rate_limited', 'Rate limited.', 429);
    if (res.status >= 500) throw new AppError('server', 'Google server error.', res.status);
    throw new AppError('bad_request', detail.message || 'Google rejected the request.', res.status);
  }

  return { request };
}

async function errorDetail(res: Response): Promise<{ message: string; reason: string }> {
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string; errors?: { reason?: string }[] } };
    const reason = [body.error?.status, ...(body.error?.errors ?? []).map((e) => e.reason)].filter(Boolean).join(' ');
    return { message: body.error?.message ?? '', reason };
  } catch {
    return { message: '', reason: '' };
  }
}
