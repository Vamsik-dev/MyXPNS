import { fakeFetch, googleError, json } from '../../test/fakeFetch';
import { AppError, userMessage } from '../errors';
import { createGoogleClient } from './http';

const noSleep = () => Promise.resolve();

function client(routes: Parameters<typeof fakeFetch>[0], token: string | null = 'tok-123', onUnauthorized = vi.fn()) {
  const f = fakeFetch(routes);
  return { c: createGoogleClient({ getToken: () => token ?? undefined, fetchImpl: f.impl, sleep: noSleep, onUnauthorized }), calls: f.calls, onUnauthorized };
}

async function errorOf(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('expected rejection');
}

describe('Google HTTP client', () => {
  it('sends the bearer token only in the Authorization header', async () => {
    const { c, calls } = client([['GET', /ok/, () => json({ a: 1 })]]);
    await expect(c.request('https://example.googleapis.com/ok')).resolves.toEqual({ a: 1 });
    expect(calls[0]!.headers.Authorization).toBe('Bearer tok-123');
    expect(calls[0]!.url).not.toContain('tok-123');
  });

  it('refuses to call Google without a token (unauthorized access)', async () => {
    const { c, calls, onUnauthorized } = client([['GET', /ok/, () => json({})]], null);
    const err = await errorOf(c.request('https://x.googleapis.com/ok'));
    expect(err.kind).toBe('unauthorized');
    expect(calls).toHaveLength(0);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('maps 401 to unauthorized and notifies the app', async () => {
    const { c, onUnauthorized } = client([['GET', /x/, () => googleError(401)]]);
    expect((await errorOf(c.request('https://x.googleapis.com/x'))).kind).toBe('unauthorized');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('maps 403 to forbidden (no access to someone else’s file)', async () => {
    const { c } = client([['GET', /x/, () => googleError(403, 'The caller does not have permission', 'PERMISSION_DENIED')]]);
    const err = await errorOf(c.request('https://x.googleapis.com/x'));
    expect(err.kind).toBe('forbidden');
    expect(userMessage(err)).toMatch(/doesn’t have access/);
  });

  it('maps 403 rate limit reasons to rate_limited', async () => {
    const { c } = client([['POST', /x/, () => googleError(403, 'quota', 'userRateLimitExceeded')]]);
    expect((await errorOf(c.request('https://x.googleapis.com/x', { method: 'POST' }))).kind).toBe('rate_limited');
  });

  it('maps 404 and 400', async () => {
    const { c } = client([
      ['GET', /missing/, () => googleError(404)],
      ['GET', /bad/, () => googleError(400, 'Unable to parse range')],
    ]);
    expect((await errorOf(c.request('https://x/missing'))).kind).toBe('not_found');
    const bad = await errorOf(c.request('https://x/bad'));
    expect(bad.kind).toBe('bad_request');
    expect(bad.message).toBe('Unable to parse range');
  });

  it('retries GETs on 503 and then succeeds', async () => {
    let n = 0;
    const { c, calls } = client([['GET', /x/, () => (++n < 3 ? googleError(503) : json({ ok: true }))]]);
    await expect(c.request('https://x/x')).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(3);
  });

  it('gives up after two retries', async () => {
    const { c, calls } = client([['GET', /x/, () => googleError(500)]]);
    expect((await errorOf(c.request('https://x/x'))).kind).toBe('server');
    expect(calls).toHaveLength(3);
  });

  it('does NOT retry writes (prevents duplicate rows)', async () => {
    const { c, calls } = client([['POST', /x/, () => googleError(503)]]);
    expect((await errorOf(c.request('https://x/x', { method: 'POST' }))).kind).toBe('server');
    expect(calls).toHaveLength(1);
  });

  it('maps fetch failures to network errors', async () => {
    const { c } = client([['POST', /x/, () => 'network-error']]);
    const err = await errorOf(c.request('https://x/x', { method: 'POST' }));
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
    expect(userMessage(err)).toMatch(/No connection/);
  });

  it('handles empty 204 responses', async () => {
    const { c } = client([['DELETE', /x/, () => new Response(null, { status: 204 })]]);
    await expect(c.request('https://x/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
