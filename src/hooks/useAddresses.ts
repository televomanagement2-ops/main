import { useQuery } from '@tanstack/react-query';
import { fetchAddresses } from '../lib/api';

export const addressKeys = {
  all: ['addresses'] as const,
  user: (userId: string) => [...addressKeys.all, userId] as const,
};

export function useAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: addressKeys.user(userId ?? ''),
    queryFn: () => fetchAddresses(userId!),
    enabled: Boolean(userId),
  });
}
