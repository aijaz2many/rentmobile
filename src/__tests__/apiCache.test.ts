import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, invalidateApiCache, setToken } from '../services/api';

afterEach(() => {
  invalidateApiCache();
  setToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API response cache', () => {
  it('reuses successful GET responses and returns independent copies', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ records: [{ id: 'one' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await apiRequest<{ records: { id: string }[] }>('/cache-test');
    first.records[0].id = 'changed';
    const second = await apiRequest<{ records: { id: string }[] }>('/cache-test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.records[0].id).toBe('one');
  });

  it('invalidates cached GET responses after a successful write', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'before' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'saved' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'after' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await apiRequest('/cache-test')).toEqual({ value: 'before' });
    await apiRequest('/cache-test', { method: 'PATCH', body: JSON.stringify({ value: 'after' }) });
    expect(await apiRequest('/cache-test')).toEqual({ value: 'after' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('bypasses the cache when explicitly requested', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await apiRequest('/cache-test')).toEqual({ value: 1 });
    expect(await apiRequest('/cache-test', { cache: 'no-store' })).toEqual({ value: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears cached responses when the authentication token changes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'first user' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 'second user' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setToken('first-user-token');

    expect(await apiRequest('/cache-test')).toEqual({ value: 'first user' });
    setToken('second-user-token');
    expect(await apiRequest('/cache-test')).toEqual({ value: 'second user' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
