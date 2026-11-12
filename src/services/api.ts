import type { ApiEnvelope } from '@rentmobile/shared';
import { API_BASE_URL } from '../types';

let authToken: string | null = null;
const API_CACHE_TTL_MS = 30_000;
const apiResponseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
let cacheVersion = 0;

function clonePayload<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function invalidateApiCache() {
  cacheVersion += 1;
  apiResponseCache.clear();
  inFlightGetRequests.clear();
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setToken(token: string | null) {
  if (authToken !== token) invalidateApiCache();
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

function normalizePayload<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload && 'success' in payload) {
    const envelope = payload as ApiEnvelope<T>;
    return envelope.data as T;
  }

  return payload as T;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = `${API_BASE_URL}${endpoint}`;
  const shouldCache = method === 'GET' && options.cache !== 'no-store';

  if (method !== 'GET') invalidateApiCache();

  if (shouldCache) {
    const cached = apiResponseCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return clonePayload(cached.value) as T;
    if (cached) apiResponseCache.delete(url);

    const inFlight = inFlightGetRequests.get(url);
    if (inFlight) return clonePayload(await inFlight) as T;
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const requestVersion = cacheVersion;
  const request = (async (): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Network request failed')) {
        throw new Error(`Cannot reach ${url}. Check the API URL and ensure the backend is running.`);
      }
      throw error;
    }

    if (response.status === 204) return undefined;

    const body = await response.text();
    let data: unknown;
    try {
      data = body ? JSON.parse(body) : {};
    } catch {
      throw new Error(`Server returned an invalid response (${response.status}).`);
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Server responded with ${response.status}`;
      throw new ApiError(message, response.status);
    }

    const payload = normalizePayload<unknown>(data);
    if (shouldCache && requestVersion === cacheVersion) {
      apiResponseCache.set(url, { expiresAt: Date.now() + API_CACHE_TTL_MS, value: clonePayload(payload) });
    }
    if (method !== 'GET') invalidateApiCache();
    return payload;
  })();

  if (!shouldCache) return await request as T;
  inFlightGetRequests.set(url, request);
  try {
    return clonePayload(await request) as T;
  } finally {
    if (inFlightGetRequests.get(url) === request) inFlightGetRequests.delete(url);
  }
}

