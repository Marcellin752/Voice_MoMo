import { request } from '../utils/api';
import type { ApiUser } from '../utils/api';

export type RegisterResponse = { message: string; user: ApiUser };
export type LoginResponse = { token: string; user: ApiUser };

export function register(phone: string, pin: string) {
  return request<RegisterResponse>('POST', '/api/auth/register', { phone, pin });
}

export function login(phone: string, pin: string) {
  return request<LoginResponse>('POST', '/api/auth/login', { phone, pin });
}
