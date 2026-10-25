import { apiRequest } from '../services/api';

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    roles: string[];
    organizationId?: string;
    organizationName?: string;
    status?: string;
  };
};

export async function loginWithEmail(emailOrPhone: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrPhone, password }),
  });
}

export async function registerAccount(input: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
  organizationName: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(): Promise<AuthResponse['user']> {
  return apiRequest<AuthResponse['user']>('/auth/me');
}