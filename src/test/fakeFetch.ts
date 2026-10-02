import type { FetchLike } from '../data/google/http';

export interface Recorded {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (req: Recorded) => Response | Promise<Response> | 'network-error';

/** Deterministic stand-in for Google's REST APIs. Routes are matched in order. */
export function fakeFetch(routes: [method: string, pattern: RegExp, handler: Handler][]) {
  const calls: Recorded[] = [];
  const impl: FetchLike = async (url, init = {}) => {
    const req: Recorded = {
      method: init.method ?? 'GET',
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    };
    calls.push(req);
    const route = routes.find(([m, p]) => m === req.method && p.test(url));
    if (!route) return json({ error: { message: `No fake route for ${req.method} ${url}` } }, 500);
    const res = await route[2](req);
    if (res === 'network-error') throw new TypeError('Failed to fetch');
    return res;
  };
  return { impl, calls };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function googleError(status: number, message = 'error', reason = ''): Response {
  return json({ error: { code: status, message, status: reason, errors: reason ? [{ reason }] : [] } }, status);
}
