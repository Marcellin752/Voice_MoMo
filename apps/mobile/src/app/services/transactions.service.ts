import { request } from '../utils/api';
import type { ApiTransaction } from '../utils/api';

export type GetTransactionsParams = {
  q?: string;
  type?: 'in' | 'out' | 'all';
};

export type CreateTransactionInput = {
  title?: string;
  desc?: string;
  amount: number;
  type: 'in' | 'out' | 'recharge';
};

export function getTransactions(params?: GetTransactionsParams) {
  const qs = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null)
        ) as Record<string, string>
      ).toString()
    : '';
  return request<{ transactions: ApiTransaction[] }>(
    'GET',
    `/api/transactions${qs ? '?' + qs : ''}`
  );
}

export function createTransaction(data: CreateTransactionInput) {
  return request<ApiTransaction>('POST', '/api/transactions', data);
}
