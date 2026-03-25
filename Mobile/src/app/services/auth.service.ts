import { request } from '../utils/api';
import type { ApiUser } from '../utils/api';

export type RegisterResponse = { message: string; token: string; user: ApiUser };
export type LoginResponse = { token: string; user: ApiUser };

export function register(phone: string, pin: string, firstName: string, lastName: string) {
  return request<RegisterResponse>('POST', '/api/auth/register', {
    phone,
    pin,
    fullName: `${firstName.trim()} ${lastName.trim()}`,
  });
}

export function login(phone: string, pin: string) {
  return request<LoginResponse>('POST', '/api/auth/login', { phone, pin });
}
