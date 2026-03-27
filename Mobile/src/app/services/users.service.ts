import { request } from '../utils/api';
import type { ApiProfile, ApiNotification } from '../utils/api';

export function getProfile() {
  return request<ApiProfile>('GET', '/api/users/profile');
}

export function updateProfile(data: Partial<Pick<ApiProfile, 'fullName' | 'email' | 'phone' | 'avatarUrl'>>) {
  return request<ApiProfile>('PUT', '/api/users/profile', data);
}

export function getLanguage() {
  return request<{ language: 'fr' | 'en' }>('GET', '/api/users/language');
}

export function updateLanguage(language: 'fr' | 'en') {
  return request<{ language: 'fr' | 'en' }>('PUT', '/api/users/language', { language });
}

export function updatePin(oldPin: string, newPin: string, confirmPin: string) {
  return request<{ pinUpdatedAt: string }>('PUT', '/api/users/pin', { oldPin, newPin, confirmPin });
}

export function getSecurity() {
  return request<{ pinUpdatedAt: string | null }>('GET', '/api/users/security');
}

export function getNotifications() {
  return request<{ notifications: ApiNotification[] }>('GET', '/api/users/notifications');
}

export function getBalance() {
  return request<{ balance: number }>('GET', '/api/users/balance');
}
