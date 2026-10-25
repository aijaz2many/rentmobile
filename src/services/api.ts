import type { ApiEnvelope } from '@rentmobile/shared';
import { API_BASE_URL } from '../types';

let authToken: string | null = null;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setToken(token: string | null) {
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
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Network request failed')) {
      throw new Error(`Cannot reach ${url}. Check the API URL and ensure the backend is running.`);
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;

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

  return normalizePayload<T>(data);
}


