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

export function sendOtp(phone: string) {
  return request<{ success: boolean; message: string; devCode?: string }>('POST', '/api/auth/send-otp', { phone });
}

export function verifyOtp(phone: string, code: string) {
  return request<{ token: string; user: ApiUser }>('POST', '/api/auth/verify-otp', { phone, code });
}

